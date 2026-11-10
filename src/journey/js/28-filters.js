/* ---------------- discography filters: they light works, they never hide them ---------------- */
const filter = { field: 'all', roles: new Set() };
const roleOk = (w) => [...filter.roles].every((r) => (w.roles || []).includes(r));
const lit = (w) => (filter.field === 'all' || w.field === filter.field) && roleOk(w);
function applyFilter() {
  $$('.jy-fchip[data-field]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.field === filter.field)));
  $$('.jy-fchip[data-role]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === 'all' ? !filter.roles.size : filter.roles.has(b.dataset.role))));
  // songs are counted one by one, an album's tracks each as a song (as on the live site); a role counts the
  // songs (or tracks) credited with every chosen role
  const songsOf = (w) => (w.tracks && w.tracks.length > 1 ? w.tracks : [w]);
  $$('.jy-fchip[data-field]').forEach((b) => { let n = b.querySelector('small'); if (!n) { n = document.createElement('small'); b.appendChild(n); } n.textContent = WORKS.filter((w) => b.dataset.field === 'all' || w.field === b.dataset.field).reduce((t, w) => t + songsOf(w).filter((u) => [...filter.roles].every((r) => (u.roles || []).includes(r))).length, 0); });
  $$('.jy-sw').forEach((li) => li.classList.toggle('dim', !lit(bySlug[li.dataset.slug])));
  const chosen = $$('.jy-fchip[aria-pressed="true"]').filter((b) => (b.dataset.field || b.dataset.role) !== 'all').map((b) => b.firstChild.textContent.trim());
  $('#jy-fbtn').textContent = [COPY.filter, ...chosen].join(' · ');
}
$$('.jy-fchip').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.field) filter.field = b.dataset.field;
  else if (b.dataset.role === 'all') filter.roles.clear();
  else if (filter.roles.has(b.dataset.role)) filter.roles.delete(b.dataset.role); else filter.roles.add(b.dataset.role);
  applyFilter();
}));
