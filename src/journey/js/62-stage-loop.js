// The frame loop (what each frame draws for the scroll position), resizing, and the stage's interface.
/* ---- the frame loop ---- */
const CHAPTERS = Object.keys(CH);
function chapterOf(u) { for (const k of CHAPTERS) if (u < CH[k][1]) return k; return 'epi'; }
function syncInert() {
  if (story && !story.hidden) return;
  if (profile.classList.contains('open')) return;
  sections.forEach((s) => { s.inert = s.dataset.ch !== chapter; });
}
function frameLoop(now) {
  requestAnimationFrame(frameLoop);
  sceneU = null; autoStep(now);
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; if (!reduce) T += dt;
  const u = sceneU != null ? sceneU : U();
  const ch = chapterOf(u);
  mprog.style.transform = `scaleX(${clamp(u / TOTAL)})`;
  if (ch !== chapter) { chapter = ch; html.classList.toggle('jy-at-pro', ch === 'pro'); syncInert(); mchap.textContent = COPY.rail[railOf[ch]] || ''; if (ch !== 'record' && sheet === 'filters') setSheet(null); rail.forEach((a) => { if (a.dataset.go === railOf[ch]) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); }); }
  // Prologue: fall into the phone
  const ip = clamp(local(u, 'pro')), cover = Math.max(W / 218, H / 400) * 1.08;
  // the phone grows with the screen: a tablet held upright shows it large, a big monitor too
  const ps = NARROW ? Math.min(1.45, (H * 0.47) / 416, (W - 40) / 234) : clamp((H * 0.5) / 416, 0.85, 1.3);
  phone.style.transform = `translateX(${NARROW ? 0 : -W * 0.14 * (1 - ease(ip / 0.35))}px) scale(${ps * (1 + 0.1 * ease((ip - 0.45) / 0.25)) * Math.pow(cover / (ps * 1.1), ease((ip - 0.7) / 0.3))})`;
  { const turn = 180 * ease(ip / 0.28), tl = phoneTilt(ip); card.style.transform = `rotateY(${(turn + tl.y).toFixed(2)}deg) rotateX(${tl.x.toFixed(2)}deg)`; }
  phone.style.visibility = ip >= 1 ? 'hidden' : 'visible';
  // (it rings until it has been turned over)
  { const ringing = ip < 0.02; if (ringing !== html.classList.contains('jy-ringing')) html.classList.toggle('jy-ringing', ringing); }
  // once turned over, the back and its silver sides are out of sight: drop them before the phone grows to fill the view
  { const turned = ip >= 0.3; if (turned !== phone.classList.contains('jy-turned')) phone.classList.toggle('jy-turned', turned); }
  phone.tabIndex = ip > 0.3 ? -1 : 0;
  screen.style.background = ip > 0.86 ? `rgb(${Math.round(lerp(20, 254, ease((ip - 0.86) / 0.1)))},${Math.round(lerp(28, 254, ease((ip - 0.86) / 0.1)))},${Math.round(lerp(48, 254, ease((ip - 0.86) / 0.1)))})` : '';
  lead.style.opacity = String(1 - ease(ip * 3)); lead.style.visibility = ip > 0.34 ? 'hidden' : 'visible';
  // (the film fades as the screen turns to paper, and rests once the phone is gone)
  if (lockVid && document.readyState === 'complete' && !document.hidden) lockVidPlay(ip < 0.43);
  drawEnter(ip);
  // Tale to Music: the pen moves forward through the world; the camera follows a few steps behind
  const lc = local(u, 'case'), lm = local(u, 'music');
  const pf = penFor(u); penZ = pf.z;
  // the camera rides the line behind the pen, turning up and down with it (see rig)
  { const cam = rig(penZ, worldOf(penZ)); if (ip < 1) cam.z = lerp(-2.6, cam.z, ease(ip)); setCam(cam); }
  // while a phone between worlds is on screen, the conversation steps aside for it
  { const pp = passP > 0.08 ? 1 : 0;
    if ((pp > 0.5) !== passing) { passing = pp > 0.5; html.classList.toggle('jy-passing', passing); } }
  placeAnchors(u);
  // how dark the scene is: the deep sea, then the night sky, until the record
  spaceDark = Math.max(spaceIn(), penZ >= ZS ? clamp((depthK() - 0.4) / 0.3) : 0) * spaceFade();
  { const m = (c0, c1) => Math.round(lerp(c0, c1, spaceDark)); lineRGB = `${m(20, 244)},${m(28, 244)},${m(48, 252)}`; }
  const caseWork = CASE && bySlug[CASE];
  if (caseWork) { if (lc > 0.04 && lc < 1) { setOffer(caseWork); caseOffer = true; } else if (caseOffer) { caseOffer = false; setOffer(null); } }
  // Record: the dive into the current
  const lr = local(u, 'record'), ld = local(u, 'done'), le = local(u, 'epi');
  const inRecord = lr > 0 && lr < 1;
  on(recordEl, inRecord); on(filtersEl, lr > 0.1 && lr < 0.93); on(fbtn, lr > 0.1 && lr < 0.93); on(tabsEl, lr > 0.1 && lr < 0.93); on(readout, lr > (NARROW ? 0.06 : 0.004) && lr < 0.93); // (on a phone it shares the bottom with the words on arriving, so it waits for them)
  on(foundEl, (lm > 0.88 && lm < 1.1 && lr <= 0) || (lr > 0 && lr < 0.06)); on(hintEl, lr > 0.05 && lr < 0.18);
  if (inRecord) { recK = clamp((lr - 0.1) / 0.82) * (N - 1); placeCurrent(lr); }
  else if (spiral.style.opacity !== '0') { spiral.style.opacity = '0'; Object.values(trackEls).forEach((box) => box.classList.remove('on')); albumOpen = -1; }
  // Done: out of the current, the phone is seen from outside, the record in it
  // (the dark worlds; the inquiry is on Paper)
  const ink = spaceDark > 0.5;
  stageEl.classList.toggle('ink', ink); html.classList.toggle('jy-ink', ink);
  for (const im of markImgs) { const src = ink ? im.dataset.paper : im.dataset.ink; if (im.dataset.on !== src) { im.dataset.on = src; im.src = src; } }
  // the letter stays while the empty seat is said under it, as one thread; both give way to the inquiry
  const both = le > 0.05 && le < 0.3;
  on(letterEl, (ld > 0.1 && le <= 0) || (le > 0 && le < 0.3)); on(emptyEl, both);
  letterEl.classList.toggle('up', both); if (both) letterEl.style.setProperty('--up', `${-(emptyEl.offsetHeight + 10)}px`);
  // the phone (416px with its charm below) keeps inside short screens
  // (on a phone smaller and higher, so the letter and the empty seat fit under it)
  const RR = Math.min(W, H) * 0.34, FS = NARROW ? Math.min(1, (H * 0.48) / 486) : Math.min(1, (H - 110) / 486);
  if (ld > 0 && le <= 0) {
    const s0 = (2 * RR) / 192, s = lerp(s0, FS, ease(ld / 0.7));
    frame.style.opacity = String(ease(ld / 0.25)); frame.style.transform = `scale(${s})`; frame.style.left = '50%'; frame.style.top = NARROW ? lerp(50, 40, ease(ld / 0.7)) + '%' : '50%';
    const chrome = ld >= 0.35; frame.style.background = chrome ? '' : 'transparent'; frame.style.borderColor = chrome ? '' : 'transparent'; frameScr.style.background = chrome ? '' : 'transparent';
  } else if (le > 0) {
    frame.style.opacity = NARROW ? String(1 - ease((le - 0.22) / 0.12)) : '1'; // (beside the inquiry, in the middle of the room it leaves, and no bigger than that room: a 4:3 screen has little)
    const cR = Math.max(180, W * 0.13) + Math.min(460, W - 48), fit = Math.min(1.25, (H - 70) / 486, (W - cR - 48) / 250);
    frame.style.transform = `scale(${NARROW ? FS : lerp(Math.min(FS, fit), fit, ease(le / 0.3))})`; frame.style.left = NARROW ? '50%' : `${Math.max(W * 0.72, (cR + W) / 2).toFixed(0)}px`; frame.style.top = NARROW ? '40%' : '50%';
    frame.style.background = ''; frame.style.borderColor = ''; frameScr.style.background = '';
  } else frame.style.opacity = '0';
  // Epilogue
  on(contactEl, le > 0.32);

  // ---- canvas ----
  ctx.clearRect(0, 0, W, H);
  if (inRecord) drawCurrent(lr);
  else if (ld > 0 && ld < 0.4) { const fr = frame.getBoundingClientRect(); drawGroove(ld, fr.width / 234 / ((2 * RR) / 192), fr.left + fr.width / 2, fr.top + fr.height / 2); }
  grooveSpin = ld > 0 && ld < 1 ? grooveSpin + dt * 0.9 : 0;
  if (le > 0.15) drawTrail(le, 1);
  const worldA = (ip > 0.8 ? ease((ip - 0.8) / 0.2) : 0) * (1 - ease(lr / 0.06));
  if (worldA > 0) {
    // (the end of a world's round: its start is drawn first, and the end fades out over it, so even a start that is
    // still mostly blank paper takes over smoothly)
    if (pf.z2 != null && pf.f > 0.01) { const z0 = penZ, c0 = getCam(); penZ = pf.z2; setCam(rig(penZ, worldOf(penZ))); drawWorld(worldA); penZ = z0; setCam(c0); }
    drawWorld(worldA * (pf.z2 != null ? 1 - (pf.f || 0) : 1));
  }
  // (the line's place in the whole page, while it is drawing a world and no phone is passing)
  if (worldA > 0 && u >= CH.tale[0] && u < CH.record[0] && !passing && !html.classList.contains('jy-held')) drawCoord(u, lineRGB, worldA);
  placeToWork(u);
}
function resize() {
  W = innerWidth; H = innerHeight; NARROW = W < 761 || H > W * 1.05; HZ = NARROW ? 0.38 : 0.46;
  html.classList.toggle('jy-narrow', NARROW);
  PHONE = NARROW && W < 700; PZ = PHONE ? clamp(W / 390, 0.8, 1.1) : 1;
  html.classList.toggle('jy-phone', PHONE); html.style.setProperty('--pz', PZ.toFixed(3));
  DPR = Math.min(NARROW ? 1.75 : 2, devicePixelRatio || 1);
  cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildWorld(); buildCurrent(); ANCHORS.forEach((a) => { a.w = 0; }); recShown = -1; cloud = null;
}
addEventListener('resize', resize);
// the phone (its 접속) plays the entering scene from wherever the visitor is in the prologue (turning it over first)
$('#jy-taphint').addEventListener('click', () => { if (U() < FLIP[1] - 0.02) playScene(FLIP, Math.max(U(), FLIP[0] + 0.001)); });
phone.addEventListener('click', (e) => {
  const u = U(); if (u > ENTER[1] - 0.01) return;
  if (u < FLIP[1] - 0.02) { playScene(FLIP, Math.max(u, FLIP[0] + 0.001)); return; }
  if (e.target.closest('.jy-na-row') || e.detail === 0) { entered = true; playScene(ENTER, u); } else nudgeEnter();
});

