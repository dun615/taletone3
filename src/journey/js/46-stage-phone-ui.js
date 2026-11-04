// ---- on a phone: a chapter chip and a progress line instead of the rail, sheets instead of panels ----
const mchap = $('#jy-mchap'), mprog = $('#jy-mprog'), fbtn = $('#jy-fbtn'), filtersEl = $('#jy-filters'), scrim = $('#jy-scrim');
const contactEl = $('#jy-contact'), fopen = $('#jy-fopen');
mchap.setAttribute('aria-expanded', 'false');
mchap.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!menu.classList.contains('open')); });
let sheet = null, heldY = 0, holds = 0;
function holdStory(on) {
  if (on) { if (holds++ === 0) { heldY = scrollY; frozenU = U(); html.classList.add('jy-held'); } return; }
  if (holds > 0 && --holds === 0) { html.classList.remove('jy-held'); frozenU = null; scrollTo(0, heldY); }
}
// one sheet at a time: the filters, or the inquiry (which also holds the page still, so typing never scrolls the story)
function setSheet(which, opener) {
  if (sheet === which) return;
  if (sheet === 'form') holdStory(false);
  sheet = which;
  filtersEl.classList.toggle('open', which === 'filters'); fbtn.setAttribute('aria-expanded', String(which === 'filters'));
  contactEl.classList.toggle('open', which === 'form'); fopen.setAttribute('aria-expanded', String(which === 'form'));
  scrim.hidden = which !== 'filters';
  if (which === 'form') { holdStory(true); setTimeout(() => formProject.focus({ preventScroll: true }), 60); }
  if (which === 'filters') setTimeout(() => $('.jy-fchip[aria-pressed="true"]', filtersEl)?.focus({ preventScroll: true }), 60);
  if (!which && opener) opener.focus({ preventScroll: true });
}
fbtn.addEventListener('click', () => setSheet(sheet === 'filters' ? null : 'filters'));
$('#jy-fclose').addEventListener('click', () => setSheet(null, fbtn));
scrim.addEventListener('click', () => setSheet(null, fbtn));
fopen.addEventListener('click', () => setSheet('form'));
$('#jy-cclose').addEventListener('click', () => setSheet(null, fopen));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet) setSheet(null, sheet === 'form' ? fopen : fbtn); });

// while the inquiry sheet is open the story holds still, whatever the browser does to the scroll as fields take focus
let frozenU = null;
// (the scroll's range, read again only when the page or the window changes size: reading it every frame would make the
// browser settle styles and layout in the middle of one)
let scrollMax = -1;
const rangeNow = () => (scrollMax >= 0 ? scrollMax : (scrollMax = document.documentElement.scrollHeight - innerHeight));
if (window.ResizeObserver) new ResizeObserver(() => { scrollMax = -1; }).observe(document.documentElement);
addEventListener('resize', () => { scrollMax = -1; });
const U = () => { if (frozenU != null) return frozenU; const m = rangeNow(); return m > 0 ? (scrollY / m) * TOTAL : 0; };
const topFor = (u) => (u / TOTAL) * rangeNow();
// a jump (rail, menu, the record's arrows) passes through scene changes without playing them
let navUntil = 0;
const goU = (u, smooth = true) => { navUntil = performance.now() + 4000; auto = null; hold = null; if (u >= 1) entered = true; scrollTo({ top: topFor(u), behavior: smooth && !reduce ? 'smooth' : 'auto' }); };
