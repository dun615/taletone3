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
// Another language keeps the visitor where they are: the same chapter's address in that language, the work or the
// profile that is open (its ?work= or ?profile), and the very place in the story (handed over for the next page to
// take up: 90-start)
const ROUTE_OF = { pro: '/', tale: '/about/', tone: '/approach/', record: '/discography/', epi: '/contact/' };
$$('.jy-langtog a').forEach((a) => a.addEventListener('click', (e) => {
  if (a.hasAttribute('aria-current')) { e.preventDefault(); return; }
  const pre = (a.getAttribute('href').match(/^\/(en|ja)(?=\/)/) || [''])[0];
  const u = U(), ch = railOf[chapterOf(u)] || 'pro', q = new URLSearchParams(location.search);
  const keep = q.has('work') ? `?work=${encodeURIComponent(q.get('work'))}` : q.has('profile') ? '?profile' : '';
  try { sessionStorage.setItem('tt_at', JSON.stringify({ u, t: Date.now() })); } catch (_) {}
  e.preventDefault(); location.href = pre + ROUTE_OF[ch] + keep;
}));
