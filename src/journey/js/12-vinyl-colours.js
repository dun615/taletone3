/* ---------------- cover colours ---------------- */
const colorOf = {};
const sampling = {};
function sample(w) {
  if (colorOf[w.slug] || sampling[w.slug]) return sampling[w.slug] || Promise.resolve();
  sampling[w.slug] = new Promise((done) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 24;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data, px = [];
        for (let i = 0; i < d.length; i += 4) { const R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B); px.push([mx ? (mx - mn) / mx : 0, R, G, B]); }
        px.sort((a, b) => b[0] - a[0]);
        const top = px.slice(0, 140), s = top.reduce((a, p) => [a[0] + p[1], a[1] + p[2], a[2] + p[3]], [0, 0, 0]);
        colorOf[w.slug] = s.map((v) => Math.round(v / top.length));
      } catch (_) { colorOf[w.slug] = [163, 168, 181]; }
      done();
    };
    im.onerror = () => { colorOf[w.slug] = [163, 168, 181]; done(); };
    im.src = ASSET + w.thumb;
  });
  return sampling[w.slug];
}

// every record is a colour vinyl: the disc takes its cover's colour once sampled
function tintVinyls() {
  WORKS.forEach((w) => sample(w).then(() => {
    const c = colorOf[w.slug]; if (!c) return;
    document.querySelectorAll(`.jy-sw[data-slug="${w.slug}"], .jy-trks[data-slug="${w.slug}"]`).forEach((el) => el.style.setProperty('--vinyl', c.join(' ')));
  }));
}
setTimeout(tintVinyls, 1200);
