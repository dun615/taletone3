// The record of every story: the staff swirling into the screen with every work on it, its card, the groove.

/* ---- the record of every story: its groove opens into a staff swirling into the screen ----
   World: five helices around the view axis (a staff); work i is a note on it at depth i*DZ, angle i*TURN and a
   pitch from a gentle melody. The camera flies down the axis; the view rolls so the note in focus always sits
   at the same place, so the swirl turns around the visitor.
   The staff is the pen line itself: it arrives as one line and splits in five. An album in focus lets its tracks out on an earphone cord. */
const DZ = 0.6, TURN = 0.5, VIEW = 1.5, FOCUS = 0.5, NEAR = 0.25, FAR = 11, GAP = 0.066, HEAD = -1.6;
// past the last song the camera rises back out of the staff to CEND, where the whole of it, its five lines joined
// into one again, is seen face on: one spiral from the first song at the rim to the last at the label, the groove
// of a record (the same as at the start, when the dive went into that groove)
const CEND = -7.6;
// the five lines open out of one over the first stretch of the staff (and close into one again at the end)
const splitAt = (z) => ease((z - HEAD) / 1.1), lineRad = (l, z) => 1 + (l * 2 - 4) * GAP * 0.5 * splitAt(z) * (1 - ((cur && cur.merge) || 0));
// depth shrinks the swirl gently (a power below 1), so the far turns open out instead of knotting at the centre
const OPEN = 0.55, shrink = (dz) => Math.pow(VIEW / dz, OPEN);
const pitchOf = (i) => Math.round(4 + 3 * Math.sin(i * 0.83 + 0.4)); // 0..8: lines and spaces, bottom to top
const radiusOf = (p) => 1 + (p - 4) * GAP * 0.5;
const trackLayer = $('#jy-tracks');
let cur = null, recK = 0, recShown = -1, flow = [], trackEls = {}, albumOpen = -1;
// (where the record sits across a wide screen: further left where the screen is not so wide, as a tablet held on its
// side, so the card on the right does not cover the record in front)
const recX = () => (W < 1360 ? 0.3 : 0.36);
// a CD's hub and hole read from 160px across (the design system's CD)
const CD_READ = 165;
function buildCurrent() {
  // (a tablet held upright gets a record as big as its width allows, above its card)
  const TAB = NARROW && W >= 700;
  const Rf = TAB ? Math.min(W * 0.4, H * 0.26) : NARROW ? Math.min(W * 0.34, H * 0.2) : Math.min(W * (W < 1360 ? 0.22 : 0.26), H * 0.37), size = TAB ? clamp(W * 0.17, 90, 150) : NARROW ? clamp(W * 0.2, 60, 88) : clamp(H * 0.14, 92, 128);
  const cy0 = TAB ? H * 0.34 : NARROW ? H * 0.31 : H * 0.5;
  cur = { cx: NARROW ? W / 2 : W * recX(), cy: cy0, cy0, F: Rf * VIEW, size, Rf, Rf0: Rf, merge: 0, far: FAR, fade: 1 };
  // where the staff begins on screen when the record opens: the world's line comes in there along the way the
  // staff leaves it. The staff is turned so its head sits upper right, and turns back as the camera dives in.
  { const c0 = -VIEW - 2.2, r0 = FOCUS - ((c0 + VIEW) / DZ) * TURN, at = (z) => { const a = (z / DZ) * TURN + r0 + cur.off, r = Rf * shrink(z - c0); return [W / 2 + Math.cos(a) * r, cur.cy0 + Math.sin(a) * r]; };
    cur.off = 0; cur.off = -0.8 - ((HEAD / DZ) * TURN + r0);
    cur.off = Math.atan2(Math.sin(cur.off), Math.cos(cur.off));
    const T = at(HEAD), T2 = at(HEAD + 0.12), n = Math.hypot(T2[0] - T[0], T2[1] - T[1]) || 1;
    tail = { T, tg: [(T2[0] - T[0]) / n, (T2[1] - T[1]) / n], L: Math.min(W, H) * 0.42 }; }
  spiral.style.setProperty('--s', size + 'px');
  const n = W <= 760 ? FLOW_DOTS.narrow : FLOW_DOTS.wide;
  flow = Array.from({ length: n }, () => ({ z: Math.random() * (N + 4) - 2, a: Math.random() * Math.PI * 2, r: 0.7 + Math.random() * 0.6, v: 0.15 + Math.random() * 0.3 }));
}
// tracks of each album, built once
items.forEach((li, i) => {
  const w = bySlug[li.dataset.slug];
  if (!li.hasAttribute('data-album')) return;
  const box = document.createElement('div'); box.className = 'jy-trks'; box.dataset.i = i; box.dataset.slug = w.slug;
  box.setAttribute('role', 'group'); box.setAttribute('aria-label', `${w.title} · ${COPY.albumTracks || COPY.tracks}`);
  w.tracks.forEach((t, j) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'jy-trk'; b.disabled = !t.audio; b.tabIndex = -1;
    b.setAttribute('aria-label', `${String(j + 1).padStart(2, '0')} ${t.title}`); b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span class="jy-vy"><img alt="" loading="lazy" decoding="async"></span><i></i><span class="jy-trk-t"></span>';
    // (the art loads when the album opens, not with the page)
    b.querySelector('img').dataset.src = /^https?:/.test(t.thumb || '') ? t.thumb : ASSET + (t.thumb || w.thumb);
    // (each track on its own CD, from its own art)
    b.querySelector('i').textContent = String(j + 1).padStart(2, '0'); b.querySelector('.jy-trk-t').textContent = t.title;
    b.addEventListener('click', () => (isPlaying(w.slug, j) ? pause() : play(w, j)));
    box.appendChild(b);
  });
  trackLayer.appendChild(box); trackEls[i] = box;
});
listeners.add(() => Object.entries(trackEls).forEach(([i, box]) => { const w = bySlug[items[i].dataset.slug]; $$('.jy-trk', box).forEach((b, j) => b.setAttribute('aria-pressed', String(isPlaying(w.slug, j)))); }));
const recordU = (k) => CH.record[0] + (CH.record[1] - CH.record[0]) * (0.1 + 0.82 * (N > 1 ? k / (N - 1) : 0));
// whatever has passed the note in focus fades out, so nothing covers the words on the right
const behind = (dz) => clamp((dz - VIEW * 0.45) / (VIEW * 0.4));
const proj = (theta, z, camZ, roll, rad = 1) => { const dz = z - camZ; if (dz < NEAR) return null; const r = cur.Rf * rad * shrink(dz); return [cur.cx + Math.cos(theta + roll) * r, cur.cy + Math.sin(theta + roll) * r, dz]; };
// an album's tracks hang on an earphone cord that runs out of the album along the bottom
const cord = (n, fx) => {
  if (NARROW) {
    // on a narrow screen: one or two rows across, just above the record's card
    const top = (readout.getBoundingClientRect().top || H * 0.7) - 52, rows = n > 6 ? 2 : 1, per = Math.ceil(n / rows), sp = Math.min(64, (W - 56) / per);
    return Array.from({ length: n }, (_, j) => { const r = Math.floor(j / per), c = j % per; return [W - 34 - (c + 0.5) * sp - (r ? sp / 2 : 0), top - r * 58 + Math.sin(c * 1.35 + 0.6) * 6]; });
  }
  const y = H * 0.905, x0 = fx - 70, sp = Math.min(78, (x0 - 72) / Math.max(1, n)); return Array.from({ length: n }, (_, j) => [x0 - (j + 0.5) * sp, y + Math.sin(j * 1.35 + 0.6) * 16]); };
