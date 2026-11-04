// How each thing of a world comes into being as the line comes: ahead of the pen it is only points, scattered; as the
// pen nears they gather onto its outline and the outline is drawn; once the pen has passed, the outline fills and takes
// its colour. So the world is not a finished scene the visitor moves through: it is made where the line goes.
// One measure for every world: how far ahead of the pen a thing is, in that world's depth (negative: passed). The
// colour arrives a little before the pen does, so what is just ahead is already whole and what is far is still points.
// formAt(ahead) -> { scatter (1 far apart .. 0 on the outline), dots (how much the points show), line (how much of the
// outline is drawn), fill (how filled and coloured) }, each 0 to 1.
function formAt(ahead) {
  return {
    scatter: ease(clamp((ahead - 3.4) / 7)),
    dots: clamp((ahead - 1.2) / 1.6),
    line: ease(clamp((6.2 - ahead) / 3.4)),
    fill: ease(clamp((2.8 - ahead) / 2.6)),
  };
}
// a stable pseudo-random number per thing and point
const hash2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
// the points of an outline (screen points, nullable), scattered by `scatter` (as far as a fifth of the screen), drifting
function dotsOn(Q, scatter, a, rgb, seed = 0) {
  if (a <= 0.01 || !Q.length) return;
  const R = scatter * Math.min(W, H) * 0.22, t = reduce ? 0 : T, step = Q.length > 120 ? 2 : 1;
  ctx.fillStyle = `rgba(${rgb},${(a * (0.45 + 0.55 * (1 - scatter))).toFixed(3)})`;
  for (let i = 0; i < Q.length; i += step) {
    const q = Q[i]; if (!q) continue;
    const h1 = hash2(seed, i), h2 = hash2(i, seed + 7), an = h1 * Math.PI * 2, r = R * (0.25 + 0.75 * h2);
    const x = q[0] + Math.cos(an + t * 0.15 * scatter) * r, y = q[1] + Math.sin(an + t * 0.15 * scatter) * r, s = 1.6 + 1.6 * h2;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
}
// an outline drawn as far as `line` of it (from its first point), as a stroke
function lineOn(Q, line, strokeStyle, width, closed = false) {
  if (line <= 0.01) return;
  const n = Math.max(2, Math.round(line * Q.length));
  ctx.strokeStyle = strokeStyle; ctx.lineWidth = width; polyline(Q, n); if (closed && n >= Q.length) ctx.closePath(); ctx.stroke();
}
// points round a circle (for the round things: trees, bells, planets)
const ringPts = (cx, cy, R, n = 14) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * R, cy + Math.sin((i / n) * Math.PI * 2) * R]);
