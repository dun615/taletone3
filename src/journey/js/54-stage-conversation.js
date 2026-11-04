// messages written along the line: [selector, z on the line, side (1 right, -1 left, 0 hanging, 0.5 a note on the line)]
const ANCHORS = [
  ['#jy-hello', SET.land[0], 1], ['#jy-pcard', SET.land[1], -1], ['#jy-types', SET.land[2], 1], ['#jy-clients', SET.land[3], -1],
  ['#jy-creed', SET.sea[0], 1], ['#jy-step-0', SET.sea[1], 0], ['#jy-step-1', SET.sea[2], 0], ['#jy-step-2', SET.sea[3], 0],
  ['#jy-case-req', SET.space[0], 1], ['#jy-case-m0', SET.space[1], 0.5], ['#jy-case-m1', SET.space[2], -0.5], ['#jy-case-ans', SET.space[3], -1],
].map(([sel, z, side]) => ({ el: $(sel), z, side, w: 0, h: 0 })).filter((a) => a.el);
ANCHORS.forEach((a) => a.el.setAttribute('data-anchor', ''));
const swellZ = ANCHORS.filter((a) => a.side === 0 || Math.abs(a.side) === 0.5).map((a) => a.z);
ANCHORS.sort((a, b) => a.z - b.z);
// the messages of one chapter make one thread: each stays once written, the newest at the bottom of the
// reading spot and the older ones above it, quieter; a new chapter starts a new thread. What shows depends
// only on where the pen is, and the arrival itself is a short timed animation, so a quick scroll loses nothing.
const groupOf = (z) => (z < PEN.tone[0] ? 0 : z < PEN.case[0] ? 1 : z < PEN.music[0] ? 2 : 3);
let leadOf = null;
// The words of the about, the philosophy and the case are said in a chat room: a light frame, as tall as its
// thread, named for the chapter, the messages arriving at its bottom and the older ones going up and out of it.
// It keeps out of the scene's way: no fill, only its outline and the name.
const roomEl = $('#jy-room'), roomT = $('#jy-room-t'), roomS = $('#jy-room-s'), ROOMS = ['tale', 'tone', 'case'];
let roomOf = -1;
function roomBox() {
  // a tablet held upright: the room in the middle, at a reading width
  if (NARROW && W >= 700) { const w = Math.min(640, W - 64); return { x: (W - w) / 2, w, top: H * 0.5, bottom: H - 72, head: 64, foot: 6 }; }
  // a phone: the room keeps to the lower half, so the scene stays in view above it, and leaves the bottom edge to
  // the cue and the player
  if (NARROW) return { x: 8, w: W - 16, top: H * 0.5, bottom: H - 64, head: 58, foot: 4 };
  const w = Math.min(460, W * 0.36); return { x: Math.min(W * 0.57, W - w - 28), w, top: H * 0.11, bottom: H * 0.86, head: 66, foot: 6 };
}
function placeAnchors() {
  const RB = roomBox(), slotX = RB.x + 18, bottom = RB.bottom - RB.foot - 12, ceil = RB.top + RB.head + 10;
  let topY = bottom;

  let latest = -1;
  ANCHORS.forEach((a, i) => { if (penZ >= a.z) latest = i; });
  const g = latest >= 0 ? groupOf(ANCHORS[latest].z) : -1, gone = latest >= 0 && (penZ > ANCHORS[latest].z + 6 || (g === 0 && penZ > CL0 + 0.75));
  let y = bottom;
  leadOf = null;
  for (let i = ANCHORS.length - 1; i >= 0; i--) {
    const a = ANCHORS[i], shown = !gone && i <= latest && groupOf(a.z) === g;
    if (!a.w) { a.w = a.el.offsetWidth; a.h = a.el.offsetHeight; }
    a.el.classList.toggle('on', shown);
    a.el.classList.toggle('older', shown && i !== latest);
    // a hidden message waits just under the spot it will take, so it rises a short way when it arrives
    if (!shown) { a.el.style.setProperty('--aa', '0'); a.el.style.setProperty('--ax', slotX.toFixed(1) + 'px'); a.el.style.setProperty('--ay', (bottom - a.h + 18).toFixed(1) + 'px'); a.el.style.setProperty('--as', '1'); continue; }
    // (the older ones go up and out of the room once the thread would climb past its top)
    if (i !== latest && y - a.h < ceil) { a.el.classList.remove('on'); a.el.style.setProperty('--aa', '0'); continue; }
    y -= a.h; topY = y;
    a.el.style.setProperty('--aa', i === latest ? '1' : spaceDark > 0.5 ? '0.88' : '0.62');
    a.el.style.setProperty('--ax', slotX.toFixed(1) + 'px'); a.el.style.setProperty('--ay', y.toFixed(1) + 'px'); a.el.style.setProperty('--as', '1');
    if (i === latest) leadOf = { a, A: 1, x: slotX, y: y + Math.min(a.h / 2, 40) };
    y -= 10;
  }
  // the room around the thread
  const show = latest >= 0 && !gone && g >= 0 && g < 3;
  roomEl.classList.toggle('on', show);
  if (!show) return;
  if (g !== roomOf) { roomOf = g; const r = (COPY.rooms || {})[ROOMS[g]] || {}; roomT.textContent = r.title || ''; roomS.textContent = g === 2 && CASE && bySlug[CASE] ? bySlug[CASE].title : r.sub || ''; }
  // (it hugs its thread; a message taller than the room's share of the screen, as the profile card, takes the room up
  // with it, short of the top bar, rather than covering the room's name)
  const top = Math.max(NARROW ? 64 : 0, topY - 12 - RB.head);
  roomEl.style.transform = `translate(${RB.x}px,${top}px)`; roomEl.style.width = `${RB.w}px`; roomEl.style.height = `${RB.bottom - top}px`;
}
function drawLead(A) {
  if (!leadOf) return;
  const p = V(pathAt(leadOf.a.z)); if (!p) return;
  const al = A * leadOf.A;
  ctx.save(); ctx.strokeStyle = `rgba(${lineRGB},${0.55 * al})`; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(leadOf.x - 8, leadOf.y); ctx.stroke(); ctx.restore();
  ctx.fillStyle = `rgba(${lineRGB},${al})`; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(leadOf.x - 8, leadOf.y, 2.5, 0, Math.PI * 2); ctx.fill();
}
function polyline(pts, n) { ctx.beginPath(); let started = false; for (let i = 0; i < n; i++) { const q = pts[i]; if (!q) { started = false; continue; } if (started) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); started = true; } } }
// where along the whole page the line has come, written beside its tip on the left (the messages are on the right)
function drawCoord(u, rgb, A) {
  const P = penZ < ZS ? pathAt : penZ < S0 ? seaPath : spacePath, tip = V(P(penZ)); if (!tip || A < 0.05) return;
  const x = tip[0] - 16, y = tip[1], pct = `${Math.round((clamp(u / TOTAL)) * 100)}%`;
  // (in the line's own colour, edged in its opposite so it reads on every world: the land, the blue sea, the night)
  const lum = rgb.split(',').reduce((t, v, i) => t + Number(v) * [0.3, 0.59, 0.11][i], 0), halo = lum < 140 ? '254,254,254' : '20,28,48';
  ctx.font = '700 13px Quicksand, "LINE Seed KR", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
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
