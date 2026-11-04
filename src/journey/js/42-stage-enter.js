// ---- entering (see ENTER) ----
const frontFace = $('#jy-phone .jy-front'), blackout = $('#jy-blackout'), pshot = $('#jy-pshot'), pcloud = $('#jy-pcloud'), pctx = pcloud.getContext('2d'), topBar = $('.jy-top'), railEl = $('.jy-rail');
let cloud = null;
// The land as it will be met, drawn once into the world canvas from the first camera (with the land a little way along
// so there is something to see) and cut to the screen's shape: a picture for the screen, and points sampled from it.
function buildCloud() {
  const r = screen.getBoundingClientRect(), sw = screen.offsetWidth || 218, sh = screen.offsetHeight || 400, ar = sw / sh;
  const keep = { z: penZ, cam: getCam(), lead: leadOf }; leadOf = null;
  penZ = SET.land[1] + 0.4; setCam(rig(PEN.tale[0], 0));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); drawWorld(1);
  const cw = Math.min(W, H * ar), ch = cw / ar, cx = (W - cw) / 2, cy = (H - ch) / 2;
  const pw = Math.round(cw * DPR), ph = Math.round(ch * DPR);
  pshot.width = pw; pshot.height = ph; const sctx = pshot.getContext('2d');
  sctx.fillStyle = '#fefefe'; sctx.fillRect(0, 0, pw, ph); sctx.drawImage(cv, Math.round(cx * DPR), Math.round(cy * DPR), pw, ph, 0, 0, pw, ph);
  // (sampled from the picture as seen on paper: points go where it changes, the outlines of hills, poles and trees)
  const img = sctx.getImageData(0, 0, pw, ph).data, lum = (o) => img[o] * 0.3 + img[o + 1] * 0.59 + img[o + 2] * 0.11, st = Math.max(2, Math.round(DPR * 1.5));
  ctx.clearRect(0, 0, W, H); penZ = keep.z; setCam(keep.cam); leadOf = keep.lead;
  const S = 1.6; pcloud.width = Math.round(sw * S * (DPR > 1 ? 1.5 : 1)); pcloud.height = Math.round(sh * S * (DPR > 1 ? 1.5 : 1));
  const n = NARROW ? 1900 : 2600, pts = [], PAL = [[214, 233, 246], [200, 214, 236], [190, 222, 199], [214, 230, 186]];
  for (let tries = 0; pts.length < n && tries < n * 60; tries++) {
    const x = (Math.random() * (pw - st)) | 0, y = (Math.random() * (ph - st)) | 0, o = (y * pw + x) * 4;
    const edge = Math.abs(lum(o) - lum(o + st * 4)) + Math.abs(lum(o) - lum(o + st * pw * 4)); if (edge < 14 && Math.random() > 0.005) continue;
    const v = y / ph, base = v < 0.38 ? PAL[0] : v < 0.52 ? PAL[1] : PAL[2 + ((x + y) & 1)], c = [0, 1, 2].map((k) => Math.round(lerp(img[o + k], base[k], 0.45) * 1.15));
    pts.push({ u: x / pw, v, c: `${Math.min(255, c[0])},${Math.min(255, c[1])},${Math.min(255, c[2])}`, s: 0.8 + Math.random() * 1.1 });
  }
  // (and a dust of light across the sky, so the whole screen fills)
  for (let k = 0; k < n * 0.14; k++) pts.push({ u: Math.random(), v: Math.random() * 0.55, c: '236,242,252', s: 0.5 + Math.random() * 0.6, dust: 1 });
  // each comes from outside the screen or out of its depth, at its own moment
  for (const p of pts) { const a = Math.random() * Math.PI * 2, far = Math.random() < 0.55; p.sx = far ? 0.5 + Math.cos(a) * (0.9 + Math.random() * 0.8) : 0.5 + (p.u - 0.5) * 0.08; p.sy = far ? 0.5 + Math.sin(a) * (0.9 + Math.random() * 0.8) : 0.5 + (p.v - 0.5) * 0.08; p.d = Math.random() * 0.45; p.tw = Math.random() * 6.3; }
  cloud = { pts };
}
function drawEnter(ip) {
  const g = clamp((ip - 0.33) / 0.1), form = clamp((ip - 0.45) / 0.25), lit = ease((ip - 0.68) / 0.1), wash = ease((ip - 0.84) / 0.12);
  const blk = ease((ip - 0.35) / 0.08) * (1 - ease((ip - 0.86) / 0.12));
  blackout.style.opacity = String(blk);
  topBar.style.opacity = railEl.style.opacity = blk > 0.01 ? String(1 - 0.92 * blk) : '';
  // the film breaks up: it shakes, its colours tear, it collapses to a bright line and goes out
  if (lockVid) {
    if (g > 0 && g < 1 && !reduce) {
      const sy = g < 0.7 ? 1 : Math.max(0.006, 1 - ease((g - 0.7) / 0.2)), sx = g < 0.9 ? 1 : Math.max(0.01, 1 - ease((g - 0.9) / 0.1)), jx = (Math.random() - 0.5) * 16 * (1 - g * 0.6);
      lockVid.style.transform = `translateX(${jx.toFixed(1)}px) scale(${sx},${sy})`;
      lockVid.style.filter = `contrast(${(1 + g * 0.8).toFixed(2)}) saturate(${(1 + g).toFixed(2)}) brightness(${(1 + 2.5 * ease((g - 0.6) / 0.35)).toFixed(2)}) hue-rotate(${((Math.random() - 0.5) * 50) | 0}deg)`;
    } else { lockVid.style.transform = ''; lockVid.style.filter = ''; }
    lockVid.style.opacity = g >= 1 ? '0' : '1'; lockShade.style.opacity = String(1 - ease(g / 0.7));
  }
  lock.style.opacity = String(g > 0 && g < 0.4 && !reduce ? (Math.random() < 0.35 ? 0.15 : 1) * (1 - g / 0.4) : g >= 0.4 ? 0 : 1);
  // the points, then the picture lighting up under them, then washing out white as the visitor goes in
  const wantCloud = ip > 0.33 && ip < 0.98;
  if (wantCloud && !cloud) buildCloud();
  pshot.style.opacity = String(lit * (1 - ease((wash - 0.25) / 0.6)));
  pshot.style.filter = wash > 0 ? `brightness(${(1 + 1.4 * wash).toFixed(2)}) saturate(${(1 - 0.6 * wash).toFixed(2)})` : lit > 0 ? `brightness(${(1 + 0.18 * lit).toFixed(2)})` : '';
  const tear = g > 0 && g < 1 && !reduce, showPts = cloud && form > 0 && lit < 1;
  pcloud.style.opacity = tear || showPts ? '1' : '0';
  if (!tear && !showPts) return;
  const cw = pcloud.width, ch = pcloud.height, t = reduce ? 0 : T;
  pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, cw, ch);
  if (tear) {
    // static: torn bars and snow over the film
    for (let k = 0; k < 9; k++) { const y = Math.random() * ch, hh = 1 + Math.random() * ch * 0.03; pctx.fillStyle = ['rgba(255,255,255,', 'rgba(110,232,240,', 'rgba(246,120,190,'][k % 3] + (0.15 + 0.5 * Math.random()) + ')'; pctx.fillRect(0, y, cw, hh); }
    pctx.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 500; k++) pctx.fillRect(Math.random() * cw, Math.random() * ch, 1.5, 1.5);
  }
  if (showPts) {
    pctx.globalCompositeOperation = 'lighter';
    const fade = 1 - lit, sc = cw / 300;
    for (const p of cloud.pts) {
      const k = reduce ? 1 : ease(clamp((form - p.d) / 0.55)); if (k <= 0) continue;
      const x = lerp(p.sx, p.u, k) * cw, y = lerp(p.sy, p.v, k) * ch, a = (0.35 + 0.65 * k) * fade * (p.dust ? 0.5 + 0.5 * Math.sin(t * 3 + p.tw) : 1);
      const r = p.s * sc * 1.25 * (k < 1 ? 1.5 - 0.5 * k : 1);
      pctx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`; pctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    pctx.globalCompositeOperation = 'source-over';
  }
}
