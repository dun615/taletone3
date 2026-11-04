// The phone as a 3D object (WebGL): a case with depth, rounded sides and a raised camera, its back painted with
// assets/phone/case-back.svg, lit by a soft studio light that slides across it as it tilts and turns; the stars on it
// are holographic and glow. It is drawn on a canvas under the card, in the card's own perspective, so the lock screen
// (still the DOM front face) lands exactly on it when it turns over. Without WebGL the flat back (the img) stays.
const phone3d = (() => {
  const img = $('.jy-caseback', phone);
  const gl0 = (() => {
    if (!img || !window.WebGLRenderingContext) return null;
    const c = document.createElement('canvas'); c.className = 'jy-ph3d'; c.setAttribute('aria-hidden', 'true');
    const g = c.getContext('webgl', { antialias: true, premultipliedAlpha: true, alpha: true });
    if (!g) return null;
    // a renderer without a GPU (SwiftShader, llvmpipe) would draw it on the CPU every frame: keep the flat back there
    const info = g.getExtension('WEBGL_debug_renderer_info'), who = info ? String(g.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    return /swiftshader|llvmpipe|software/i.test(who) ? null : { c, g };
  })();
  if (!gl0) return () => {};
  const { c: cvs, g: gl } = gl0;
  const PW = 234, PHh = 416, DEP = 10, M = 70;      // the card (px), the case's depth, the canvas's margin round it
  const P = 1400;                                  // .jy-phone's CSS perspective, so the two line up
  const TW = 720, TH = 1280;                       // the back's texture

  /* ---- the shape ---- */
  // a rounded rectangle's outline, walking round it: [x, y, outward normal x, y]
  function outline(hw, hh, r, n = 14) {
    const pts = [], C = [[hw - r, hh - r, 0], [-(hw - r), hh - r, 0.5], [-(hw - r), -(hh - r), 1], [hw - r, -(hh - r), 1.5]];
    for (const [cx, cy, a0] of C) for (let i = 0; i <= n; i++) { const a = (a0 + (0.5 * i) / n) * Math.PI; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)]); }
    return pts;
  }
  const V = [], I = [];
  const vert = (x, y, z, nx, ny, nz) => (V.push(x, y, z, nx, ny, nz), V.length / 6 - 1);
  function cap(pts, z, nz) { const c0 = vert(0, 0, z, 0, 0, nz), k0 = V.length / 6; pts.forEach(([x, y]) => vert(x, y, z, 0, 0, nz)); for (let i = 0; i < pts.length; i++) I.push(c0, k0 + i, k0 + ((i + 1) % pts.length)); }
  function rings(list) { // list of rings (same length), each [[x,y,z,nx,ny,nz]...], stitched in order
    const base = list.map((ring) => ring.map((p) => vert(...p))), n = list[0].length;
    for (let r = 0; r + 1 < base.length; r++) for (let i = 0; i < n; i++) { const a = base[r][i], b = base[r][(i + 1) % n], c = base[r + 1][i], d = base[r + 1][(i + 1) % n]; I.push(a, b, c, b, d, c); }
  }
  // the case: the back at +DEP/2, the face at -DEP/2, round sides (a half circle of radius DEP/2 all the way round)
  const R0 = 20, inner = outline(PW / 2 - DEP / 2, PHh / 2 - DEP / 2, R0 - DEP / 2);
  cap(inner, DEP / 2, 1); cap(inner, -DEP / 2, -1);
  rings(Array.from({ length: 9 }, (_, k) => { const a = (k / 8) * Math.PI, s = Math.sin(a), co = Math.cos(a); return inner.map(([x, y, nx, ny]) => [x + nx * s * DEP / 2, y + ny * s * DEP / 2, co * DEP / 2, nx * s, ny * s, co]); }));
  // the camera's island, raised off the back (its place on the case art)
  const ISL = { x: -70.35, y: -147.5, hw: 23.45, hh: 44.7, r: 11.4, h: 3.4 };
  const isl = outline(ISL.hw, ISL.hh, ISL.r).map(([x, y, nx, ny]) => [x + ISL.x, y + ISL.y, nx, ny]);
  const top = DEP / 2 + ISL.h, lip = 1.2;
  rings([isl.map(([x, y, nx, ny]) => [x, y, DEP / 2 - 0.5, nx, ny, 0]), isl.map(([x, y, nx, ny]) => [x, y, top - lip, nx, ny, 0]),
    isl.map(([x, y, nx, ny]) => [x - nx * lip * 0.3, y - ny * lip * 0.3, top - lip * 0.3, nx * 0.7, ny * 0.7, 0.7]), isl.map(([x, y, nx, ny]) => [x - nx * lip, y - ny * lip, top, 0, 0, 1])]);
  { const c0 = vert(ISL.x, ISL.y, top, 0, 0, 1), k0 = V.length / 6; isl.forEach(([x, y, nx, ny]) => vert(x - nx * lip, y - ny * lip, top, 0, 0, 1)); for (let i = 0; i < isl.length; i++) I.push(c0, k0 + i, k0 + ((i + 1) % isl.length)); }

  /* ---- the shaders ---- */
  const VS = `attribute vec3 p;attribute vec3 n;uniform mat3 R;uniform vec2 HV;varying vec3 vm,vp,vn;
void main(){vec3 q=R*p;vm=p;vp=q;vn=R*n;float w=(${(P).toFixed(1)}-q.z)/${(P).toFixed(1)};gl_Position=vec4(q.x/HV.x,-q.y/HV.y,-q.z/600.*w,w);}`;
  const FS = `precision mediump float;uniform sampler2D tex,msk;uniform float tm;uniform vec4 st[4];varying vec3 vm,vp,vn;
void main(){vec3 N=normalize(vn),Vv=normalize(vec3(0.,0.,${(P).toFixed(1)})-vp);vec2 uv=vec2((vm.x+${(PW / 2).toFixed(1)})/${(PW).toFixed(1)},(vm.y+${(PHh / 2).toFixed(1)})/${(PHh).toFixed(1)});
vec3 base=texture2D(tex,uv).rgb;float m=texture2D(msk,uv).r;if(vm.z<-${(DEP / 2 - 0.5).toFixed(1)}){base=vec3(.08,.11,.19);m=0.;}
vec3 L=normalize(vec3(-.45,-.62,.72));float dif=max(dot(N,L),0.);float sp=pow(max(dot(N,normalize(L+Vv)),0.),70.);
vec3 Rr=reflect(-Vv,N);float strip=exp(-pow((Rr.x*.8+Rr.y*.6+.18)*4.5,2.))*smoothstep(-.2,.5,Rr.z);
float fr=.05+.95*pow(1.-max(dot(N,Vv),0.),5.);
vec3 col=base*(.9+.12*dif);
float hue=dot(N,Vv)*1.8+uv.x*1.3+uv.y*.9+tm*.04;vec3 holo=.74+.26*cos(6.2832*(hue+vec3(0.,.33,.67)));
col=mix(col,col*holo*1.12,m);
for(int i=0;i<4;i++){vec2 d=vm.xy-st[i].xy;float r=length(d)/st[i].z;float tw=.72+.28*sin(tm*1.7+st[i].w);
 float on=step(${(DEP / 2 - 0.5).toFixed(1)},vm.z);float g=exp(-r*r*2.4)*tw*on;col=mix(col,mix(vec3(.78,.70,1.),vec3(.62,.88,.96),clamp(r*1.3,0.,1.)),g*.6);
 col=mix(col,vec3(1.),exp(-r*r*60.)*tw*on);}
vec2 ld=vm.xy-vec2(-70.3,-167.1);float lens=step(length(ld),18.)*step(${(DEP / 2 + 1).toFixed(1)},vm.z);
col+=(sp*(.32+lens*1.6)+strip*(.13+lens*.4))*(.5+.5*fr)+fr*.04;
gl_FragColor=vec4(col,1.);}`;
  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  let prog;
  try { prog = gl.createProgram(); gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)); }
  catch (e) { return () => {}; }
  gl.useProgram(prog);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW);
  const aP = gl.getAttribLocation(prog, 'p'), aN = gl.getAttribLocation(prog, 'n');
  gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 24, 12);
  const uR = gl.getUniformLocation(prog, 'R'), uHV = gl.getUniformLocation(prog, 'HV'), uT = gl.getUniformLocation(prog, 'tm'), uSt = gl.getUniformLocation(prog, 'st');
  gl.uniform1i(gl.getUniformLocation(prog, 'tex'), 0); gl.uniform1i(gl.getUniformLocation(prog, 'msk'), 1);
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);

  /* ---- the back, from the case art: painted without its flat glows (the light here makes them), and a mask of its stars ---- */
  let ready = false, shown = false;
  function texture(unit, source) { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  fetch(img.getAttribute('src')).then((r) => r.text()).then((text) => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml'), svg = doc.documentElement;
    const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    // the stars: their outlines (16 points from the top round), where they sit, how far their rays reach
    const stars = [...doc.querySelectorAll('path[data-star]')].map((p) => {
      const dx = Number((p.parentNode.getAttribute('transform') || '').replace(/[^\d.\s-]/g, ' ').trim().split(/\s+/)[0]) || 0;
      const n = p.getAttribute('d').replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number), pt = (k) => [n[2 * k] + dx, n[2 * k + 1]];
      const cx = pt(0)[0], cy = pt(4)[1], reach = Math.max(cy - pt(0)[1], pt(4)[0] - cx, pt(8)[1] - cy);
      return { d: p.getAttribute('d'), dx, cx, cy, reach };
    });
    const toPx = (x, y) => [((x - vx) / vw) * PW - PW / 2, ((y - vy) / vh) * PHh - PHh / 2];
    gl.uniform4fv(uSt, stars.slice(0, 4).flatMap((s, i) => { const [x, y] = toPx(s.cx, s.cy); return [x, y, (s.reach / vw) * PW * 1.15, i * 1.9]; }));
    const mask = document.createElement('canvas'); mask.width = TW; mask.height = TH;
    const mc = mask.getContext('2d'); mc.fillStyle = '#000'; mc.fillRect(0, 0, TW, TH); mc.fillStyle = '#fff';
    stars.forEach((s) => { mc.setTransform(TW / vw, 0, 0, TH / vh, (s.dx - vx) * (TW / vw), -vy * (TH / vh)); mc.fill(new Path2D(s.d)); });
    doc.querySelectorAll('.glow, .core').forEach((el) => el.remove());
    const flat = new Image(), url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' }));
    flat.onload = () => {
      const paint = document.createElement('canvas'); paint.width = TW; paint.height = TH;
      paint.getContext('2d').drawImage(flat, 0, 0, TW, TH); URL.revokeObjectURL(url);
      texture(0, paint); texture(1, mask); ready = true;
    };
    flat.src = url;
  }).catch(() => {});
  cvs.addEventListener('webglcontextlost', () => { ready = false; phone.classList.remove('jy-3d'); });
  phone.insertBefore(cvs, phone.firstChild);

  /* ---- tilt: toward the pointer, or a slow sway where there is none ---- */
  let tx = 0, ty = 0, gx = 0, gy = 0, hasPointer = false, res = 0, lastTurn = -1, skip = false;
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; hasPointer = true; gx = (e.clientY / innerHeight - 0.5) * -14; gy = (e.clientX / innerWidth - 0.5) * 22; }, { passive: true });
  const rot = (ay, ax) => { const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    // CSS rotateY(ay)·rotateX(ax), column-major
    return [cy, 0, -sy, sy * sx, cx, cy * sx, sy * cx, -sx, cy * cx]; };

  // drawn each frame from the frame loop: how far the phone has turned (deg), how far into the prologue, its scale
  return function draw(turn, ip, scale) {
    const on = ready && ip < 0.3;
    if (on !== shown) { shown = on; cvs.style.display = on ? 'block' : 'none'; phone.classList.toggle('jy-3d', on); }
    if (!on) return;
    const want = Math.min(2, Math.max(1, DPR * scale));
    if (Math.abs(want - res) > 0.15) { res = want; cvs.width = Math.round((PW + 2 * M) * res); cvs.height = Math.round((PHh + 2 * M) * res); gl.viewport(0, 0, cvs.width, cvs.height); gl.uniform2f(uHV, PW / 2 + M, PHh / 2 + M); }
    // the tilt settles as the phone turns over, so the lock screen meets it square
    const k = 1 - ease(ip / 0.12);
    if (!hasPointer && !reduce) { gx = Math.sin(T * 0.6) * 5; gy = Math.sin(T * 0.43) * 9; }
    tx += (gx - tx) * 0.08; ty += (gy - ty) * 0.08;
    // when only the twinkle moves (no turn, no tilt to catch up), every other frame is enough
    const still = turn === lastTurn && Math.abs(gx - tx) + Math.abs(gy - ty) < 0.05; lastTurn = turn;
    if (still && (skip = !skip)) return;
    gl.uniformMatrix3fv(uR, false, rot(((turn + ty * k) * Math.PI) / 180, (tx * k * Math.PI) / 180));
    gl.uniform1f(uT, reduce ? 0 : T);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, I.length, gl.UNSIGNED_SHORT, 0);
  };
})();