function placeCurrent(lr) {
  const k = recK, focusZ = k * DZ;
  const dive = ease((lr - 0.02) / 0.1), out = ease((lr - 0.91) / 0.09);
  // diving: from above the groove (a flat spiral) down into it; leaving: back up out of it, to see it whole
  const camIn = lerp(-VIEW - 2.2, focusZ - VIEW, dive), camZ = lerp(camIn, CEND, out);
  cur.cx = lerp(lerp(W / 2, NARROW ? W / 2 : W * recX(), dive), W / 2, out); cur.cy = lerp(cur.cy0, H * 0.5, out);
  // (seen whole, it is as big as the record it becomes)
  cur.Rf = lerp(cur.Rf0, (Math.min(W, H) * 0.34) / shrink(HEAD - CEND), out); cur.merge = out; cur.far = lerp(FAR, 40, out); cur.fade = 1 - ease(out / 0.5);
  const roll = FOCUS - ((camZ + VIEW) / DZ) * TURN + (cur.off || 0) * (1 - dive);
  cur.camZ = camZ; cur.roll = roll;
  // the pen draws the staff forward from its head; works appear once their part of the staff is drawn
  cur.zMax = HEAD + (camIn + FAR - HEAD) * ease(lr / 0.15);
  const list = recordEl.classList.contains('list');
  spiral.style.opacity = list ? '1' : String(ease((lr - 0.02) / 0.06) * cur.fade);
  if (!list) items.forEach((li, i) => {
    const p = proj(i * TURN, i * DZ, camZ, roll, radiusOf(pitchOf(i)));
    if (!p || p[2] > cur.far) { li.style.visibility = 'hidden'; return; }
    // a note fades as soon as it has passed the focus, so it never covers the words on the right
    let sc2 = Math.pow(VIEW / p[2], 0.8) * (li.classList.contains('pin') ? 1.3 : 1);
    // (the work in focus grows to a CD of 165px or more, where its hub and hole read; not on a phone, where the
    // swirl has no room for it)
    if (!NARROW || W >= 700) sc2 = Math.max(sc2, lerp(sc2, CD_READ / cur.size, clamp(1 - Math.abs(i - k))));
    const a = clamp((p[2] - VIEW * 0.72) / (VIEW * 0.22)) * clamp((FAR - p[2]) / 5) * clamp((cur.zMax - i * DZ) / 0.5);
    li.style.visibility = a > 0.02 ? 'visible' : 'hidden';
    li.style.transform = `translate(${p[0]}px,${p[1]}px) scale(${sc2})`;
    li.style.opacity = String(a); li.style.zIndex = String(Math.round(1000 - p[2] * 40));
  });
  const i = Math.round(k);
  if (i !== recShown) { recShown = i; showReadout(i); }
  const near = Math.abs(k - i) < 0.32 && lr > 0.1 && lr < 0.92 && !list && !NARROW ? i : -1;
  Object.entries(trackEls).forEach(([j, box]) => {
    const show = Number(j) === near;
    box.classList.toggle('on', show);
    $$('.jy-trk', box).forEach((b) => { b.tabIndex = show ? 0 : -1; });
    if (!show) return;
    $$('img[data-src]', box).forEach((im) => { im.src = im.dataset.src; delete im.dataset.src; });
    const btns = $$('.jy-trk', box), fp = proj(near * TURN, near * DZ, camZ, roll, radiusOf(pitchOf(near))), pts2 = cord(btns.length, fp ? fp[0] : W * 0.5);
    btns.forEach((b, n) => { b.style.transform = `translate(${pts2[n][0]}px,${pts2[n][1]}px)`; b.style.transitionDelay = (n * 30) + 'ms'; });
  });
  albumOpen = near;
}
// one helix of the staff, stroked in short runs so the width can follow the depth
function staffLine(l, z0, z1, camZ, roll, alpha, width) {
  let run = [], wPrev = -1, aPrev = -1;
  const flush = () => { if (run.length > 1) { ctx.lineWidth = wPrev; ctx.lineCap = aPrev < 1 ? 'butt' : 'round'; ctx.strokeStyle = `rgba(${lineRGB},${aPrev})`; ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); for (let n = 1; n < run.length; n++) ctx.lineTo(run[n][0], run[n][1]); ctx.stroke(); } };
  for (let z = z0; z <= z1; z += 0.04) {
    const p = proj((z / DZ) * TURN, z, camZ, roll, lineRad(l, z)); if (!p) continue;
    // still one line before it splits: as thick as the pen line it continues
    const wd = Math.round(clamp(width * VIEW / p[2] * (1 + 1.4 * Math.max(1 - splitAt(z), cur.merge)), lerp(0.4, 1.5, cur.merge), 3.2) * 4) / 4, al = Math.round(0.85 * alpha * behind(p[2]) * clamp((cur.far - p[2]) / 6) * 20) / 20;
    if (wd !== wPrev || al !== aPrev) { const last = run[run.length - 1]; flush(); run = last ? [last] : []; wPrev = wd; aPrev = al; }
    run.push(p);
  }
  flush(); ctx.lineCap = 'round';
}
function drawCurrent(lr, lineA = 1) {
  if (!cur || cur.camZ == null) return;
  const { camZ, roll, zMax } = cur, FAR = cur.far, alpha = cur.fade;
  if (lineA <= 0) return;
  // the staff: five ink lines swirling in, thick close by, a hair far away
  const z0 = Math.max(HEAD, camZ + NEAR + 0.02), z1 = Math.min((N - 1) * DZ + 2.5, camZ + FAR, zMax);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // (once the five have closed into one, only the middle one is drawn)
  for (let l = 0; l < 5; l++) if (cur.merge < 0.97 || l === 2) staffLine(l, z0, z1, camZ, roll, lineA, 1.3);
  if (alpha <= 0) return;
  // while it is still being drawn, the five pen tips at the front
  if (z1 >= z0 && zMax < camZ + FAR - 0.05) {
    ctx.fillStyle = `rgba(${lineRGB},${alpha})`;
    for (let l = 0; l < 5; l++) { const p = proj((z1 / DZ) * TURN, z1, camZ, roll, lineRad(l, z1)); if (!p) continue; ctx.beginPath(); ctx.arc(p[0], p[1], clamp(2.6 * VIEW / p[2], 1.2, 4), 0, Math.PI * 2); ctx.fill(); }
  }
  // bar lines every four notes
  for (let i = 3; i < N; i += 4) {
    const z = (i + 0.5) * DZ, a = proj((z / DZ) * TURN, z, camZ, roll, radiusOf(0)), b2 = proj((z / DZ) * TURN, z, camZ, roll, radiusOf(8));
    if (!a || !b2 || a[2] > FAR || z > zMax) continue;
    ctx.strokeStyle = `rgba(${INK},${0.85 * alpha * behind(a[2]) * clamp((FAR - a[2]) / 6)})`; ctx.lineWidth = clamp(1.6 * VIEW / a[2], 0.4, 3); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
  }
  // stems: from each note, across the staff, away from the middle line
  for (let i = 0; i < N; i++) {
    const pi = pitchOf(i), up = pi < 4, th = i * TURN, z = i * DZ;
    const a = proj(th, z, camZ, roll, radiusOf(pi)); if (!a || a[2] > FAR || a[2] < VIEW * 0.72 || z > zMax) continue;
    const rr = (cur.size / 2) * Math.pow(VIEW / a[2], 0.8), dir = up ? 1 : -1, ang = th + roll, len = cur.Rf * GAP * 3.4 * shrink(a[2]);
    const sx = a[0] + Math.cos(ang) * rr * dir, sy = a[1] + Math.sin(ang) * rr * dir;
    ctx.strokeStyle = `rgba(${INK},${0.85 * alpha * clamp((FAR - a[2]) / 6) * clamp((a[2] - VIEW * 0.72) / (VIEW * 0.22))})`; ctx.lineWidth = clamp(2 * VIEW / a[2], 0.5, 3);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(ang) * len * dir, sy + Math.sin(ang) * len * dir); ctx.stroke();
  }
  // specks drifting down the swirl
  ctx.fillStyle = `rgb(${INK})`;
  for (const d of flow) {
    if (!reduce) d.z -= d.v * 0.016; if (d.z < camZ) d.z += FAR; if (d.z > zMax) continue;
    const p = proj((d.z / DZ) * TURN + d.a * 0.08, d.z, camZ, roll, d.r); if (!p) continue;
    const r = clamp(2.4 * VIEW / p[2], 0.6, 3.5);
    ctx.globalAlpha = alpha * 0.45 * clamp((FAR - p[2]) / 6) * behind(p[2]); ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r);
  }
  ctx.globalAlpha = 1;
  // the album's earphone cord: out of the album and along its tracks
  if (albumOpen >= 0 && trackEls[albumOpen]) {
    const p = proj(albumOpen * TURN, albumOpen * DZ, camZ, roll, radiusOf(pitchOf(albumOpen))), n = trackEls[albumOpen].childElementCount;
    if (p) {
      const pts2 = cord(n, p[0]);
      let prev = [p[0], p[1] + (cur.size / 2) * Math.pow(VIEW / p[2], 0.8)];
      ctx.strokeStyle = `rgba(${INK},${0.85 * alpha})`; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]);
      for (const q of pts2) { const mx = (prev[0] + q[0]) / 2; ctx.bezierCurveTo(mx, prev[1] + 26, mx, q[1] + 26, q[0], q[1]); prev = q; }
      ctx.stroke();
    }
  }
}
// Done: the groove, now where the record is, gives way to the record itself as it goes into the phone (sc: how
// much the record has shrunk, cx/cy: its centre)
let grooveSpin = 0;
function drawGroove(ld, sc, cx, cy) {
  if (!cur) return;
  cur.cx = cx; cur.cy = cy; cur.Rf = ((Math.min(W, H) * 0.34) / shrink(HEAD - CEND)) * sc;
  cur.camZ = CEND; cur.merge = 1; cur.far = 40; cur.fade = 0; cur.zMax = 1e9;
  cur.roll = FOCUS - ((CEND + VIEW) / DZ) * TURN + grooveSpin;
  drawCurrent(1, 1 - ease((ld - 0.06) / 0.22));
}
// Epilogue: the line comes back out from under the record in the phone and runs to the inquiry, lies along the
// first line to write on, and waits at its start, blinking, for the visitor to write the next line
function drawTrail(le, A) {
  // (on a phone the phone leaves before the form shows, so the line sets out sooner, while it is still there)
  const pr = ease((le - (NARROW ? 0.16 : 0.33)) / 0.2); if (pr <= 0) return;
  const tg = [formProject, fopen].find((e) => e && e.offsetParent !== null && e.getBoundingClientRect().width > 0); if (!tg) return;
  const fr = frame.getBoundingClientRect(), r = tg.getBoundingClientRect(), field = tg.id === 'jy-f-project';
  const P0 = [fr.left + fr.width / 2, fr.top + fr.height / 2], P2 = field ? [r.right, r.bottom - 0.5] : [r.left + 22, r.top - 5], P3 = field ? [r.left, r.bottom - 0.5] : P2;
  const pts = []; let cut = 0;
  if (field) {
    // a curve out from under the phone to the end of the field's line, then along it to where writing starts
    const c1 = [lerp(P0[0], P2[0], 0.25), P0[1] + H * 0.26], c2 = [P2[0] + Math.min(170, W * 0.12), P2[1] + 36];
    for (let i = 0; i <= 60; i++) { const t = i / 60, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3; pts.push([a * P0[0] + b * c1[0] + c * c2[0] + d * P2[0], a * P0[1] + b * c1[1] + c * c2[1] + d * P2[1]]); }
    for (let i = 1; i <= 30; i++) pts.push([lerp(P2[0], P3[0], i / 30), P2[1]]);
  } else {
    // on a phone, where the form opens from a button: out sideways to the margin while the phone is still there
    // (that stretch goes as the words come), down the margin clear of the words, and onto the button
    const X = 12;
    for (let i = 0; i <= 24; i++) pts.push([lerp(P0[0], X, i / 24), P0[1]]);
    cut = pts.length - 1;
    for (let i = 1; i <= 30; i++) pts.push([X, lerp(P0[1], P2[1] - 26, i / 30)]);
    for (let i = 1; i <= 12; i++) { const t = i / 12; pts.push([lerp(X, P2[0], t * t), lerp(P2[1] - 26, P2[1], 1 - (1 - t) * (1 - t))]); }
  }
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const end = L[L.length - 1] * pr, headA = field ? 1 : 1 - ease((le - 0.3) / 0.07);
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let tip = pts[0];
  const run = (i0, i1, a) => {
    if (a <= 0 || i1 <= i0 || end <= L[i0]) return; ctx.strokeStyle = `rgba(244,244,252,${0.9 * a * A})`; ctx.beginPath(); ctx.moveTo(pts[i0][0], pts[i0][1]);
    for (let i = i0 + 1; i <= i1; i++) { if (L[i] <= end) { ctx.lineTo(pts[i][0], pts[i][1]); continue; } const f = (end - L[i - 1]) / (L[i] - L[i - 1] || 1); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); break; }
    ctx.stroke();
  };
  run(0, cut || pts.length - 1, cut ? headA : 1); if (cut) run(cut, pts.length - 1, 1);
  for (let i = 1; i < pts.length; i++) { if (L[i] <= end) { tip = pts[i]; continue; } const f = (end - L[i - 1]) / (L[i] - L[i - 1] || 1); tip = [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; break; }
  // the pen tip; once there, it blinks like a caret, until the visitor starts writing
  const writing = form.contains(document.activeElement);
  const al = pr < 1 ? 1 : writing ? 0 : reduce ? 1 : 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(T * 4));
  if (al > 0) { ctx.fillStyle = `rgba(244,244,252,${al * A})`; ctx.beginPath(); ctx.arc(tip[0], tip[1], 3.5, 0, Math.PI * 2); ctx.fill(); }
}
function showReadout(i) {
  const w = bySlug[items[i].dataset.slug];
  items.forEach((li, j) => li.classList.toggle('cur', j === i));
  $('#jy-ro-i').textContent = String(i + 1).padStart(2, '0');
  $('#jy-ro-c').textContent = w.tracks && w.tracks.length > 1 ? ` · ${w.tracks.length}${LANG === 'en' ? ' ' : ''}${COPY.songs}` : '';
  { const pin = $('#jy-ro-pin'); pin.hidden = !w.pinned; if (w.pinned) pin.textContent = `✦ ${COPY.featuredLabel} ${String(w.pinned).padStart(2, '0')}`; }
  readoutFacts(w);
  $('#jy-ro-play').hidden = !sourceOf(w);
  const rv = $('#jy-ro-vers'); rv.dataset.slug = w.slug; versionChips(rv, w);
  // on a phone an album's tracks are chips in the card (the cord would cross the swirl)
  const tr = $('#jy-ro-trk'); tr.textContent = '';
  tr.hidden = !(NARROW && w.tracks.length > 1);
  if (!tr.hidden) {
    tr.setAttribute('aria-label', `${w.title} · ${COPY.albumTracks || COPY.tracks}`);
    w.tracks.forEach((t, j) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'jy-rtk'; b.disabled = !t.audio;
      b.innerHTML = '<i></i><span></span>'; b.querySelector('i').textContent = String(j + 1).padStart(2, '0'); b.querySelector('span').textContent = t.title;
      b.addEventListener('click', () => (isPlaying(w.slug, j) ? pause() : play(w, j)));
      tr.appendChild(b);
    });
  }
  syncReadout();
}
// the card's facts: the work, or the album track that has been picked (its title, the album and its number, its roles)
function readoutFacts(w) {
  const j = nowSlug === w.slug && nowTrack != null && w.tracks.length > 1 ? nowTrack : null, t = j != null ? w.tracks[j] : null;
  $('#jy-ro-t').textContent = t ? t.title : w.title; $('#jy-ro-a').textContent = w.artist;
  $('#jy-ro-m').textContent = (t ? [`${w.title} · ${String(j + 1).padStart(2, '0')}`, w.date] : [w.type, w.date]).filter(Boolean).join(' · ');
  $('#jy-ro-r').textContent = makingLine((t && t.roles && t.roles.length ? t.roles : w.roles));
}
function syncReadout() {
  if (recShown < 0) return;
  const w = bySlug[items[recShown].dataset.slug], p = isPlaying(w.slug);
  readoutFacts(w);
  $('#jy-ro-play').textContent = p ? COPY.pause : COPY.listen;
  $('#jy-ro-play').setAttribute('aria-pressed', String(p));
  $$('#jy-ro-trk .jy-rtk').forEach((b, j) => b.setAttribute('aria-pressed', String(isPlaying(w.slug, j))));
}
listeners.add(syncReadout);
$('#jy-ro-play').addEventListener('click', () => { const w = bySlug[items[recShown].dataset.slug]; if (isPlaying(w.slug)) pause(); else play(w); });
$('#jy-ro-open').addEventListener('click', (e) => openStory(items[recShown].dataset.slug, e.currentTarget));
const step = (dir) => {
  let i = recShown;
  for (let n = 0; n < N; n++) { i = clamp(i + dir, 0, N - 1); if (lit(bySlug[items[i].dataset.slug]) || i === 0 || i === N - 1) break; }
  goU(recordU(i));
};
$('#jy-ro-prev').addEventListener('click', () => step(-1));
$('#jy-ro-next').addEventListener('click', () => step(1));
$('#jy-view').addEventListener('click', (e) => {
  const b = e.currentTarget, list = !recordEl.classList.contains('list');
  recordEl.classList.toggle('list', list); b.setAttribute('aria-pressed', String(list));
  b.textContent = list ? b.dataset.on : b.dataset.off;
  items.forEach((li) => { li.style.transform = ''; li.style.opacity = ''; li.style.visibility = ''; li.style.zIndex = ''; });
  recShown = -1;
});
// keyboard: focusing a work flies the current to it
items.forEach((li, i) => $('.jy-sw-btn', li).addEventListener('focus', () => { if (!recordEl.classList.contains('list') && chapter === 'record') goU(recordU(i)); }));
