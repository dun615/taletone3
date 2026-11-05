// The messages along the line: where each sits on the line, and how they are said, like slides, two at a time
// (each: [selector, z on the line, side (1 right, -1 left, 0 hanging, 0.5 a note on the line)])
const ANCHORS = [
  ['#jy-hello', SET.land[0], 1], ['#jy-pcard', SET.land[1], -1], ['#jy-types', SET.land[2], 1], ['#jy-clients', SET.land[3], -1],
  ['#jy-creed', SET.sea[0], 1], ['#jy-step-0', SET.sea[1], 0], ['#jy-step-1', SET.sea[2], 0], ['#jy-step-2', SET.sea[3], 0],
  ['#jy-case-req', SET.space[0], 1], ['#jy-case-m0', SET.space[1], 0.5], ['#jy-case-m1', SET.space[2], -0.5], ['#jy-case-ans', SET.space[3], -1],
].map(([sel, z, side]) => ({ el: $(sel), z, side, w: 0, h: 0 })).filter((a) => a.el);
ANCHORS.forEach((a) => a.el.setAttribute('data-anchor', ''));
const swellZ = ANCHORS.filter((a) => a.side === 0 || Math.abs(a.side) === 0.5).map((a) => a.z);
ANCHORS.sort((a, b) => a.z - b.z);
// The messages are said like slides: the two of one stop (STOPS), large, one under the other in the reading spot, the
// first as it is passed and the second where the story stops; the next stop's two take their place. Each chapter's
// slides sit under its name (the room's head). What shows depends only on where the pen is.
const groupOf = (z) => (z < PEN.tone[0] ? 0 : z < PEN.case[0] ? 1 : z < PEN.music[0] ? 2 : 3);
const slideOf = (i) => Math.floor(i / 2);
const SLIDES = []; ANCHORS.forEach((a, i) => { (SLIDES[slideOf(i)] = SLIDES[slideOf(i)] || []).push(i); });
// how much larger than their own size the messages are shown (less where the reading spot is small)
const slideScale = () => (NARROW && W < 700 ? 1 : 1.3);
const roomEl = $('#jy-room'), roomT = $('#jy-room-t'), roomS = $('#jy-room-s'), ROOMS = ['tale', 'tone', 'case'];
let roomOf = -1;
function roomBox() {
  // a tablet held upright: the lower part, at a reading width in the middle
  if (NARROW && W >= 700) { const w = Math.min(760, W - 64); return { x: (W - w) / 2, w, top: H * 0.42, bottom: H - 72, head: 64, foot: 6 }; }
  // a phone: the lower part, so the scene stays in view above it, leaving the bottom edge to the way to the works
  if (NARROW) return { x: 8, w: W - 16, top: H * 0.4, bottom: H - 60, head: 58, foot: 4 };
  const w = Math.min(640, W * 0.42); return { x: Math.min(W * 0.54, W - w - 32), w, top: H * 0.12, bottom: H * 0.9, head: 66, foot: 6 };
}
// (a style is written only when it changes: twelve messages, four values each, every frame, would otherwise make the
// browser look at them all again each frame)
const setVar = (a, k, v) => { const c = a.css || (a.css = {}); if (c[k] !== v) { c[k] = v; a.el.style.setProperty(k, v); } };
function placeAnchors() {
  const RB = roomBox(), x0 = RB.x + 18, top0 = RB.top + RB.head + 14, avail = RB.bottom - RB.foot - 12 - top0, gap = 14;
  let latest = -1;
  ANCHORS.forEach((a, i) => { if (penZ >= a.z) latest = i; });
  const g = latest >= 0 ? groupOf(ANCHORS[latest].z) : -1, gone = latest >= 0 && (penZ > ANCHORS[latest].z + 6 || (g === 0 && penZ > CL0 + 0.75));
  const cur = latest >= 0 && !gone ? slideOf(latest) : -1;
  let end = top0;
  // every slide is laid out where it will be (so a slide only fades in and rises a little, never travels)
  SLIDES.forEach((ids, k) => {
    for (const i of ids) { const a = ANCHORS[i]; if (!a.w) { a.w = a.el.offsetWidth; a.h = a.el.offsetHeight; } }
    const hs = ids.reduce((t, i) => t + ANCHORS[i].h, 0) + gap * (ids.length - 1), ws = Math.max(...ids.map((i) => ANCHORS[i].w));
    const sc = clamp(Math.min(slideScale(), avail / hs, (RB.w - 36) / ws), 0.75, 1.5);
    let y = top0;
    for (const i of ids) {
      const a = ANCHORS[i], shown = k === cur && i <= latest;
      a.el.classList.toggle('on', shown);
      setVar(a, '--as', sc.toFixed(3)); setVar(a, '--ax', x0.toFixed(1) + 'px'); setVar(a, '--ay', (y + (shown ? 0 : 12)).toFixed(1) + 'px'); setVar(a, '--aa', shown ? '1' : '0');
      y += a.h * sc + gap;
      if (shown) end = y - gap;
    }
  });
  // the room: the chapter's name over its slides
  const show = cur >= 0 && g >= 0 && g < 3;
  roomEl.classList.toggle('on', show);
  if (!show) return;
  if (g !== roomOf) { roomOf = g; const r = (COPY.rooms || {})[ROOMS[g]] || {}; roomT.textContent = r.title || ''; roomS.textContent = g === 2 && CASE && bySlug[CASE] ? bySlug[CASE].title : r.sub || ''; }
  const top = top0 - 14 - RB.head;
  roomEl.style.transform = `translate(${RB.x}px,${top}px)`; roomEl.style.width = `${RB.w}px`; roomEl.style.height = `${end + 14 - top}px`;
}
function polyline(pts, n) { ctx.beginPath(); let started = false; for (let i = 0; i < n; i++) { const q = pts[i]; if (!q) { started = false; continue; } if (started) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); started = true; } } }
// where along the whole page the line has come, written beside its tip on the left (the messages are on the right)
function drawCoord(u, rgb, A0) {
  const P = penZ < ZS ? pathAt : penZ < S0 ? seaPath : spacePath, tip = V(P(penZ)), A = 0.5 * A0; if (!tip || A < 0.05) return; // (quiet: a reference, not a sight)
  const x = tip[0] - 16, y = tip[1], pct = `${Math.round((clamp(u / TOTAL)) * 100)}%`;
  // (in the line's own colour, edged in its opposite so it reads on every world: the land, the blue sea, the night)
  const lum = rgb.split(',').reduce((t, v, i) => t + Number(v) * [0.3, 0.59, 0.11][i], 0), halo = lum < 140 ? '254,254,254' : '20,28,48';
  ctx.font = '700 11px Quicksand, "LINE Seed KR", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(${rgb},${(0.85 * A).toFixed(3)})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(tip[0] - 6, y); ctx.lineTo(x + 3, y); ctx.stroke();
  ctx.strokeStyle = `rgba(${halo},${(0.7 * A).toFixed(3)})`; ctx.lineWidth = 3.5; ctx.strokeText(pct, x, y + 0.5);
  ctx.fillStyle = `rgba(${rgb},${A.toFixed(3)})`; ctx.fillText(pct, x, y + 0.5);
}
function drawTip(rgb, A, P = pathAt, hook = false) {
  const tip = V(P(penZ)); if (!tip || penZ <= PEN.tale[0] + 0.05) return;
  ctx.fillStyle = `rgba(${rgb},${A})`;
  if (!hook) { ctx.beginPath(); ctx.arc(tip[0], tip[1], clamp(4 * AHEAD / tip[2], 2, 6), 0, Math.PI * 2); ctx.fill(); return; }
  // a fishing hook on the end, turned the way the line runs on the screen
  const pr = V(P(penZ - 0.08)); if (!pr) return;
  const r = clamp(6 * AHEAD / tip[2], 4, 11);
  ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(Math.atan2(tip[1] - pr[1], tip[0] - pr[0]));
  ctx.strokeStyle = `rgba(${rgb},${A})`; ctx.lineWidth = Math.max(1.4, r * 0.2); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.5, 0); ctx.arc(r * 1.5, r * 0.55, r * 0.55, -Math.PI / 2, Math.PI * 0.92); ctx.lineTo(r * 1.2, r * 0.36); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, Math.max(1.6, r * 0.22), 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
