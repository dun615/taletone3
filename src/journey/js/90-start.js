/* ---------------- where the visitor came in ---------------- */
applyFilter();
const route = body.dataset.route || '/';
const params = new URLSearchParams(location.search);
const want = params.get('work');
const first = { '/about/': 'tale', '/approach/': 'tone', '/discography/': 'record', '/contact/': 'epi' }[route];
// (coming from another language: the place in the story it was at, if that is in this chapter)
let cameAt = null;
try { const h = JSON.parse(sessionStorage.getItem('tt_at') || 'null'); sessionStorage.removeItem('tt_at'); if (h && Date.now() - h.t < 20000 && railOf[chapterOf(h.u)] === (first || 'pro') && (first || h.u >= 1)) cameAt = h.u; } catch (_) {}
requestAnimationFrame(() => {
  if (cameAt != null) stage.goU(cameAt, false);
  else if (first) stage.go(first, false);
  if (want && bySlug[want]) {
    const i = stage.items.findIndex((li) => li.dataset.slug === want); if (i >= 0) stage.goU(stage.recordU(i), false);
    setTimeout(() => openStory(want), 300);
  }
  // (…/about/?profile opens the profile)
  if (params.has('profile')) setTimeout(() => openProfile(), 300);
});
