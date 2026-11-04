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
const U = () => { if (frozenU != null) return frozenU; const m = document.documentElement.scrollHeight - innerHeight; return m > 0 ? (scrollY / m) * TOTAL : 0; };
const topFor = (u) => (u / TOTAL) * (document.documentElement.scrollHeight - innerHeight);
// a jump (rail, menu, the record's arrows) passes through scene changes without playing them
let navUntil = 0;
const goU = (u, smooth = true) => { navUntil = performance.now() + 4000; auto = null; hold = null; scrollTo({ top: topFor(u), behavior: smooth && !reduce ? 'smooth' : 'auto' }); };
