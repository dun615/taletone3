/* ---- one world in depth. The pen draws a single line forward through it and the camera follows the pen,
   a few steps behind. Hills, poles, the wire, grass and clouds stand along the way. At the end the same line
   coils around the view, and in the next chapter it splits into the five lines of the staff. ---- */
const pinned = WORKS.filter((w) => w.pinned).sort((a, b) => a.pinned - b.pinned);
Promise.all(pinned.map(sample)).then(() => { palette = pinned.map((w, i) => ({ slug: w.slug, c: colorOf[w.slug], s: 1 - i * 0.1 })).filter((p) => p.c); });
// three worlds along one line, a gate (a phone's screen) between them: the land of the intro (mountains,
// grass, poles and the wire), the sea of the philosophy (the line dives in like a fishing line) and the space
// of the real project (the line joins star to star). Everything starts pale and colourless; what the pen has
// passed slowly takes on a pastel colour.
// the land ends where the line lifts off the last pole and swings up into the sky (from CL0, CLH high at ZS); the
// land's round stops short of it, so it is only seen ahead. In the sea the line is a fishing line going straight
// down into the deep (DD in all), past bubbles, fish, rays and jellyfish, darker and darker; space opens at S0.
// The worlds are reached through a phone (58-stage-phone-passage), never by riding the line from one into the next.
// Each world has one kind of thing along its line: poles on the land (the line rests on their tops), jellyfish of
// light in the sea (the line threads through them and they light up), stars in space (the line turns at them).
const CLH = 40, CLX = 2.6, DD = 232, YS = 7.25, YB = 7;
const WIRE = [OBJ.land[0], OBJ.land[7]], POLE = 1.8, GROUND = 1.35, AHEAD = 4.2, FAR3 = 26, TAIL = PEN.music[1] - 2.5;
const PASTEL = { land: { sky: [214, 233, 246], hill: [[190, 222, 199], [214, 230, 186], [200, 214, 236]], grass: [140, 190, 150], pole: [196, 170, 150], cloud: [250, 226, 236] },
  space: { sky: [226, 220, 245], star: [[252, 232, 170], [246, 196, 222], [196, 214, 250]] } };
