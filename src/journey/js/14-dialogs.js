/* ---------------- dialogs: focus stays inside, Esc closes, focus returns ---------------- */
const outside = () => [$('.jy-top'), $('#journey'), $('#about'), $('.jy-skip')].filter(Boolean);
function trap(box, closeFn) {
  const handler = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeFn(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a[href],button:not([disabled]),input,textarea,summary,[tabindex]:not([tabindex="-1"])', box).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
