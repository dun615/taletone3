/* A phone at each change of world, and the visitor goes into it. Three beats over p (0 to 1):
     0 - .45  it comes flying along the line from far ahead, turning to face the visitor, and stops in the middle;
              the line runs on into it, through to the middle of its screen
   .45 - .62  its screen wakes: the visitor's own time and a notification over the next world, which the screen has
              shown from the first (no dark screen, so the story runs straight on into it)
   .62 - 1    it pulls: the world around is drawn in towards it, light streams into the screen, and the screen
              grows until it is the whole view. Through the screen the next world is really there (inside draws
              it), so when it fills the view it simply is the next scene. */
// the phone's scale (its screen is 1.9556 of it tall) through the passage
function phoneScale(p) {
  const hold = (H * (NARROW ? 0.56 : 0.66)) / 1.9556;
  if (p <= PH_HOLD) return lerp(hold * 0.22, hold, Math.pow(ease(p / PH_HOLD), 1.4));
  if (p <= PH_WAKE) return hold * (1 + 0.06 * (p - PH_HOLD) / (PH_WAKE - PH_HOLD));
  const end = 1.12 * Math.max(W / 0.98, H / 1.83), q = (p - PH_WAKE) / (1 - PH_WAKE);
  return hold * 1.06 * Math.pow(end / (hold * 1.06), Math.pow(q, 1.7));
}
const phoneDepth = (p) => F3 / phoneScale(p);
// how hard the phone pulls at the world around it
const phonePull = (p) => ease((p - PH_WAKE + 0.06) / (1 - PH_WAKE + 0.02));
// the world outside, drawn in towards the phone at the middle of the view
function pulled(p, dark, draw) {
  const k = phonePull(p);
  if (k <= 0 || reduce) { draw(); return; }
  ctx.save(); ctx.translate(W / 2, H * 0.5); ctx.scale(1 + 0.55 * k * k, 1 + 0.55 * k * k); ctx.rotate(0.07 * k * k * (dark ? -1 : 1)); ctx.translate(-W / 2, -H * 0.5);
  draw(); ctx.restore();
  const D = Math.hypot(W, H), g = ctx.createRadialGradient(W / 2, H * 0.5, D * 0.12, W / 2, H * 0.5, D * 0.62);
  g.addColorStop(0, 'rgba(10,14,30,0)'); g.addColorStop(1, `rgba(10,14,30,${0.55 * k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// where along the path P (between lo and hi) the line is d deep in front of the camera
function atDepth(P, d, lo, hi) {
  const dep = (z) => { const q = P(z); return (q[2] - camZ) * cP - (q[1] - camY) * sP; };
  if (dep(hi) <= d) return hi; if (dep(lo) >= d) return lo;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (dep(m) < d) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function phoneIn(p, an, dark, A, inside, note) {
  const s3 = phoneScale(p), show = ease(p / 0.1), t = reduce ? 0 : T;
  // it flies in along the line and comes to rest square in the middle
  const k = ease((p - 0.16) / (PH_HOLD - 0.16)), cx = lerp(an[0], W / 2, k), cy = lerp(an[1], H * 0.5, k);
  const roll = (1 - ease(p / PH_HOLD)) * 0.42 * (dark ? -1 : 1), yaw = (1 - ease(p / (PH_HOLD - 0.04))) * 1.05 * (dark ? 1 : -1);
  // waking (0 to 1), pulling (0 to 1)
  const wake = ease((p - PH_HOLD + 0.03) / (PH_WAKE - PH_HOLD)), pull = phonePull(p);
  // a 9:16 phone
  const w = 1.1 * s3, h = 1.9556 * s3, m = 0.06 * s3, D = Math.hypot(W, H);
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
  // the line runs on, straight into the phone: under its body to the middle of its screen, where the next world's line
  // goes on (so it passes through the phone, instead of looping round outside it)
  if (k > 0) {
    const mid = P(0, 0);
    ctx.strokeStyle = dark ? `rgba(220,226,255,${0.9 * A * show})` : `rgba(${INK},${0.9 * A * show})`; ctx.lineWidth = Math.max(1.6, 0.016 * s3); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(an[0], an[1]); ctx.lineTo(mid[0], mid[1]); ctx.stroke();
  }
  // light streaming into the screen, ever faster as it pulls
  const st = Math.max(0.35 * wake, pull) * (1 - clamp((p - 0.95) / 0.05));
  if (st > 0 && !reduce) {
    const n = NARROW ? 26 : 40, speed = 1 + 2.4 * pull;
    for (let i = 0; i < n; i++) {
      const ang = i * 2.39996, ph = (t * 0.9 * speed + i * 0.37) % 1, r0 = lerp(0.75, 0.12, ph * ph) * D, r1 = r0 + (0.05 + 0.2 * pull) * D * (1 - ph);
      ctx.lineWidth = 1 + 2 * pull * (1 - ph);
      ctx.strokeStyle = dark ? `rgba(220,226,255,${0.5 * st * (1 - ph)})` : `rgba(255,255,255,${0.85 * st * (1 - ph)})`;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1); ctx.stroke();
    }
  }
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
  // the next world, through the glass from the first
  ctx.fillStyle = `rgba(251,251,250,${A})`; ctx.fillRect(0, 0, W, H);
  inside();
  // the lock screen over it: the visitor's own time, and a notification from TALETONE; they rush past as it pulls
  const ui = wake * (1 - ease(pull / 0.45));
  if (ui > 0.01 && Math.abs(yaw) < 0.2) {
    const sc = s3 * (1 + 1.2 * pull), fam = '"LINE Seed KR","LINE Seed JP",system-ui,sans-serif', ink = dark ? '244,244,252' : INK; // (over the bright sea the time is in ink)
    const O = P(0, 0), ox = O[0], oy = O[1];
    ctx.globalAlpha = show * ui; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = `rgba(${ink},0.96)`; ctx.font = `700 ${(0.3 * sc).toFixed(1)}px ${fam}`;
    ctx.fillText(clockEl.textContent, ox, oy - 0.52 * sc);
    ctx.font = `400 ${(0.06 * sc).toFixed(1)}px ${fam}`; ctx.fillStyle = `rgba(${ink},0.8)`;
    ctx.fillText(dateEl.textContent, ox, oy - 0.43 * sc);
    // the notification rises into place
    const nw = 0.92 * sc, nh = 0.2 * sc, nx = ox - nw / 2, ny = oy - 0.2 * sc + (1 - ease((wake - 0.25) / 0.6)) * 0.12 * sc;
    ctx.globalAlpha = show * ui * ease((wake - 0.25) / 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(nx, ny, nw, nh, 0.05 * sc) : ctx.rect(nx, ny, nw, nh); ctx.fill();
    ctx.fillStyle = `rgb(${INK})`; ctx.beginPath(); ctx.arc(nx + 0.08 * sc, ny + nh / 2, 0.042 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = `rgba(${INK},0.62)`; ctx.font = `700 ${(0.038 * sc).toFixed(1)}px ${fam}`;
    ctx.fillText(COPY.notifyFrom || 'TALETONE', nx + 0.145 * sc, ny + 0.078 * sc);
    ctx.textAlign = 'right'; ctx.fillText(COPY.notifyNow || '', nx + nw - 0.04 * sc, ny + 0.078 * sc);
    ctx.textAlign = 'left'; ctx.fillStyle = `rgb(${INK})`; ctx.font = `700 ${(0.05 * sc).toFixed(1)}px ${fam}`;
    ctx.fillText(note || '', nx + 0.145 * sc, ny + 0.145 * sc, nw - 0.19 * sc);
    ctx.globalAlpha = show;
  }
  // a sheen running across the glass as it is entered
  if (pull > 0 && pull < 1 && !reduce) {
    const gx = lerp(-0.8, 1.8, pull) * W, g = ctx.createLinearGradient(gx - W * 0.25, 0, gx + W * 0.25, H * 0.4);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${0.32 * (1 - pull)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
function drawWorld(A) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (penZ < ZS) {
    // the land, then straight up into the sky; at the top a phone comes down the line and the visitor is drawn into
    // it. Through it is the sea, looked straight down into, which looks just like the sky looked straight up into:
    // only once through does it turn out to be water
    const p = clamp((penZ - (ZS - PH.land)) / PH.land);
    if (p <= 0) { backdrop(0, A); elements(0, A); drawLine(-1e9, penZ, lineRGB, A); drawTip(lineRGB, A); drawLead(A); return; }
    const zP = atDepth(pathAt, phoneDepth(p), penZ - 6, ZS - 0.001), an = V(pathAt(zP)) || [W / 2, H * 0.5];
    pulled(p, false, () => { backdrop(0, A); elements(0, A); drawLine(-1e9, Math.min(penZ, zP), lineRGB, A); if (penZ <= zP) drawTip(lineRGB, A); });
    phoneIn(p, an, false, A, () => {
      const c0 = getCam(); setCam(rig(penZ, 1));
      backdrop(1, A); elements(1, A); drawLine(ZS - 4, penZ, INK, A, seaPath); drawTip(INK, A, seaPath, true);
      setCam(c0);
    }, (COPY.phoneNotes || [])[0]);
    drawLead(A);
    return;
  }
  if (penZ < S0) {
    // straight down into the deep; at the bottom a phone comes up the line, and through it is space
    const p = clamp((penZ - (S0 - PH.sea)) / PH.sea);
    if (p <= 0) { backdrop(1, A); elements(1, A); drawLine(ZS - 4, penZ, lineRGB, A, seaPath); drawTip(lineRGB, A, seaPath, true); drawLead(A); return; }
    const zP = atDepth(seaPath, phoneDepth(p), penZ - 2, S0 + 2), an = V(seaPath(zP)) || [W / 2, H * 0.5];
    pulled(p, true, () => { backdrop(1, A); elements(1, A); drawLine(ZS - 4, Math.min(penZ, zP), lineRGB, A, seaPath); if (penZ <= zP) drawTip(lineRGB, A, seaPath, true); });
    phoneIn(p, an, true, A, () => {
      const c0 = getCam(); setCam(rig(penZ, 2));
      backdrop(2, A); elements(2, A); drawLine(S0 - 4, penZ, '244,244,252', A, spacePath); drawTip('244,244,252', A, spacePath);
      setCam(c0);
    }, (COPY.phoneNotes || [])[1]);
    drawLead(A);
    return;
  }
  backdrop(2, A); elements(2, A);
  drawLine(-1e9, penZ, lineRGB, A, spacePath); drawTip(lineRGB, A, spacePath); drawLead(A);
}
