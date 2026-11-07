// Drawing each world: the sky and the land, the sea, space (backdrop and elements), and the line itself.
// fish in pastel colours
const SETC = ['252,226,160', '246,190,222', '204,192,250', '172,230,240'], FISHC = ['248,168,156', '252,210,128', '140,190,238'], KELPC = ['104,170,138', '148,186,116'];
const TREE = [136, 190, 146], FLOWER = [[248, 186, 204], [252, 226, 150], [255, 255, 255]];
const JELLY = ['246,190,222', '204,192,250', '172,230,240'], GLOW = ['150,236,240', '246,180,226', '240,236,170'];
// the sky at the zenith and the water at the top of the dive share one colour: that is the change of world
const ZEN = [196, 228, 242], HAZE = [252, 240, 230];
const mixA = (c0, c1, k) => c0.map((v, i) => lerp(v, c1[i], k));
const rgbA = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
// a gradient down the screen, coloured row by row by how far up or down that row looks
// (drawn as a one-pixel-wide strip, row by row, stretched over the screen: much lighter than a many-stop gradient)
const strip = document.createElement('canvas'), sctx = strip.getContext('2d'), SN = 96; strip.width = 1; strip.height = SN;
const sdata = sctx.createImageData(1, SN);
function skyFill(colAt, a) {
  for (let i = 0; i < SN; i++) { const [c, al] = colAt(elevAt(((i + 0.5) / SN) * H)), o = i * 4; sdata.data[o] = c[0]; sdata.data[o + 1] = c[1]; sdata.data[o + 2] = c[2]; sdata.data[o + 3] = 255 * clamp(al * a); }
  sctx.putImageData(sdata, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(strip, 0, 0, 1, SN, 0, 0, W, H);
}
// the water by depth: the sky's own colour at the top, then blue, navy, and the colour of the night it opens onto
const WATER = [[0, ZEN], [0.12, [178, 216, 236]], [0.3, [122, 178, 216]], [0.5, [66, 112, 170]], [0.72, [34, 56, 110]], [1, [22, 24, 50]]];
const waterAt = (k) => { for (let i = 1; i < WATER.length; i++) if (k <= WATER[i][0]) return mixA(WATER[i - 1][1], WATER[i][1], (k - WATER[i - 1][0]) / (WATER[i][0] - WATER[i - 1][0])); return WATER[WATER.length - 1][1]; };
// the far end of the view, straight up or straight down: deeper there, like the sky at its zenith and the sea
// below. (Straight up into the sky and straight down into the water look the same, which is the trick.)
function well(c, a, down) {
  if (a <= 0) return; const d = down ? -sP : sP; if (d < 0.05) return;
  const x = W / 2, y = H * HZ + ((down ? cP : -cP) * F3) / d, R = Math.hypot(W, H) * 0.62, g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, rgbA(c, a)); g.addColorStop(1, rgbA(c, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function seaBackdrop(a) {
  const dk = depthK(), c = waterAt(dk);
  ctx.fillStyle = rgbA(c, a); ctx.fillRect(0, 0, W, H);
  well(waterAt(Math.min(1, dk + 0.12)), 0.85 * a * clamp((-camP - 0.6) / 0.6), true);
}
function nightBackdrop(a) { const g = ctx.createLinearGradient(0, 0, W * 0.3, H); g.addColorStop(0, `rgba(18,22,44,${a})`); g.addColorStop(1, `rgba(40,34,74,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
// what the pen's line looks like from z0 to z1: thick close by, a hair far away, swelling where something is written
function drawLine(z0, z1, rgb, A, P = pathAt) {
  let run = [], wPrev = -1, aPrev = -1;
  const flush = () => { if (run.length > 1) { ctx.lineWidth = wPrev; ctx.lineCap = aPrev < 1 ? 'butt' : 'round'; ctx.strokeStyle = `rgba(${rgb},${aPrev})`; ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); for (let n2 = 1; n2 < run.length; n2++) ctx.lineTo(run[n2][0], run[n2][1]); ctx.stroke(); } };
  const wOf = P === seaPath ? () => 1 : P === spacePath ? () => 2 : worldOf;
  // (it ends exactly at z1, so whatever goes on from its end meets it)
  for (let z = Math.max(PEN.tale[0], camZ - 3, z0), end = false; !end; z += 0.03 / Math.max(1, Math.abs(baseOf(z + 0.01, wOf(z)) - baseOf(z, wOf(z))) * 50)) {
    if (z >= z1) { z = z1; end = true; }
    const p = V(P(z)); if (!p) continue;
    let sw = 1; for (const az of swellZ) sw += 0.8 * Math.exp(-Math.pow((z - az) / 0.35, 2));
    const wd = Math.round(clamp(2.3 * AHEAD / p[2], 0.5, 5) * sw * 4) / 4, al = Math.round(A * fogA(p[2]) * 20) / 20;
    if (wd !== wPrev || al !== aPrev) { const lastP = run[run.length - 1]; flush(); run = lastP ? [lastP] : []; wPrev = wd; aPrev = al; }
    run.push(p);
  }
  flush(); ctx.lineCap = 'round';
}
const near = (z, far = FAR3) => { const dz = z - camZ; return dz > 0.3 && dz < far; };
// the three worlds, each drawn whole from the same camera: 0 land, 1 sea, 2 space
const spaceFade = () => 1 - ease(clamp((penZ - (PEN.music[1] - 0.8)) / 0.7));
function backdrop(w, A) {
  if (w === 0) {
    // (paper at first; the sky's colour spreads in over the first stretch of the walk, as the land takes shape)
    const k = ease(clamp((penZ - 2.4) / 6)) * A;
    skyFill((e) => (e < 0.3 ? [mixA(HAZE, PASTEL.land.sky, clamp(e / 0.3)), e < 0 ? 0.5 * clamp(1 + e / 0.25) : lerp(0.5, 0.85, e / 0.3)] : [mixA(PASTEL.land.sky, ZEN, ease((e - 0.3) / 0.9)), lerp(0.85, 1, ease((e - 0.3) / 0.9))]), k);
    // deeper blue at the zenith, exactly as the water at the top of the dive is deeper straight below
    well(waterAt(0.12), 0.85 * k * clamp((camP - 0.6) / 0.6), false);
    // the sun, far away in one direction, so it only moves when the camera turns
    const sd = 1 * cP + 0.31 * sP; if (sd < 0.05) return;
    const sx = W / 2 + (0.39 * F3) / sd, sy = H * HZ + ((-0.31 * cP + sP) * F3) / sd, R = Math.min(W, H) * 0.045, gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 6);
    gl.addColorStop(0, `rgba(255,246,222,${0.7 * k})`); gl.addColorStop(1, 'rgba(255,246,222,0)'); ctx.fillStyle = gl; ctx.fillRect(sx - R * 6, sy - R * 6, R * 12, R * 12);
    ctx.fillStyle = `rgba(255,244,214,${0.95 * k})`; ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (w === 1) { seaBackdrop(A); return; }
  // night: deep indigo, nebulae of pastel light, the milky way far behind
  const d = A * spaceFade(); if (d <= 0) return; nightBackdrop(d);
    for (const nb of nebulae) {
      const q = V([nb.x, nb.y, nb.z]); if (!q || q[2] > FAR3 + 8) continue;
      // (a nebula gathers out of a drift of points before its light spreads)
      const fm = formAt((nb.z - penZ) / 2), R = nb.r * F3 / q[2], k = (0.25 + 0.75 * passed(nb.z - 6)) * fm.fill, gr = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R);
      dotsOn(ringPts(q[0], q[1], R * 0.45, 30), Math.max(0.25, fm.scatter), d * fm.dots, nb.c, nb.z * 3);
      gr.addColorStop(0, `rgba(${nb.c},${0.32 * k * d})`); gr.addColorStop(0.5, `rgba(${nb.c},${0.12 * k * d})`); gr.addColorStop(1, `rgba(${nb.c},0)`);
      ctx.fillStyle = gr; ctx.fillRect(q[0] - R, q[1] - R, 2 * R, 2 * R);
    }
    for (const m of milky) { const q = V([m.x, m.y, m.z]); if (!q) continue; ctx.fillStyle = `rgba(230,232,250,${(0.25 + 0.5 * m.s) * d * (reduce ? 0.8 : 0.75 + 0.25 * Math.sin(T * 2 + m.s * 40))})`; ctx.fillRect(q[0], q[1], 1.2, 1.2); }
    for (const b of bodies) {
      const q = V([b.x, b.y, b.z]); if (!q || q[2] < 0.6 || q[2] > FAR3) continue;
      const R = b.r * F3 / q[2], k = passed(b.z - 4), a0 = d * fogA(q[2]) * clamp(1 - (R - H * 0.1) / (H * 0.1)), fm = formAt((b.z - penZ) / 1.4), a = a0 * fm.fill;
      dotsOn(ringPts(q[0], q[1], R, 22), fm.scatter, a0 * fm.dots, '214,214,240', b.z * 10); lineOn(ringPts(q[0], q[1], R, 40), fm.line * (1 - fm.fill), `rgba(226,224,250,${0.7 * a0})`, 1.2, true, fm.fill);
      if (a <= 0.01) continue;
      ctx.fillStyle = tint(b.c, k, 0.95 * a); ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, Math.PI * 2); ctx.fill();
      if (b.kind === 'moon') { ctx.fillStyle = `rgba(22,25,50,${a})`; ctx.beginPath(); ctx.arc(q[0] + R * 0.42, q[1] - R * 0.18, R * 0.92, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(-0.38); ctx.strokeStyle = tint(b.c2, k, 0.9 * a); ctx.lineWidth = Math.max(1.5, R * 0.12); ctx.beginPath(); ctx.ellipse(0, 0, R * 1.9, R * 0.5, 0, Math.PI * 1.02, Math.PI * 1.98, true); ctx.stroke(); ctx.restore(); }
    }
    // now and then a shooting star
    if (!reduce) { const cyc = (T % 5.5) / 5.5, sx = W * (0.15 + ((Math.floor(T / 5.5) * 0.37) % 0.7)), sy = H * 0.12; if (cyc < 0.16) { const t2 = cyc / 0.16, x2 = sx + t2 * W * 0.22, y2 = sy + t2 * H * 0.12; const gl = ctx.createLinearGradient(x2 - W * 0.08, y2 - H * 0.045, x2, y2); gl.addColorStop(0, 'rgba(254,254,254,0)'); gl.addColorStop(1, `rgba(254,254,254,${0.85 * d * (1 - t2)})`); ctx.strokeStyle = gl; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x2 - W * 0.08, y2 - H * 0.045); ctx.lineTo(x2, y2); ctx.stroke(); } }
}
// the world's things between zLo and zHi (so what stands behind a gate can be drawn before it, the rest after)
function elements(w, A, zLo = -1e9, zHi = 1e9) {
  const inR = (z) => z >= zLo && z < zHi;
  if (w === 0) {
    const t = reduce ? 0 : T, kL = passed(2, 0);
    // far ranges: big and pale, bluer and hazier the farther, snow on the highest peaks
    for (const mt of mounts) {
      if (!near(mt.z, 40)) continue;
      const dz = mt.z - camZ, Q = mt.pts.map(V), first = Q[0], last = Q[Q.length - 1]; if (!first || !last) continue;
      const a = A * clamp((40 - dz) / 10), top = V([0, GROUND - mt.hMax, mt.z]), bot = V([0, GROUND, mt.z]);
      // (far off, so they form over the whole walk: points at first, the ridgeline drawn by its middle, filled near the end)
      const fm = formAt(lerp(6, -1.2, clamp((penZ - 2) / (CL0 - 4)))), kc = kL * fm.fill;
      dotsOn(Q, fm.scatter, a * fm.dots * 0.8, '150,160,190', mt.z);
      // (far off and large: a quiet outline, without the pen's ink running along it)
      lineOn(Q, fm.line, tint(mt.c, 0.5, 0.3 * a), 1, false, 1);
      if (fm.fill <= 0.01) continue;
      const g = ctx.createLinearGradient(0, top ? top[1] : 0, 0, bot ? bot[1] : H); g.addColorStop(0, tint(mt.c, kc, 0.75 * a * fm.fill)); g.addColorStop(1, tint(mt.c, kc, 0.12 * a * fm.fill));
      polyline(Q, Q.length); ctx.lineTo(last[0], H * 2); ctx.lineTo(first[0], H * 2); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.85 * a * fm.fill * (0.3 + 0.7 * kL)})`;
      for (const pk of mt.peaks) { const p0 = V(pk[0]), p1 = V(pk[1]), p2 = V(pk[2]); if (!p0 || !p1 || !p2) continue; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.fill(); }
    }
    for (const cl of clouds) {
      if (!near(cl.z)) continue;
      const dz = cl.z - camZ, fm = formAt((cl.z - penZ) / 1.6), k = passed(cl.z - 3), fa = fogA(dz) * A, Q = cl.pts.map((p) => V([p[0] + (reduce ? 0 : Math.sin(T * 0.08 + cl.ci) * 0.15), p[1], p[2]]));
      dotsOn(Q, fm.scatter, fa * fm.dots * 0.7, '170,176,200', cl.ci + 50);
      if (fm.fill > 0.01) { polyline(Q, Q.length); ctx.closePath(); ctx.fillStyle = tint(PASTEL.land.cloud, k, 0.8 * fm.fill * fa); ctx.fill(); }
      lineOn(Q, fm.line, tint(PASTEL.land.cloud, k * 0.4, 0.5 * fa), clamp(1.2 * AHEAD / dz, 0.5, 1.8), false, fm.fill);
    }
    // the hills, hazier with distance, with round trees on their ridges
    for (const r of ridges) {
      if (!near(r.z)) continue;
      const dz = r.z - camZ, fm = formAt((r.z - penZ) / 1.4);
      const Q = r.pts.map(V), k = passed(r.z - 4), haze = clamp(dz / 14) * 0.6, c = PASTEL.land.hill[r.k % 3].map((v, i) => lerp(v, PASTEL.land.sky[i], haze)), a = fogA(dz) * A;
      dotsOn(Q, fm.scatter, a * fm.dots * 0.75, '130,150,140', r.k + 100);
      if (fm.fill > 0.01 && Q[0] && Q[Q.length - 1]) { const first = Q[0], lastQ = Q[Q.length - 1]; polyline(Q, Q.length); ctx.lineTo(lastQ[0], H * 2); ctx.lineTo(first[0], H * 2); ctx.closePath(); ctx.fillStyle = tint(c, Math.max(k, fm.fill), 0.62 * fm.fill * a); ctx.fill(); }
      lineOn(Q, fm.line, tint([110, 140, 120], k, 0.5 * a), clamp(1.4 * AHEAD / dz, 0.5, 2), false, fm.fill);
      if (fm.line < 0.6) continue;
      const leaf = TREE.map((v, i) => lerp(v, PASTEL.land.sky[i], haze * 0.8)), wood = [170, 140, 120];
      for (const tr of r.trees) {
        const [x, y] = r.pts[tr.i], b0 = V([x, y + 0.02, r.z]), b1 = V([x, y - 0.12 * tr.s, r.z]), cc = V([x, y - 0.2 * tr.s, r.z]); if (!b0 || !b1 || !cc) continue;
        const R = 0.1 * tr.s * F3 / dz;
        ctx.strokeStyle = tint(wood, k, 0.8 * a); ctx.lineWidth = Math.max(1, R * 0.28); ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
        // (a ring first, then the round crown filling in)
        if (fm.fill < 0.99) lineOn(ringPts(cc[0], cc[1], R), 1, tint(leaf, k, 0.7 * a * (1 - fm.fill)), Math.max(1, R * 0.12), true);
        ctx.fillStyle = tint(leaf, k, 0.9 * a * fm.fill); ctx.beginPath(); ctx.arc(cc[0], cc[1], R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.22 * a * k * fm.fill})`; ctx.beginPath(); ctx.arc(cc[0] - R * 0.3, cc[1] - R * 0.3, R * 0.45, 0, Math.PI * 2); ctx.fill();
      }
    }
    // the other wires, crossarm to crossarm, sagging between the poles, drawn as far as the pen has gone
    const wireAt = (i, s, f) => { const t0 = pathAt(poles[i]), t1 = pathAt(poles[i + 1]); return [lerp(t0[0], t1[0], f) + s, lerp(t0[1], t1[1], f) + 0.07 + 0.16 * 4 * f * (1 - f), lerp(poles[i], poles[i + 1], f)]; };
    for (let i = 0; i + 1 < poles.length; i++) {
      if (penZ < poles[i]) continue;
      const fMax = clamp((penZ - poles[i]) / (poles[i + 1] - poles[i])), k = passed(poles[i]);
      for (const s of [-0.2, 0.2]) {
        const Q = []; for (let n = 0; n <= 20; n++) { const p = wireAt(i, s, (n / 20) * fMax); Q.push(p[2] - camZ > 0.2 ? V(p) : null); }
        const mid = wireAt(i, s, 0.5), dz = Math.max(0.3, mid[2] - camZ);
        ctx.strokeStyle = tint([120, 126, 146], k, 0.55 * fogA(dz) * A); ctx.lineWidth = clamp(1 * AHEAD / dz, 0.5, 1.6); polyline(Q, Q.length); ctx.stroke();
      }
    }
    for (const z of poles) {
      if (!near(z)) continue; const dz = z - camZ;
      if (penZ < z) { const top = pathAt(z), fm = formAt((z - penZ) / 1.2), col = []; for (let n = 0; n <= 10; n++) col.push(V([top[0], lerp(top[1], GROUND + 0.05, n / 10), z])); dotsOn(col, fm.scatter, 0.8 * fogA(dz) * A * fm.dots, '150,140,130', z * 10); continue; }
      const top = pathAt(z), a = V(top), b = V([top[0], GROUND + 0.05, z]), ca = V([top[0] - 0.26, top[1] + 0.1, z]), cb = V([top[0] + 0.26, top[1] + 0.1, z]);
      if (!a || !b) continue;
      const k = passed(z), al = 0.85 * fogA(dz) * A;
      ctx.strokeStyle = tint(PASTEL.land.pole, k, al); ctx.lineWidth = clamp(2.8 * AHEAD / dz, 0.8, 5.5); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      if (ca && cb) { ctx.lineWidth = clamp(1.8 * AHEAD / dz, 0.6, 3.5); ctx.beginPath(); ctx.moveTo(ca[0], ca[1]); ctx.lineTo(cb[0], cb[1]); ctx.stroke(); }
      ctx.fillStyle = tint([206, 220, 232], k, al);
      for (const s of [-0.2, 0.2]) { const ins = V([top[0] + s, top[1] + 0.06, z]); if (ins) { ctx.beginPath(); ctx.arc(ins[0], ins[1], clamp(0.03 * F3 / dz, 1, 4.5), 0, Math.PI * 2); ctx.fill(); } }
    }
    // birds on the wires, which take off as the camera comes near
    for (const bd of birds) {
      const p = wireAt(bd.i, bd.s, bd.f); if (penZ < p[2]) continue;
      const fly = reduce ? 0 : clamp((camZ - (p[2] - 2.4)) / 1.4), q = V([p[0] + fly * 1.5 * bd.dir, p[1] - fly * 1.8, p[2] + fly * 0.7]); if (!q || q[2] > FAR3) continue;
      const L = 0.04 * F3 / q[2], a = fogA(q[2]) * A * (1 - clamp((fly - 0.75) / 0.25)); if (a <= 0.02) continue;
      ctx.fillStyle = ctx.strokeStyle = tint([92, 100, 124], passed(p[2]), 0.9 * a);
      if (fly <= 0) { ctx.beginPath(); ctx.ellipse(q[0], q[1] - L * 0.55, L * 0.75, L * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(q[0] + bd.dir * L * 0.6, q[1] - L * 1.05, L * 0.32, 0, Math.PI * 2); ctx.fill(); }
      else { const fl = Math.sin(t * 14 + bd.ph) * 0.6; ctx.lineWidth = Math.max(1, L * 0.22); ctx.beginPath(); ctx.moveTo(q[0] - L * 1.3, q[1] - L * fl); ctx.quadraticCurveTo(q[0] - L * 0.4, q[1] - L * 0.5, q[0], q[1]); ctx.quadraticCurveTo(q[0] + L * 0.4, q[1] - L * 0.5, q[0] + L * 1.3, q[1] - L * fl); ctx.stroke(); }
    }
    // grass in tufts, some with a flower
    for (const g of grass) {
      if (!near(g.z, 10) || penZ < g.z) continue;
      const dz = g.z - camZ, k = passed(g.z), sw = reduce ? 0 : Math.sin(t * 1.8 + g.z * 3) * 0.012, al = 0.7 * A * clamp((dz - 0.3) / 0.6);
      ctx.strokeStyle = tint(PASTEL.land.grass, k, al); ctx.lineWidth = clamp(1.3 * AHEAD / dz, 0.6, 2.4); ctx.beginPath();
      for (const b of g.blades) { const base = V([g.x + b.dx, GROUND, g.z]), mid = V([g.x + b.dx + b.lean * 0.3, GROUND - b.h * 0.55, g.z]), tip = V([g.x + b.dx + b.lean + sw, GROUND - b.h, g.z]); if (!base || !mid || !tip) continue; ctx.moveTo(base[0], base[1]); ctx.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); }
      ctx.stroke();
      if (g.flower) { const b = g.blades[2], f = V([g.x + b.dx + b.lean + sw, GROUND - b.h - 0.012, g.z]); if (f) { ctx.fillStyle = tint(FLOWER[g.flower - 1], k, al / 0.7); ctx.beginPath(); ctx.arc(f[0], f[1], clamp(0.024 * F3 / dz, 1.2, 5), 0, Math.PI * 2); ctx.fill(); } }
    }
    return;
  }
  if (w === 1) { seaElements(A); return; }
  spaceElements(A, inR);
}
// the sea seen straight down the fishing line: what is near passes outwards, what is deep waits in the middle
function seaElements(A) {
  const t = reduce ? 0 : T, dk = depthK(), inSea = ease((penZ - ZS) / 0.6) * A, ahead = (y) => y > camY - 1 && y < camY + FAR3;
  if (inSea <= 0) return;
  // (how far below the hook a thing is, in the measure formAt takes: things form as the hook sinks to them)
  const hookY = seaPath(penZ)[1], formY = (y) => formAt((y - hookY) / 2.2);
  // light from above, running down past the camera and meeting far below
  const lit = inSea * clamp(1 - dk / 0.32);
  if (lit > 0) for (const sh of shafts) {
    const y0 = Math.max(0, camY + 0.4), y1 = y0 + 22, dx = sh.x - camX, dz = sh.z - camZ, r = Math.hypot(dx, dz) || 1, ox = (-dz / r) * sh.w, oz = (dx / r) * sh.w;
    const q = [V([sh.x - ox, y0, sh.z - oz]), V([sh.x + ox, y0, sh.z + oz]), V([sh.x + ox, y1, sh.z + oz]), V([sh.x - ox, y1, sh.z - oz])]; if (q.some((v) => !v)) continue;
    const gr = ctx.createLinearGradient((q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2, (q[2][0] + q[3][0]) / 2, (q[2][1] + q[3][1]) / 2);
    gr.addColorStop(0, `rgba(255,255,255,${(0.32 + 0.1 * Math.sin(t * 0.7 + sh.ph)) * lit})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let n = 1; n < 4; n++) ctx.lineTo(q[n][0], q[n][1]); ctx.closePath(); ctx.fill();
  }
  // in the shallows, the sunlight through the waves makes a net of light that wavers, layer under layer (the
  // two nearest layers a little way ahead, two families of wavy lines crossing; each layer one path, one stroke)
  const net = inSea * clamp(1 - dk / 0.16);
  if (net > 0) {
    ctx.lineWidth = 1; let drawn = 0;
    for (let li = 1; li <= 7 && drawn < 2; li++) {
      const y = li * 6, d = y - camY; if (d < 6 || d > 20) continue;
      const al = net * 0.4 * clamp((d - 6) / 3) * clamp((20 - d) / 6); if (al < 0.01) continue;
      drawn++;
      const zc = zOfDepth(y), cx = xAt(zc);
      ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.beginPath();
      for (let f = 0; f < 2; f++) {
        const an = f * 1.15 + li * 0.4, dx = Math.cos(an), dz = Math.sin(an);
        for (let i = -5; i <= 5; i++) {
          let pen = false;
          for (let a = -6.4; a <= 6.41; a += 0.8) {
            const o = i * 1.1 + 0.3 * Math.sin(a * 1.3 + t * 0.9 + i * 1.7 + f * 2.1), px = a * dx - o * dz, pz = a * dz + o * dx;
            const q = px * px + pz * pz < 40 ? V([cx + px, y, zc + pz]) : null;
            if (!q) { pen = false; continue; } if (pen) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); pen = true; }
          }
        }
      }
      ctx.stroke();
    }
  }
  // a kelp forest: long stalks out of the deep, swaying, blades along them, all leading down to the middle
  // (each stalk one ribbon, its blades one path)
  for (const k of kelps) {
    const y0 = Math.max(-1, camY + 0.45), y1 = Math.min(k.y1, camY + FAR3); if (y0 >= y1) continue;
    const col = KELPC[k.c], at = (y) => [k.x + Math.sin(y * 0.18 + t * 0.8 + k.ph) * 0.3, y, k.z + Math.cos(y * 0.15 + t * 0.7 + k.ph) * 0.2];
    const P = [], Py = []; for (let y = y0; y <= y1; y += 0.8) { const q = V(at(y)); if (q) { P.push(q); Py.push(y); } }
    if (P.length < 2) continue;
    // (whole down to a little below the hook, a drawn stalk further down, points beyond)
    const nFill = Py.filter((y) => formY(y).fill > 0.5).length, nLine = Py.filter((y) => formY(y).line > 0.3).length;
    { const fa0 = fogA(P[0][2]) * inSea; dotsOn(P.slice(nLine), 0.35, 0.8 * fa0, KELPC[k.c], k.ph * 100); if (nLine > nFill) lineOn(P.slice(Math.max(0, nFill - 1), nLine), 1, `rgba(${KELPC[k.c]},${0.6 * fa0})`, 1.2, false, 0); }
    if (nFill < 2) continue;
    P.length = nFill; const yEnd = Py[nFill - 1];
    const Lft = [], Rgt = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], nx = -(b[1] - a[1]), ny = b[0] - a[0], n = Math.hypot(nx, ny) || 1, w = clamp((0.07 * F3) / P[i][2], 0.7, 14) / 2;
      Lft.push([P[i][0] + (nx / n) * w, P[i][1] + (ny / n) * w]); Rgt.push([P[i][0] - (nx / n) * w, P[i][1] - (ny / n) * w]);
    }
    const fa = fogA(P[P.length - 1][2]) * 0.35 + 0.65 * fogA(P[0][2]);
    ctx.fillStyle = `rgba(${col},${0.85 * inSea * fa})`; ctx.beginPath(); ctx.moveTo(Lft[0][0], Lft[0][1]);
    for (const q of Lft) ctx.lineTo(q[0], q[1]); for (let i = Rgt.length - 1; i >= 0; i--) ctx.lineTo(Rgt[i][0], Rgt[i][1]); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(${col},${0.7 * inSea * fa})`; ctx.beginPath();
    for (let y = Math.ceil(y0 / k.gap) * k.gap, n = 0; y < yEnd; y += k.gap, n++) {
      const b = at(y), q = V(b); if (!q) continue; const r = Math.hypot(b[0] - camX, b[2] - camZ) || 1, side = n % 2 ? 1 : -1, ox = ((b[0] - camX) / r) * 0.5 + side * ((b[2] - camZ) / r) * 0.25, oz = ((b[2] - camZ) / r) * 0.5 - side * ((b[0] - camX) / r) * 0.25;
      const tp = V([b[0] + ox, y + 0.35, b[2] + oz]); if (!tp) continue;
      const mx = (q[0] + tp[0]) / 2, my = (q[1] + tp[1]) / 2, nx = -(tp[1] - q[1]) * 0.28, ny = (tp[0] - q[0]) * 0.28;
      ctx.moveTo(q[0], q[1]); ctx.quadraticCurveTo(mx + nx, my + ny, tp[0], tp[1]); ctx.quadraticCurveTo(mx - nx, my - ny, q[0], q[1]);
    }
    ctx.fill();
  }
  // specks drifting in the water, and in the dark, plankton glowing
  ctx.fillStyle = 'rgb(255,255,255)';
  for (const sn of snow) {
    const p = sn.p; if (!ahead(p[1])) continue; const q = V([p[0] + Math.sin(t * 0.4 + sn.ph * 6) * 0.05, p[1] + ((sn.ph + t * 0.02) % 1) * 0.5, p[2]]); if (!q) continue;
    const r = clamp(1.5 * AHEAD / q[2], 0.6, 2.4); ctx.globalAlpha = inSea * fogA(q[2]) * (0.35 + 0.35 * clamp(dk / 0.5)); ctx.fillRect(q[0], q[1], r, r);
  }
  ctx.globalAlpha = 1;
  for (const g of glows) {
    const p = g.p; if (!ahead(p[1])) continue; const q = V(p); if (!q) continue;
    const a = inSea * fogA(q[2]) * clamp((dk - 0.45) / 0.2) * (reduce ? 0.7 : 0.45 + 0.55 * Math.sin(t * 1.7 + g.s * 40)); if (a < 0.03) continue;
    const r = clamp(2.4 * AHEAD / q[2], 0.8, 3.4); ctx.fillStyle = `rgba(${GLOW[g.c]},${a})`; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill();
  }
  // jellyfish from above: a round bell, its tentacles hanging down (towards the middle), glowing in the dark
  for (const j of jellies) {
    const p = j.p; if (!ahead(p[1])) continue; const yb = p[1] + Math.sin(t * 0.9 + j.ph) * 0.08, q = V([p[0], yb, p[2]]); if (!q) continue;
    const R = (j.r * F3) / q[2], a0 = fogA(q[2]) * inSea, c = JELLY[j.c], pl = 1 + 0.08 * Math.sin(t * 2 + j.ph); if (R > W) continue;
    // (points round where its bell will be, then its rim, then the jellyfish itself)
    const fm = formY(yb), a = a0 * fm.fill;
    dotsOn(ringPts(q[0], q[1], R, 10), fm.scatter, a0 * fm.dots, c, j.ph * 50); lineOn(ringPts(q[0], q[1], R, 24), fm.line * (1 - fm.fill), `rgba(${c},${0.6 * a0})`, 1, true, fm.fill);
    if (a <= 0.01) continue;
    if (dk > 0.4) { const gl = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R * 3); gl.addColorStop(0, `rgba(${c},${0.45 * clamp((dk - 0.4) / 0.3) * a})`); gl.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gl; ctx.fillRect(q[0] - R * 3, q[1] - R * 3, R * 6, R * 6); }
    ctx.strokeStyle = `rgba(${c},${0.55 * a})`; ctx.lineWidth = clamp(R * 0.07, 0.6, 2);
    for (let n = 0; n < 8; n++) { const an = (n / 8) * Math.PI * 2 + j.ph, e0 = V([p[0] + Math.cos(an) * j.r * 0.7, yb, p[2] + Math.sin(an) * j.r * 0.7]), e1 = V([p[0] + Math.cos(an) * j.r * 0.5 + Math.sin(t * 2 + n) * 0.03, yb + j.r * 5, p[2] + Math.sin(an) * j.r * 0.5]); if (!e0 || !e1) continue; ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.stroke(); }
    ctx.fillStyle = `rgba(${c},${0.8 * a})`; ctx.beginPath(); ctx.arc(q[0], q[1], R * pl, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * a})`; ctx.lineWidth = Math.max(1, R * 0.08); ctx.beginPath(); ctx.arc(q[0], q[1], R * pl * 0.55, 0, Math.PI * 2); ctx.stroke();
  }
  // a whale crossing slowly far below, seen from above
  if (whale && ahead(whale.c[1])) {
    const an = whale.h + t * 0.04, R = 6, wx = whale.c[0] + Math.cos(an) * R, wz = whale.c[2] + Math.sin(an) * R, hx = -Math.sin(an), hz = Math.cos(an), L = whale.L, wy = whale.c[1];
    const P = (u, v) => V([wx + hx * u * L - hz * v * L, wy, wz + hz * u * L + hx * v * L]);
    const body = [[0.5, 0], [0.46, 0.06], [0.32, 0.1], [0.12, 0.115], [-0.1, 0.095], [-0.3, 0.055], [-0.44, 0.022], [-0.47, 0.018]];
    const flap = reduce ? 0 : Math.sin(t * 0.9) * 0.04, out = [...body.map(([u, v]) => P(u, v)), P(-0.56, 0.14 + flap), P(-0.52, 0), P(-0.56, -0.14 + flap), ...body.slice().reverse().map(([u, v]) => P(u, -v))];
    const fins = [[P(0.2, 0.11), P(-0.02, 0.36 + flap), P(0.1, 0.115)], [P(0.2, -0.11), P(-0.02, -0.36 - flap), P(0.1, -0.115)]];
    const q = V([wx, wy, wz]);
    if (q && out.every(Boolean)) {
      const fm = formY(wy), a0 = fogA(q[2]) * inSea * 0.9, a = a0 * fm.fill;
      dotsOn(out, fm.scatter, a0 * fm.dots, '58,84,132', 7); lineOn(out, fm.line * (1 - fm.fill), `rgba(58,84,132,${0.6 * a0})`, 1.2, true, fm.fill);
      ctx.fillStyle = `rgba(58,84,132,${a})`; ctx.beginPath(); ctx.moveTo(out[0][0], out[0][1]); for (const o of out.slice(1)) ctx.lineTo(o[0], o[1]); ctx.closePath(); ctx.fill();
      for (const fn of fins) if (fn.every(Boolean)) { ctx.beginPath(); ctx.moveTo(fn[0][0], fn[0][1]); ctx.quadraticCurveTo(fn[1][0], fn[1][1], fn[2][0], fn[2][1]); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`;
      for (const [u, v] of [[0.3, 0.03], [0.18, -0.05], [0.05, 0.04], [-0.1, -0.02], [-0.22, 0.03]]) { const sp = P(u, v); if (sp) { ctx.beginPath(); ctx.arc(sp[0], sp[1], Math.max(1, (0.12 * F3) / q[2]), 0, Math.PI * 2); ctx.fill(); } }
    }
  }
  // rays gliding round the line, seen from above
  for (const m of mantas) {
    if (!ahead(m.c[1])) continue; const an = m.ph + m.dir * t * 0.12, cx = m.c[0] + Math.cos(an) * m.R, cz = m.c[2] + Math.sin(an) * m.R, hx = -Math.sin(an) * m.dir, hz = Math.cos(an) * m.dir;
    const flap = 1 + (reduce ? 0 : 0.14 * Math.sin(t * 1.6 + m.ph)), s = m.s, P = (f, sd) => V([cx + hx * f * s + -hz * sd * s * flap, m.c[1] + Math.abs(sd) * 0.08, cz + hz * f * s + hx * sd * s * flap]);
    const nose = P(0.5, 0), lw = P(-0.05, 0.75), rw = P(-0.05, -0.75), back = P(-0.42, 0), tail = P(-1.2, 0), q = V([cx, m.c[1], cz]); if (!nose || !lw || !rw || !back || !tail || !q) continue;
    const fm = formY(m.c[1]), a0 = fogA(q[2]) * inSea, a = a0 * fm.fill, edge = [nose, lw, back, rw, nose];
    dotsOn(edge, fm.scatter, a0 * fm.dots, '74,96,140', m.ph * 30); lineOn(edge, fm.line * (1 - fm.fill), `rgba(74,96,140,${0.6 * a0})`, 1.2, true, fm.fill);
    if (a <= 0.01) continue;
    ctx.fillStyle = `rgba(74,96,140,${0.85 * a})`; ctx.beginPath(); ctx.moveTo(nose[0], nose[1]); ctx.quadraticCurveTo((nose[0] + lw[0]) / 2 + (lw[0] - back[0]) * 0.15, (nose[1] + lw[1]) / 2 + (lw[1] - back[1]) * 0.15, lw[0], lw[1]); ctx.quadraticCurveTo((lw[0] + back[0]) / 2, (lw[1] + back[1]) / 2, back[0], back[1]); ctx.quadraticCurveTo((rw[0] + back[0]) / 2, (rw[1] + back[1]) / 2, rw[0], rw[1]); ctx.quadraticCurveTo((nose[0] + rw[0]) / 2 + (rw[0] - back[0]) * 0.15, (nose[1] + rw[1]) / 2 + (rw[1] - back[1]) * 0.15, nose[0], nose[1]); ctx.fill();
    ctx.strokeStyle = `rgba(74,96,140,${0.85 * a})`; ctx.lineWidth = Math.max(1, (0.03 * F3) / q[2]); ctx.beginPath(); ctx.moveTo(back[0], back[1]); ctx.lineTo(tail[0], tail[1]); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`; ctx.beginPath(); ctx.arc((nose[0] + back[0]) / 2, (nose[1] + back[1]) / 2, (0.08 * s * F3) / q[2], 0, Math.PI * 2); ctx.fill();
  }
  // fish circling the line in schools, seen from above
  for (const f of fish) {
    if (!ahead(f.y)) continue; const an = f.ph + f.dir * t * f.w, x = f.c[0] + Math.cos(an) * f.R, z = f.c[2] + Math.sin(an) * f.R, hx = -Math.sin(an) * f.dir, hz = Math.cos(an) * f.dir;
    const h = V([x + hx * f.sz, f.y, z + hz * f.sz]), tl = V([x - hx * f.sz, f.y, z - hz * f.sz]); if (!h || !tl) continue;
    const fm = formY(f.y), L = Math.hypot(h[0] - tl[0], h[1] - tl[1]) / 2, a0 = fogA(h[2]) * inSea * (1 - 0.5 * dk), a = a0 * fm.fill; if (L < 0.4 || L > W) continue;
    if (fm.fill < 0.05) { ctx.fillStyle = `rgba(${FISHC[f.col]},${0.7 * a0 * fm.dots})`; ctx.fillRect((h[0] + tl[0]) / 2 - 1, (h[1] + tl[1]) / 2 - 1, 2, 2); continue; }
    const ang = Math.atan2(h[1] - tl[1], h[0] - tl[0]), mx = (h[0] + tl[0]) / 2, my = (h[1] + tl[1]) / 2, wig = reduce ? 0 : Math.sin(t * 9 + f.ph * 7) * 0.3;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.fillStyle = `rgba(${FISHC[f.col]},${0.9 * a})`;
    ctx.beginPath(); ctx.ellipse(0, 0, L, L * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-L * 0.8, 0); ctx.lineTo(-L * 1.5, -L * (0.42 + wig * 0.3)); ctx.lineTo(-L * 1.5, L * (0.42 - wig * 0.3)); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // bubbles rising past the camera
  for (const b of bubbles) {
    const p = b.p, y = p[1] - (((b.off + t * 0.05 * b.v) % 1) * 6); if (!ahead(y)) continue; const q = V([p[0] + Math.sin(t + b.off * 9) * 0.04, y, p[2]]); if (!q) continue;
    const r = (b.r * F3) / q[2], a = fogA(q[2]) * inSea; if (r > W * 0.4) continue;
    ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`; ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`; ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.7 * a})`; ctx.beginPath(); ctx.arc(q[0] - r * 0.35, q[1] - r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.fill();
  }
  // the jellyfish of light each message of the sea is set on: the line threads through the middle of its bell; pale
  // until the hook reaches it, then it lights up in its own colour and stays lit, glowing more in the dark
  OBJ.sea.forEach((sz, i) => {
    const c = seaPath(sz), q = V(c); if (!q || !ahead(c[1])) return;
    const lit = ease(clamp((penZ - sz) / 0.35)), R = (0.32 * F3) / q[2], col = SETC[i % 4], pl = 1 + (reduce ? 0 : 0.05 * Math.sin(t * 1.8 + i));
    if (R > W * 1.5) return;
    const a = inSea * fogA(q[2]) * clamp((q[2] - 0.6) / 1.2);
    if (lit > 0) { const gl = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R * 3.2); gl.addColorStop(0, `rgba(${col},${(0.35 + 0.35 * dk) * lit * a})`); gl.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = gl; ctx.fillRect(q[0] - R * 3.2, q[1] - R * 3.2, R * 6.4, R * 6.4); }
    // tentacles hanging down, which seen from above run in towards the middle
    ctx.strokeStyle = lit > 0 ? `rgba(${col},${(0.4 + 0.4 * lit) * a})` : `rgba(255,255,255,${0.45 * a})`; ctx.lineWidth = clamp(R * 0.05, 0.8, 2.5);
    for (let n = 0; n < 12; n++) { const an = (n / 12) * Math.PI * 2 + i, e0 = V([c[0] + Math.cos(an) * 0.25, c[1], c[2] + Math.sin(an) * 0.25]), e1 = V([c[0] + Math.cos(an) * 0.13 + Math.sin(t * 1.6 + n) * 0.03, c[1] + 2.4, c[2] + Math.sin(an) * 0.13]); if (!e0 || !e1) continue; ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.stroke(); }
    // the bell: a soft disc, a rim, and an inner ring around the line
    ctx.fillStyle = lit > 0 ? `rgba(${col},${(0.3 + 0.35 * lit) * a})` : `rgba(255,255,255,${0.16 * a})`; ctx.beginPath(); ctx.arc(q[0], q[1], R * pl, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = lit > 0 ? `rgba(255,255,255,${(0.5 + 0.4 * lit) * a})` : `rgba(255,255,255,${0.6 * a})`; ctx.lineWidth = clamp(R * 0.06, 1, 3); ctx.stroke();
    ctx.beginPath(); ctx.arc(q[0], q[1], R * 0.45 * pl, 0, Math.PI * 2); ctx.stroke();
  });
  // a thin stream of bubbles going up from the hook
  const tip = seaPath(penZ);
  for (let i = 0; i < 16; i++) {
    const ph = reduce ? i / 16 : (t * 0.45 + i / 16) % 1, q = V([tip[0] + Math.sin(i * 2.3 + t * 2) * 0.05 * ph, tip[1] - ph * 3.6, tip[2] + Math.cos(i * 1.7 + t * 2) * 0.05 * ph]); if (!q) continue;
    const r = clamp(((0.012 + 0.022 * ph) * F3) / q[2], 1, 9), a = inSea * (1 - ph) * 0.9;
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.stroke();
  }
}
function spaceElements(A, inR) {
  // space: stars all around; the stars of the constellation are where the line turns
  for (const st of stars) {
    if (!inR(st.z) || !near(st.z, 20) || penZ < st.z - 12) continue;
    const q = V([st.x, st.y, st.z]); if (!q) continue;
    const k = passed(st.z - 2), a = A * fogA(q[2]) * clamp((penZ - (st.z - 12)) / 2) * (reduce ? 0.7 : 0.6 + 0.3 * Math.sin(T * 1.4 + st.s * 30));
    const r = clamp(2.2 * AHEAD / q[2], 0.7, 3.2), col = k > 0.05 ? tint(PASTEL.space.star[st.c], k, a) : `rgba(200,204,222,${0.6 * a})`;
    if (st.sparkle) { const L = r * 3; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q[0] - L, q[1]); ctx.lineTo(q[0] + L, q[1]); ctx.moveTo(q[0], q[1] - L); ctx.lineTo(q[0], q[1] + L); ctx.stroke(); }
    else { ctx.fillStyle = col; ctx.fillRect(q[0] - r / 2, q[1] - r / 2, r, r); }
  }
  for (let i = 0; i < STARS.length; i++) {
    const sp = STARS[i]; if (!inR(sp[2]) || sp[2] > TAIL || !near(sp[2]) || penZ < sp[2] - 10) continue;
    const q = V(sp); if (!q) continue;
    const k = passed(sp[2], 0), lit = penZ >= sp[2], a = A * fogA(q[2]), R = clamp(0.07 * F3 / q[2], 3, 14) * (lit ? 1.3 : 1);
    const col = lit ? tint(PASTEL.space.star[i % 3], Math.max(0.6, k), a) : `rgba(200,204,222,${0.45 * a})`;
    ctx.fillStyle = col; ctx.beginPath();
    for (let j = 0; j < 8; j++) { const an = (j / 8) * Math.PI * 2 - Math.PI / 2, rr = j % 2 ? R * 0.38 : R; ctx.lineTo(q[0] + Math.cos(an) * rr, q[1] + Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
    if (lit) { const gl = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R * 3); gl.addColorStop(0, tint(PASTEL.space.star[i % 3], 1, 0.35 * a)); gl.addColorStop(1, tint(PASTEL.space.star[i % 3], 1, 0)); ctx.fillStyle = gl; ctx.fillRect(q[0] - R * 3, q[1] - R * 3, R * 6, R * 6); }
  }
}
