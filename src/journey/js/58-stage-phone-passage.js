/* A phone at each change of world, and the visitor goes into it. Two beats over p (0 to 1):
     0 - .45  it comes along the line from far ahead, turning to face the visitor, and stops in the middle; the line
              runs on into it, over its bezel and through the glass to its very middle, where the next world's line goes on
   .45 - 1    its screen grows until it is the whole view. Through the screen the next world is really there (inside
              draws it), so when it fills the view it simply is the next scene.
   (Nothing else happens meanwhile: the world outside stays as it is, so each beat has room.) */
// the phone's scale (its screen is 1.9556 of it tall) through the passage
function phoneScale(p) {
  const hold = (H * (NARROW ? 0.56 : 0.66)) / 1.9556;
  if (p <= PH_HOLD) return lerp(hold * 0.22, hold, Math.pow(ease(p / PH_HOLD), 1.4));
  if (p <= PH_WAKE) return hold * (1 + 0.06 * (p - PH_HOLD) / (PH_WAKE - PH_HOLD));
  const end = 1.12 * Math.max(W / 0.98, H / 1.83), q = (p - PH_WAKE) / (1 - PH_WAKE);
  return hold * 1.06 * Math.pow(end / (hold * 1.06), Math.pow(q, 1.7));
}
const phoneDepth = (p) => F3 / phoneScale(p);
// how far the visitor has gone into the phone's screen
const phonePull = (p) => ease((p - PH_WAKE + 0.06) / (1 - PH_WAKE + 0.02));
// where along the path P (between lo and hi) the line is d deep in front of the camera
function atDepth(P, d, lo, hi) {
  const dep = (z) => { const q = P(z); return (q[2] - camZ) * cP - (q[1] - camY) * sP; };
  if (dep(hi) <= d) return hi; if (dep(lo) >= d) return lo;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (dep(m) < d) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// the next world through the phone's glass: its line's tip put on aim (the phone's centre) by keep (1 placed, 0 in its
// own place), its line trailing behind the tip only by trail; returns where its tip is drawn
function nextWorld(w, P, z0, rgb, hook, A, trail, aim, keep) {
  const c0 = getCam(); setCam(rig(penZ, w));
  const tip = V(P(penZ)), dx = tip && aim ? (aim[0] - tip[0]) * keep : 0, dy = tip && aim ? (aim[1] - tip[1]) * keep : 0;
  backdrop(w, A);
  ctx.save(); ctx.translate(dx, dy);
  elements(w, A); if (trail > 0) drawLine(z0, penZ, rgb, A * trail, P); drawTip(rgb, A, P, hook);
  ctx.restore(); setCam(c0);
  return tip ? [tip[0] + dx, tip[1] + dy] : null;
}
// where the phone is on the screen (its middle) and how far from it its edge reaches, as phoneIn draws it
function phoneBox(p, an) {
  const k = ease((p - 0.16) / (PH_HOLD - 0.16)), s3 = phoneScale(p);
  return { cx: lerp(an[0], W / 2, k), cy: lerp(an[1], H * 0.5, k), R: Math.hypot(1.1 * s3, 1.9556 * s3) * 0.56 };
}
// where along the line (going back from zP) it comes out from behind the phone
function phoneEntry(p, an, lineAt, zP) {
  const b = phoneBox(p, an), under = (z) => { const q = lineAt(z); return !!q && Math.hypot(q[0] - b.cx, q[1] - b.cy) <= b.R; };
  let hi = zP, lo = zP;
  for (let n = 0; n < 120; n++) { lo -= 0.03; if (!under(lo)) break; hi = lo; }
  if (under(lo)) return lo;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (under(m)) hi = m; else lo = m; }
  return lineAt(lo) ? lo : hi;
}
function phoneIn(p, an, dark, A, inside, lineAt, zE) {
  const s3 = phoneScale(p), show = ease(p / 0.1);
  // it comes in along the line and comes to rest square in the middle
  const k = ease((p - 0.16) / (PH_HOLD - 0.16)), cx = lerp(an[0], W / 2, k), cy = lerp(an[1], H * 0.5, k);
  const roll = (1 - ease(p / PH_HOLD)) * 0.42 * (dark ? -1 : 1), yaw = (1 - ease(p / (PH_HOLD - 0.04))) * 1.05 * (dark ? 1 : -1);
  // its screen's light (0 to 1), and how far the visitor has gone into it (0 to 1)
  const wake = ease((p - PH_HOLD + 0.03) / (PH_WAKE - PH_HOLD)), pull = phonePull(p);
  // a 9:16 phone
  const w = 1.1 * s3, h = 1.9556 * s3, m = 0.06 * s3;
  // the phone's own plane (u across, v down), turned by yaw about its upright axis and seen in perspective, so a
  // turned phone narrows to its far edge instead of just getting thinner; then rolled
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll), fp = h * 1.6;
  const P = (u, v) => { const k2 = fp / (fp + u * syw), X = u * cyw * k2, Y = v * k2; return [cx + X * cr - Y * sr, cy + X * sr + Y * cr]; };
  const rr = (x0, y0, ww, hh, r) => {
    ctx.beginPath(); let first = true;
    for (const [ax, ay, a0] of [[x0 + ww - r, y0 + r, -Math.PI / 2], [x0 + ww - r, y0 + hh - r, 0], [x0 + r, y0 + hh - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]])
      for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2), q = P(ax + Math.cos(a) * r, ay + Math.sin(a) * r); if (first) { ctx.moveTo(q[0], q[1]); first = false; } else ctx.lineTo(q[0], q[1]); }
    ctx.closePath();
  };
  ctx.save();
  ctx.globalAlpha = show;
  // the screen's light falls around it
  const glowA = (dark ? 0.32 : 0.5) * A * Math.max(dark ? 0.6 * show : 0, wake);
  if (glowA > 0) { const gl = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 1.1); gl.addColorStop(0, dark ? `rgba(200,206,255,${glowA})` : `rgba(255,255,255,${glowA})`); gl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.fillRect(cx - h * 1.2, cy - h * 1.2, h * 2.4, h * 2.4); }
  // the body, a side button, a rim catching the light
  ctx.fillStyle = `rgba(${INK},${A})`; rr(-w / 2, -h / 2, w, h, 0.16 * s3); ctx.fill();
  ctx.strokeStyle = dark ? `rgba(196,200,214,${0.8 * A})` : `rgba(255,255,255,${(0.28 + 0.4 * wake) * A})`; ctx.lineWidth = Math.max(1, 0.012 * s3); ctx.stroke();
  ctx.fillStyle = `rgba(${INK},${A})`; rr(w / 2 - 0.004 * s3, -h * 0.22, 0.03 * s3, h * 0.12, 0.01 * s3); ctx.fill();
  rr(-w / 2 + m, -h / 2 + m, w - 2 * m, h - 2 * m, 0.1 * s3); ctx.clip();
  // the next world, through the glass from the first (its own line comes in as the visitor is pulled in; until then the
  // line from outside is the one that reaches its tip)
  ctx.fillStyle = `rgba(251,251,250,${A})`; ctx.fillRect(0, 0, W, H);
  const mid = P(0, 0), keep = 1 - ease(pull);
  inside(ease(pull / 0.7), mid, keep);
  ctx.restore();
  // the line runs on into the phone: over its bezel and through the glass to its very middle, where the line of the next
  // world goes on (its tip is there), so it is one line passing through the middle of the phone
  const out = 1 - ease(pull / 0.7);
  if (show > 0 && out > 0) {
    // (from where the line comes out from behind the phone's edge)
    const st0 = (lineAt && lineAt(zE)) || an, ax = st0[0], ay = st0[1];
    ctx.strokeStyle = dark ? `rgba(244,244,252,${(A * show * out).toFixed(3)})` : `rgba(${INK},${(A * show * out).toFixed(3)})`;
    ctx.lineWidth = clamp((2.3 * AHEAD) / (an[2] || AHEAD), 1.4, 4); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mid[0], mid[1]); ctx.stroke();
  }
}
function drawWorld(A) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (penZ < ZS) {
    // the land, then straight up into the sky; at the top a phone comes down the line and the visitor is drawn into
    // it. Through it is the sea, looked straight down into, which looks just like the sky looked straight up into:
    // only once through does it turn out to be water
    const p = clamp((penZ - (ZS - PH.land)) / PH.land);
    if (p <= 0) { backdrop(0, A); elements(0, A); drawLine(-1e9, penZ, lineRGB, A); drawTip(lineRGB, A); return; }
    const zP = atDepth(pathAt, phoneDepth(p), penZ - 6, ZS - 0.001), an = V(pathAt(zP)) || [W / 2, H * 0.5], landAt = (z) => V(pathAt(z));
    const zE = phoneEntry(p, an, landAt, Math.min(penZ, zP));
    backdrop(0, A); elements(0, A); drawLine(-1e9, Math.min(penZ, zE), lineRGB, A); if (penZ <= zE) drawTip(lineRGB, A);
    phoneIn(p, an, false, A, (trail, aim, keep) => nextWorld(1, seaPath, ZS - 4, INK, true, A, trail, aim, keep), landAt, zE);
    return;
  }
  if (penZ < S0) {
    // straight down into the deep; at the bottom a phone comes up the line, and through it is space
    const p = clamp((penZ - (S0 - PH.sea)) / PH.sea);
    if (p <= 0) { backdrop(1, A); elements(1, A); drawLine(ZS - 4, penZ, lineRGB, A, seaPath); drawTip(lineRGB, A, seaPath, true); return; }
    const zP = atDepth(seaPath, phoneDepth(p), penZ - 2, S0 + 2), an = V(seaPath(zP)) || [W / 2, H * 0.5], seaAt = (z) => V(seaPath(z));
    const zE = phoneEntry(p, an, seaAt, Math.min(penZ, zP));
    backdrop(1, A); elements(1, A); drawLine(ZS - 4, Math.min(penZ, zE), lineRGB, A, seaPath); if (penZ <= zE) drawTip(lineRGB, A, seaPath, true);
    phoneIn(p, an, true, A, (trail, aim, keep) => nextWorld(2, spacePath, S0 - 4, '244,244,252', false, A, trail, aim, keep), seaAt, zE);
    return;
  }
  backdrop(2, A); elements(2, A);
  drawLine(-1e9, penZ, lineRGB, A, spacePath); drawTip(lineRGB, A, spacePath);
}
