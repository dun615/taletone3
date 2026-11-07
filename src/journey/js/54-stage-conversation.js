// The words of the about, the philosophy and the case: a chapter's all at once in the reading spot
// (each: [selector, z of the thing in its world it belongs to (which chapter it is in), side (kept for the line's swell)])
const ANCHORS = [
  ['#jy-hello', SET.land[0], 1], ['#jy-pcard', SET.land[1], -1], ['#jy-types', SET.land[2], 1], ['#jy-clients', SET.land[3], -1],
  ['#jy-creed', SET.sea[0], 1], ['#jy-step-0', SET.sea[1], 0], ['#jy-step-1', SET.sea[2], 0], ['#jy-step-2', SET.sea[3], 0],
  ['#jy-case-req', SET.space[0], 1], ['#jy-case-m0', SET.space[1], 0.5], ['#jy-case-m1', SET.space[2], -0.5], ['#jy-case-ans', SET.space[3], -1],
].map(([sel, z, side]) => ({ el: $(sel), z, side, w: 0, h: 0 })).filter((a) => a.el);
ANCHORS.forEach((a) => a.el.setAttribute('data-anchor', ''));
const swellZ = ANCHORS.filter((a) => a.side === 0 || Math.abs(a.side) === 0.5).map((a) => a.z);
ANCHORS.sort((a, b) => a.z - b.z);
// A chapter's words are all on screen at once, one under the other in the reading spot under the chapter's name (the
// room's head), to be read at the visitor's own pace. When they do not all fit, scrolling moves them up through the
// spot (the chapter's words then take as much scroll as that: readLen). Under them: shall we go on? and its button.
// They give way as the way on begins.
const groupOf = (z) => (z < PEN.tone[0] ? 0 : z < PEN.case[0] ? 1 : z < PEN.music[0] ? 2 : 3);
// how much larger than their own size the words are shown (less where the reading spot is small)
const wordScale = () => (NARROW && W < 700 ? 1 : 1.15);
const roomEl = $('#jy-room'), roomT = $('#jy-room-t'), roomS = $('#jy-room-s'), ROOMS = ['tale', 'tone', 'case'];
let roomOf = -1;
function roomBox() {
  // a tablet held upright: the lower part, at a reading width in the middle
  if (NARROW && W >= 700) { const w = Math.min(760, W - 64); return { x: (W - w) / 2, w, top: H * 0.3, bottom: H - 72, head: 64, foot: 6 }; }
  // a phone: the lower part, so the world stays in view above it, leaving the bottom edge to the way to the works
  if (NARROW) return { x: 8, w: W - 16, top: H * 0.32, bottom: H - 60, head: 58, foot: 4 };
  const w = Math.min(620, W * 0.42); return { x: Math.min(W * 0.54, W - w - 32), w, top: H * 0.1, bottom: H * 0.9, head: 66, foot: 6 };
}
// (a style is written only when it changes: twelve messages, several values each, every frame, would otherwise make the
// browser look at them all again each frame)
const setVar = (a, k, v) => { const c = a.css || (a.css = {}); if (c[k] !== v) { c[k] = v; a.el.style.setProperty(k, v); } };
const GROUPS = [0, 1, 2].map((g) => ANCHORS.map((_, i) => i).filter((i) => groupOf(ANCHORS[i].z) === g));
function placeAnchors(u) {
  const RB = roomBox(), x0 = RB.x + 18, top0 = RB.top + RB.head + 14, bot = RB.bottom - RB.foot - 12, avail = bot - top0, gap = 14, perU = rangeNow() / TOTAL;
  const zn = zoneOf(u), cur = zn && !passing && (zn.part === 'read' || zn.s < 0.04) ? STORY.indexOf(zn.k) : -1;
  let end = top0;
  GROUPS.forEach((ids, g) => {
    if (!ids.length) return;
    for (const i of ids) { const a = ANCHORS[i]; if (!a.w) { a.w = a.el.offsetWidth; a.h = a.el.offsetHeight; } }
    // (as large as fits: on a wide screen a chapter's words all fit, smaller if need be; a phone keeps them readable
    // and lets them scroll)
    // (the question and its button, at their own size, come after them and must fit too)
    const h1 = ids.reduce((t, i) => t + ANCHORS[i].h, 0) + gap * (ids.length - 1), fitH = NARROW && W < 700 ? Infinity : (avail - gap - goOnHeight() - 8) / h1;
    const sc = clamp(Math.min(wordScale(), (RB.w - 36) / Math.max(...ids.map((i) => ANCHORS[i].w)), fitH), 0.8, 1.5);
    // (the question and the button come after the words, as part of them)
    const hs = ids.reduce((t, i) => t + ANCHORS[i].h * sc, 0) + gap * ids.length + goOnHeight(), over = Math.max(0, hs - avail), k = STORY[g];
    readLen[k] = clamp(READ0 + 0.03 + over / Math.max(1, perU), READ0 + 0.03, READ_MAX);
    // (scrolled through the spot as far as the reading has come)
    const off = g !== cur ? 0 : zn.part === 'read' ? clamp(((u - CH[k][0] - READ0) / Math.max(1e-6, readLen[k] - READ0 - 0.03)) * over, 0, over) : over;
    let y = top0 - off;
    for (const i of ids) {
      const a = ANCHORS[i], shown = g === cur, h = a.h * sc;
      a.el.classList.toggle('on', shown);
      setVar(a, '--as', sc.toFixed(3)); setVar(a, '--ax', x0.toFixed(1) + 'px'); setVar(a, '--ay', (y + (shown ? 0 : 14)).toFixed(1) + 'px'); setVar(a, '--aa', shown ? '1' : '0');
      // (cut at the edges of the reading spot, so words moving through it do not run over the chapter's name)
      setVar(a, '--ct', (Math.max(0, top0 - 6 - y) / sc).toFixed(1) + 'px'); setVar(a, '--cb', (Math.max(0, y + h - bot - 6) / sc).toFixed(1) + 'px');
      y += h + gap;
      if (shown) end = Math.min(bot, y - gap);
    }
    if (g === cur) { const gh = goOnHeight(); placeGoOn(k, x0 + 4, y + 4, y + gh <= bot + 8); if (y + gh <= bot + 8) end = y + gh; }
  });
  if (cur < 0) placeGoOn(null, 0, 0, false);
  // the room: the chapter's name over its words
  const show = cur >= 0;
  roomEl.classList.toggle('on', show);
  if (!show) return;
  if (cur !== roomOf) { roomOf = cur; const r = (COPY.rooms || {})[ROOMS[cur]] || {}; roomT.textContent = r.title || ''; roomS.textContent = cur === 2 && CASE && bySlug[CASE] ? bySlug[CASE].title : r.sub || ''; }
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