const tint = (c, k, a) => `rgba(${Math.round(lerp(150, c[0], k))},${Math.round(lerp(152, c[1], k))},${Math.round(lerp(160, c[2], k))},${a})`;
const passed = (z, lag = 0.4) => ease(clamp((penZ - z - lag) / 2.6)); // 0 pale, 1 fully coloured
const penAt = (u) => { for (const k of ['music', 'case', 'tone', 'tale']) { const l = local(u, k); if (l > 0) return lerp(PEN[k][0], PEN[k][1], clamp(k === 'tale' ? (l - 0.08) / 0.92 : l)); } return PEN.tale[0]; };
const wireW = (z) => clamp((z - WIRE[0] + 0.8) / 0.8) * clamp((WIRE[1] + 0.8 - z) / 0.8);
// the end of the constellation: the line leaves the last star for the head of the staff (set in buildCurrent),
// where it splits in five and draws the record's staff
const climbK = (z) => clamp((z - CL0) / (ZS - CL0));
// which world a point of the line is in (0 the land, 1 the sea, 2 space), and how high the line runs there without
// its small waves: climbing on the land, straight down in the sea (straight up out of it before ZS), level in space
const worldOf = (z) => (z < ZS ? 0 : z < S0 ? 1 : 2);
// the dive goes down at an even pace (the sea runs by itself behind its words: nothing to slow down for),
// depth = DD * dive(z), dive rising from 0 at ZS to 1 at S0
const dive = (z) => clamp((z - ZS) / (S0 - ZS));
const SL0 = DD / (S0 - ZS), SL1 = SL0;
const seaY = (z) => (z < ZS ? SL0 * (z - ZS) : z > S0 ? DD + SL1 * (z - S0) : DD * dive(z));
// where along the dive the line is y deep
const zOfDepth = (y) => { if (y <= 0) return ZS + y / SL0; if (y >= DD) return S0 + (y - DD) / SL1; let lo = ZS, hi = S0; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (seaY(m) < y) lo = m; else hi = m; } return (lo + hi) / 2; };
const baseOf = (z, w) => (w === 0 ? -CLH * Math.pow(climbK(z), CLX) : w === 1 ? seaY(z) : YB);
const xAt = (z) => -0.35 + 0.5 * Math.sin(z * 0.33) + 0.15 * Math.sin(z * 0.91 + 1.2);
// how deep the camera is in the sea: 0 at the top, 1 at the bottom where space opens
const depthK = () => clamp(camY / DD);
const spaceIn = () => (penZ >= S0 ? 1 : 0);
const tailK = (z) => ease((z - TAIL) / (PEN.music[1] - TAIL));
// tail.T: the staff's head on screen, tail.tg: the way the staff leaves it (both from the final camera)
let tail = { T: [0, 0], tg: [1, 0], L: 0 };
function tailAt(z) {
  const cz = PEN.music[1] - AHEAD, s = clamp((z - TAIL) / (PEN.music[1] - TAIL)), d = Math.max(0.2, z - cz) / F3;
  return [(tail.T[0] - tail.tg[0] * tail.L * (1 - s) - W / 2) * d, (tail.T[1] - tail.tg[1] * tail.L * (1 - s) - H * HZ) * d + YS];
}
// the constellation: stars at fixed points, the line runs straight from one to the next
// (the stars of the case's messages at SET.space; others before and after)
const STARS = (() => { let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); const zs = [S0 + 1.2, S0 + 2.85, ...OBJ.space]; for (let z = OBJ.space[7] + 1.7; z < PEN.music[1] + 1; z += 1.5 + r() * 0.5) zs.push(z); return zs.map((z) => [-0.4 + (r() - 0.5) * 1.6, YS - 0.55 + (r() - 0.5) * 1.1, z]); })();
function constAt(z) {
  if (z <= STARS[0][2]) return STARS[0];
  for (let i = 1; i < STARS.length; i++) if (z <= STARS[i][2]) { const a = STARS[i - 1], b = STARS[i], f = (z - a[2]) / (b[2] - a[2]); return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), z]; }
  return STARS[STARS.length - 1];
}
function pathAt(z, w = worldOf(z)) {
  let x = xAt(z), y = 0.35 + 0.16 * Math.sin(z * 0.47);
  if (w === 0) {
    const ww = wireW(z);
    if (ww > 0) { let f = ((z - WIRE[0]) / POLE) % 1; if (f < 0) f += 1; y = lerp(y, -0.55 + 0.2 * 4 * f * (1 - f), ww); }
    // off the last pole and up into the sky
    if (z > CL0) y = -0.55 + baseOf(z, 0);
  } else if (w === 1) {
    // the fishing line, straight down
    y = baseOf(z, 1);
  } else {
    // space: level, then from star to star
    y = YS - 0.55;
    const ck2 = ease((z - S0) / 2.6);
    if (ck2 > 0) { const c = constAt(z); x = lerp(x, c[0], ck2); y = lerp(y, c[1], ck2); }
    // aimed in screen terms: from the last star the line swings onto the way the staff leaves, and comes in along it
    const tk = ease((z - TAIL) / 2.1);
    if (tk > 0) { const t2 = tailAt(z); x = lerp(x, t2[0], tk); y = lerp(y, t2[1], tk); }
  }
  return [x, y, z];
}
// the line as the sea and as space have it, before and after their own stretch too
const seaPath = (z) => pathAt(z, 1), spacePath = (z) => pathAt(z, 2);
let penZ = PEN.tale[0], camX = 0, camY = 0, camZ = -1, camP = 0, cP = 1, sP = 0, F3 = 800;
// the camera looks along +z, tilted up by camP (down when negative); y runs downward
const setCam = (c) => { camX = c.x; camY = c.y; camZ = c.z; camP = c.p; cP = Math.cos(c.p); sP = Math.sin(c.p); };
const getCam = () => ({ x: camX, y: camY, z: camZ, p: camP });
const V = (p) => { const rx = p[0] - camX, ry = p[1] - camY, rz = p[2] - camZ, d = rz * cP - ry * sP; if (d < 0.12) return null; const s3 = F3 / d; return [W / 2 + rx * s3, H * HZ + (ry * cP + rz * sP) * s3, d]; };
// how far above the horizon (radians) the camera looks at screen row y
const elevAt = (y) => camP - Math.atan((y - H * HZ) / F3);
// the camera rides the line AHEAD behind the pen (measured along the line), a little above it, looking along the
// chord to the pen: on the level it is the old view, where the line bends up or down the camera turns with it
function rig(pz, w) {
  let z = pz, y = baseOf(z, w), L = 0;
  while (L < AHEAD && z > -4) { const z2 = z - 0.02, y2 = baseOf(z2, w); L += Math.hypot(0.02, y - y2); z = z2; y = y2; }
  const p = Math.atan2(y - baseOf(pz, w), pz - z), ck = tailK(pz), cp = Math.cos(p), sp = Math.sin(p);
  // where the line bows up between the camera and the pen (as it goes over into a dive), the camera rises just
  // enough above it that no part of the line shows above the pen on the screen (h high, d deep: o >= h L / (L - d))
  const Lc = Math.hypot(pz - z, baseOf(pz, w) - y); let o = 0.45;
  for (let i = 1; i < 12; i++) { const zi = lerp(z, pz, i / 12), dy = baseOf(zi, w) - y, h = -dy * cp - (zi - z) * sp, d = (zi - z) * cp - dy * sp; if (h > 0 && d < Lc - 0.05) o = Math.max(o, Math.min(3, (1.1 * h * Lc) / (Lc - d))); }
  // (and, while it runs level, partly follows the line's small waves and sags, and its stars sideways)
  const pc = pathAt(pz - 1.2, w), wob = 0.7 * (pc[1] - baseOf(pz - 1.2, w)) * cp * cp;
  // (raised, it looks down at the pen so the pen stays where it always is on the screen; turning does not change
  // which points show above which)
  const cy = y - o * cp, cz = z - o * sp, p2 = Math.atan2(cy - baseOf(pz, w), pz - cz) + Math.atan(0.45 / Lc);
  return { x: lerp(pc[0] * 0.35, 0, ck), y: lerp(cy + wob, YS, ck), z: cz, p: p2 };
}
const fogA = (dz) => clamp((FAR3 - dz) / 8) * clamp((dz - 0.15) / 0.5);

