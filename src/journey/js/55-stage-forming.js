// How each thing of a world comes into being as the line comes: ahead of the pen it is only points, scattered; as the
// pen nears they gather onto its outline and the outline is drawn; once the pen has passed, the outline fills and takes
// its colour. So the world is not a finished scene the visitor moves through: it is made where the line goes.
// One measure for every world: how far ahead of the pen a thing is, in that world's depth (negative: passed). The
// colour arrives a little before the pen does, so what is just ahead is already whole and what is far is still points.
// formAt(ahead) -> { scatter (1 far apart .. 0 on the outline), dots (how much the points show), line (how much of the
// outline is drawn), fill (how filled and coloured) }, each 0 to 1.
function formAt(ahead) {
  return {
    scatter: ease(clamp((ahead - 3.6) / 5)),
    dots: clamp((ahead - 1.6) / 1.2),
    line: ease(clamp((6 - ahead) / 2.8)),
    fill: ease(clamp((2.6 - ahead) / 1.4)),
  };
}
// a stable pseudo-random number per thing and point
const hash2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
// the points of an outline (screen points, nullable), scattered by `scatter` (as far as a fifth of the screen), drifting
function dotsOn(Q, scatter, a, rgb, seed = 0) {
  if (a <= 0.01 || !Q.length) return;
  const R = scatter * Math.min(W, H) * 0.4, t = reduce ? 0 : T, step = Q.length > 160 ? 2 : 1;
  ctx.fillStyle = `rgba(${rgb},${Math.min(1, a * (0.6 + 0.4 * (1 - scatter))).toFixed(3)})`;
  for (let i = 0; i < Q.length; i += step) {
    const q = Q[i], q2 = Q[i + 1]; if (!q) continue;
    // (two points per point of the outline: on it, and half way to the next)
    for (const [px, py, j] of q2 ? [[q[0], q[1], 0], [(q[0] + q2[0]) / 2, (q[1] + q2[1]) / 2, 1]] : [[q[0], q[1], 0]]) {
      const h1 = hash2(seed, i * 2 + j), h2 = hash2(i * 2 + j, seed + 7), an = h1 * Math.PI * 2, r = R * (0.2 + 0.8 * h2);
      const x = px + Math.cos(an + t * 0.2 * scatter) * r, y = py + Math.sin(an + t * 0.2 * scatter) * r, s = 2 + 2.2 * h2;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
}
// an outline drawn as far as `line` of it (from its first point), as a stroke; while it is being drawn (`fill` not yet
// come) the pen's own ink (the line's colour in that world) runs along it, with a point where it is drawing
function lineOn(Q, line, strokeStyle, width, closed = false, fill = 1) {
  if (line <= 0.01) return;
  const n = Math.max(2, Math.round(line * Q.length)), ink = 1 - fill;
  ctx.strokeStyle = strokeStyle; ctx.lineWidth = width; polyline(Q, n); if (closed && n >= Q.length) ctx.closePath(); ctx.stroke();
  if (ink <= 0.02) return;
  ctx.strokeStyle = `rgba(${lineRGB},${(0.55 * ink).toFixed(3)})`; ctx.lineWidth = width + 0.8; polyline(Q, n); if (closed && n >= Q.length) ctx.closePath(); ctx.stroke();
  if (line < 1) { const tip = Q[n - 1]; if (tip) { ctx.fillStyle = `rgba(${lineRGB},${(0.8 * ink).toFixed(3)})`; ctx.beginPath(); ctx.arc(tip[0], tip[1], 2.2, 0, Math.PI * 2); ctx.fill(); } }
}
// points round a circle (for the round things: trees, bells, planets)
const ringPts = (cx, cy, R, n = 14) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * R, cy + Math.sin((i / n) * Math.PI * 2) * R]);
