// What the stage shares across its parts: its elements, the screen size, the chapter it is in.
const phone = $('#jy-phone'), card = $('#jy-card'), screen = $('#jy-screen'), lead = $('#jy-lead'), lock = $('#jy-lock');
const frame = $('#jy-frame'), frameScr = $('.jy-scr', frame);
const markImgs = $$('.jy-mark img');
// what the frame loop shows and hides (looked up once, not every frame)
const tabsEl = $('#jy-tabs'), foundEl = $('#jy-found'), hintEl = $('#jy-hint'), letterEl = $('#jy-letter'), emptyEl = $('#jy-empty');
const formProject = $('#jy-f-project'), clockEl = $('#jy-clock'), dateEl = $('#jy-date');
const recordEl = $('#jy-record'), spiral = $('#jy-spiral'), readout = $('#jy-readout');
const items = $$('.jy-sw', spiral);
const N = items.length;
let W = 0, H = 0, DPR = 1, T = 0, last = 0, passing = false;
// NARROW: a phone or an upright screen. The scene keeps to the upper part (horizon HZ higher), the words to the
// bottom, the record sits in the middle above its card.
let NARROW = false, HZ = 0.46;
// a phone (narrow and under 700px across): its controls are laid out for a 390px phone and scaled to its width (PZ,
// as --pz in the styles), so every phone shows the same layout whatever its size or shape
let PHONE = false, PZ = 1;
let chapter = '', caseOffer = false;
const CASE = ($('.jy-case-btn') || {}).dataset ? $('.jy-case-btn').dataset.open : null;
const rail = $$('.jy-rail a'), railOf = { pro: 'pro', tale: 'tale', tone: 'tone', case: 'tone', music: 'tone', record: 'record', done: 'record', epi: 'epi' };
