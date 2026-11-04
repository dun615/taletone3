/* ---------------- where the visitor came in ---------------- */
applyFilter();
const route = body.dataset.route || '/';
const params = new URLSearchParams(location.search);
const want = params.get('work');
const first = { '/about/': 'tale', '/approach/': 'tone', '/discography/': 'record', '/contact/': 'epi' }[route];
requestAnimationFrame(() => {
  if (first) stage.go(first, false);
  if (want && bySlug[want]) {
    const i = stage.items.findIndex((li) => li.dataset.slug === want); if (i >= 0) stage.goU(stage.recordU(i), false);
    setTimeout(() => openStory(want), 300);
  }
});
