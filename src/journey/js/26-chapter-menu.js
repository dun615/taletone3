/* ---------------- the chapter list: the rail on wide screens; on phones it opens from the chapter chip ---------------- */
const chipBtn = $('#jy-mchap'), menu = $('#jy-menu');
function setMenu(open) { if (chipBtn) chipBtn.setAttribute('aria-expanded', String(open)); menu.classList.toggle('open', open); }
document.addEventListener('click', (e) => { if (!menu.contains(e.target) && !(chipBtn && chipBtn.contains(e.target))) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); if (chipBtn) chipBtn.focus(); } });
$$('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault(); setMenu(false);
  try { history.replaceState(null, '', a.getAttribute('href')); } catch (_) {}
  go(a.dataset.go, a);
}));
$('.jy-mark').addEventListener('click', (e) => { e.preventDefault(); try { history.replaceState(null, '', BASE + '/'); } catch (_) {} go('pro'); });

$$('[data-profile]').forEach((b) => b.addEventListener('click', () => openProfile(b)));