const at = (c, f) => CH[c][0] + (CH[c][1] - CH[c][0]) * f;
// each chapter opens where its first words are
const target = { pro: 0, tale: CH.tale[0] + READ0, tone: CH.tone[0] + READ0, record: recordU(0), epi: CH.epi[0] + 0.55 };
// a jump to the next chapter glides; across two or more it goes at once, without drawing everything between
const RAIL = ['pro', 'tale', 'tone', 'record', 'epi'];
function goStage(where, smooth = true) {
  const to = target[where] != null ? target[where] : 0;
  const far = Math.abs(RAIL.indexOf(railOf[chapterOf(U())]) - RAIL.indexOf(railOf[chapterOf(to)])) >= 2;
  goU(to, smooth && !far);
}
resize();
requestAnimationFrame(frameLoop);
// pick a record: bring it to the front of the staff (a glide when near, at once when far), show its card and play it
// (a record already playing keeps playing)
function pick(slug) {
  const i = items.findIndex((li) => li.dataset.slug === slug); if (i < 0) return;
  goU(recordU(i), !recordEl.classList.contains('list') && Math.abs(i - recK) < 6);
  const w = bySlug[slug]; if (sourceOf(w) && nowSlug !== w.slug) play(w);
}

// what the rest of the page may ask of the stage
const stage = { syncInert, go: goStage, recordU, goU, items, hold: holdStory, pick };
