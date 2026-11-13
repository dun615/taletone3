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
// the address bar says what is open (a work's page, the profile), so the link a visitor copies opens the same thing
const setUrl = (path) => { try { history.replaceState(null, '', path); } catch (_) {} };
const TITLE0 = document.title;
// a button that copies a link and says so for a moment
function copyButton(btn, urlOf) {
  const label = btn.textContent; let t = 0;
  const said = () => { btn.textContent = COPY.copied || label; btn.classList.add('done'); clearTimeout(t); t = setTimeout(() => { btn.textContent = label; btn.classList.remove('done'); }, 1800); };
  const old = (url) => { const ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0'; btn.parentNode.appendChild(ta); ta.select(); try { if (document.execCommand('copy')) said(); } catch (_) {} ta.remove(); btn.focus({ preventScroll: true }); };
  btn.addEventListener('click', () => { const url = location.origin + urlOf(); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(said, () => old(url)); else old(url); });
}
