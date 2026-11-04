// What the stage shares across its parts: its elements, the screen size, the chapter it is in.
const phone = $('#jy-phone'), phoneCharm = $('#jy-phone .jy-charm'), card = $('#jy-card'), screen = $('#jy-screen'), lead = $('#jy-lead'), lock = $('#jy-lock');
const frame = $('#jy-frame'), frameScr = $('.jy-scr', frame);
const markImg = $('.jy-mark img');
const recordEl = $('#jy-record'), spiral = $('#jy-spiral'), readout = $('#jy-readout');
const items = $$('.jy-sw', spiral);
const N = items.length;
let W = 0, H = 0, DPR = 1, T = 0, last = 0, passing = false;
// NARROW: a phone or an upright screen. The scene keeps to the upper part (horizon HZ higher), the words to the
// bottom, the record sits in the middle above its card.
let NARROW = false, HZ = 0.46;
let palette = [];
let chapter = '', caseOffer = false, recBuilt = false;
const CASE = ($('.jy-case-btn') || {}).dataset ? $('.jy-case-btn').dataset.open : null;
const rail = $$('.jy-rail a'), railOf = { pro: 'pro', tale: 'tale', tone: 'tone', case: 'tone', music: 'tone', record: 'record', done: 'record', epi: 'epi' };