let puffs = [], mounts = [], birds = [], shafts = [], kelps = [], whale = null, fish = [], mantas = [], snow = [], jellies = [], glows = [], ridges = [], clouds = [], grass = [], poles = [], bubbles = [], stars = [], nebulae = [], milky = [], bodies = [];
let spaceDark = 0, lineRGB = INK;
function buildWorld() {
  F3 = Math.min(NARROW ? Math.max(W, H * 0.75) : W, H * 1.6) * 0.62;
  const dens = NARROW ? 0.55 : 1;
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const G2 = S0;
  // far ranges: triangular peaks, snow where they are highest
  mounts = [[CL0 + 14, 3.4, [184, 198, 232]], [CL0 + 8, 2.4, [168, 206, 200]]].map(([z, hMax, c]) => {
    const pk = []; for (let x = -30; x < 30;) { const h = hMax * (0.45 + rnd() * 0.55), w2 = 2.2 + rnd() * 2.6; pk.push([x + w2 * 0.5, h, w2]); x += w2 * (0.5 + rnd() * 0.35); }
    const pts = []; for (let x = -31; x <= 31.001; x += 0.3) { let h = 0; for (const [px, ph, pw] of pk) h = Math.max(h, ph * Math.max(0, 1 - Math.abs(x - px) / (pw * 0.5))); pts.push([x, GROUND - h, z]); }
    const peaks = pk.filter((p) => p[1] > hMax * 0.8).map(([px, ph, pw]) => [[px, GROUND - ph, z], [px - pw * 0.1, GROUND - ph * 0.8, z], [px + pw * 0.1, GROUND - ph * 0.8, z]]);
    return { z, hMax, c, pts, peaks };
  });
  ridges = [];
  for (let k = 0, z = 2.2; z < ZS; k++, z += 1.8 + rnd() * 1.2) {
    const amp = 0.35 + rnd() * 0.55 + (k % 4 === 3 ? 0.45 : 0), f1 = 0.5 + rnd() * 0.7, f2 = 1.4 + rnd(), p1 = rnd() * 6, p2 = rnd() * 6, pts = [];
    for (let x = -14; x <= 14.001; x += 0.25) pts.push([x, GROUND - amp * (0.55 + 0.45 * Math.sin(x * f1 + p1)) * (0.7 + 0.3 * Math.sin(x * f2 + p2)), z]);
    const trees = []; if (k % 3 !== 1) { const n = 2 + ((rnd() * 5) | 0); for (let j = 0; j < n; j++) trees.push({ i: 4 + ((rnd() * (pts.length - 8)) | 0), s: 0.7 + rnd() * 0.7 }); }
    ridges.push({ z, k, pts, trees });
  }
  ridges.sort((a, b) => b.z - a.z);
  grass = [];
  for (let z = 1.2; z < CL0 + 0.6; z += 0.08 + rnd() * 0.1) {
    const x = pathAt(z)[0] + (rnd() - 0.5) * 5, blades = [];
    for (let j = 0; j < 5; j++) blades.push({ dx: (j - 2) * 0.012, h: (j === 2 ? 0.12 : 0.06) + rnd() * 0.06, lean: (j - 2) * 0.02 + (rnd() - 0.5) * 0.02 });
    grass.push({ x, z, blades, flower: rnd() < 0.3 ? 1 + ((rnd() * 3) | 0) : 0 });
  }
  poles = [];
  for (let z = WIRE[0]; z <= WIRE[1] + 0.01; z += POLE) poles.push(z);
  birds = [];
  for (let i = 0; i + 1 < poles.length; i++) for (const s of [-0.2, 0.2]) { const n = (rnd() * 3) | 0; for (let j = 0; j < n; j++) birds.push({ i, s, f: 0.2 + rnd() * 0.6, dir: rnd() < 0.5 ? -1 : 1, ph: rnd() * 6 }); }
  clouds = [];
  // low clouds over the land, and high ones the camera rises past at the end
  const cloudAt = (z, X, Y, wd) => {
    const pts = [], bx = [[-0.36, 0.13], [-0.18, 0.22], [0.04, 0.3], [0.25, 0.22], [0.4, 0.12]];
    for (let j = 0; j <= 40; j++) { const x = -0.5 + j / 40; let top = 0; for (const [b2, r] of bx) { const d = x - b2; if (Math.abs(d) < r) top = Math.max(top, Math.sqrt(r * r - d * d)); } pts.push([X + x * wd, Y - top * wd * 1.05, z]); }
    for (let j = 1; j <= 10; j++) pts.push([X + (0.5 - j / 10) * wd, Y + Math.sin((j / 10) * Math.PI) * 0.03, z]);
    clouds.push({ z, pts, ci: clouds.length });
  };
  for (let z = 3; z < CL0; z += 3 + rnd() * 3) cloudAt(z, (rnd() - 0.5) * 7, -2.1 + rnd() * 0.6, 0.9 + rnd() * 0.9);
  puffs = [];
  for (let i = 0; i < 34; i++) {
    const y = -2.4 - i * 0.85 - rnd() * 0.5, c = Math.pow(-y / CLH, 1 / CLX); if (y < -29) break;
    const z = CL0 + c * (ZS - CL0), an = rnd() * Math.PI * 2, rad = 1.1 + rnd() * 2.6, X = xAt(z) + Math.cos(an) * rad, Z = z + Math.sin(an) * rad * 0.8, blobs = [];
    for (let j = 0, n = 4 + ((rnd() * 4) | 0); j < n; j++) blobs.push([X + (rnd() - 0.5) * 1.4, y + (rnd() - 0.5) * 0.4, Z + (rnd() - 0.5) * 0.9, 0.3 + rnd() * 0.45]);
    puffs.push(blobs);
  }
  // the sea, by depth along the fishing line (k: 0 the top, 1 the bottom): light from above and bubbles near the
  // top, fish circling the line and rays gliding round it further down, jellyfish and glowing plankton in the dark
  const around = (k, r0, r1) => { const y = k * DD, z = zOfDepth(y), a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0); return [xAt(z) + Math.cos(a) * r, y, z + Math.sin(a) * r]; };
  shafts = []; for (let i = 0; i < 26; i++) { const [x, , z] = around(0, 0.7, 6.5); shafts.push({ x, z, w: 0.07 + rnd() * 0.2, ph: rnd() * 6 }); }
  bubbles = []; for (let i = 0; i < Math.round(340 * dens); i++) { const k = 0.02 + Math.pow(rnd(), 1.3) * 0.43; bubbles.push({ p: around(k, 0.25, 4), r: 0.025 + rnd() * 0.06, off: rnd(), v: 0.4 + rnd() * 0.6 }); }
  fish = []; for (let s2 = 0; s2 < 8; s2++) { const c = around(0.1 + s2 * 0.05 + rnd() * 0.03, 0, 0.4), R = 0.9 + rnd() * 1.4, dir = rnd() < 0.5 ? -1 : 1, col = (rnd() * 3) | 0, n = 18 + ((rnd() * 12) | 0), ph0 = rnd() * 6.3; for (let j = 0; j < n; j++) fish.push({ c, R: R + (rnd() - 0.5) * 0.5, y: c[1] + (rnd() - 0.5) * 1.2, ph: ph0 + rnd() * 2.4, dir, col, sz: 0.1 + rnd() * 0.06, w: 0.4 + rnd() * 0.06 }); }
  mantas = [0.27, 0.4].map((k) => { const c = around(k, 0, 0.4); return { c, R: 2 + rnd() * 1, ph: rnd() * 6.3, dir: rnd() < 0.5 ? -1 : 1, s: 1.2 + rnd() * 0.4 }; });
  jellies = []; for (let i = 0; i < Math.round(30 * dens) + 8; i++) jellies.push({ p: around(0.42 + rnd() * 0.48, 0.9, 4), r: 0.07 + rnd() * 0.1, c: (rnd() * 3) | 0, ph: rnd() * 6 });
  snow = []; for (let i = 0; i < Math.round(420 * dens); i++) snow.push({ p: around(0.1 + rnd() * 0.9, 0.2, 5), ph: rnd() });
  // a kelp forest in the shallows: long stalks standing up out of the deep around the line, swaying, with blades
  kelps = []; for (let i = 0; i < Math.round(12 * (0.6 + 0.4 * dens)); i++) { const [x, , z] = around(0, 1.6, 6.5); kelps.push({ x, z, y1: 26 + rnd() * 34, ph: rnd() * 6.3, c: (rnd() * 2) | 0, gap: 2 + rnd() * 0.8 }); }
  // a whale far below, crossing slowly under the line
  whale = { c: around(0.34, 2.2, 2.6), L: 10, h: rnd() * 6.3 };
  glows = []; for (let i = 0; i < Math.round(260 * dens); i++) glows.push({ p: around(0.5 + rnd() * 0.5, 0.3, 5), c: (rnd() * 3) | 0, s: rnd() });
  nebulae = [[G2 + 8, -2.2, -1.2, 2.6, [246, 196, 222]], [G2 + 13, 2.4, -0.4, 3.0, [200, 190, 246]], [G2 + 19.5, -1.0, 0.9, 3.4, [180, 226, 236]], [G2 + 25, 2.0, -1.6, 2.8, [252, 224, 200]]].map(([z, x, y, r, c]) => ({ z, x, y: y + YS, r, c }));
  milky = [];
  for (let i = 0; i < Math.round(520 * dens); i++) { const t = rnd(), sp = (rnd() + rnd() + rnd() - 1.5) * 0.9; milky.push({ x: -9 + t * 18, y: YS - 3.2 + t * 2.6 + sp, z: PEN.music[1] - 0.5 + rnd() * 6, s: rnd() }); }
  bodies = [{ kind: 'ring', z: G2 + 10, x: 2.3, y: YS + -1.5, r: 0.55, c: [214, 200, 246], c2: [246, 206, 226] }, { kind: 'moon', z: G2 + 15.5, x: -2.6, y: YS + -1.9, r: 0.42, c: [252, 238, 196] }, { kind: 'ring', z: G2 + 21.5, x: -2.0, y: YS + 0.9, r: 0.32, c: [186, 226, 236], c2: [252, 232, 170] }];
  stars = [];
  for (let i = 0; i < Math.round(300 * dens); i++) stars.push({ x: (rnd() - 0.5) * 12, y: YS - 3.4 + rnd() * 5.2, z: G2 - 1 + rnd() * 33, s: rnd(), sparkle: rnd() < 0.14, c: (rnd() * 3) | 0 });
}
