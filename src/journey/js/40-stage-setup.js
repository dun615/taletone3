// The stage: from here on the story plays on a fixed canvas by scroll (html.jy-stage-mode). Its canvas, the
// scroll track it is played on, and the lock screen's film.
const stageEl = $('#jy-stage'), cv = $('#jy-cv'), ctx = cv.getContext('2d');
const track = $('#jy-track');
// a screen of scrolling for each unit of the story
const PER_U = 100;
track.style.setProperty('--track', (TOTAL * PER_U + 100) + 'vh');
const sections = $$('.jy-ch');
// the lock screen's film: loaded once the page has loaded (it is not what the first paint waits for), silent, looping,
// paused while the phone is gone or the tab hidden; with reduced motion only its first frame shows
const lockVid = $('#jy-lockvid'), lockShade = $('.jy-lockshade');
// on a metered or slow connection (data saver, 2G/3G) the lock screen keeps its still instead of the film
const SAVE_DATA = (() => { try { const c = navigator.connection; return !!c && (c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || '')); } catch (_) { return false; } })();
let lockVidOn = false;
function lockVidPlay(on) {
  if (!lockVid || reduce || on === lockVidOn) return; lockVidOn = on;
  if (on && SAVE_DATA) return;
  if (on) { if (!lockVid.getAttribute('src')) lockVid.src = lockVid.dataset.src; const p = lockVid.play(); if (p) p.catch(() => {}); } else lockVid.pause();
}
// (started by the frame loop once the page has loaded, and only while the phone is there: a visitor who lands deep in
// the story never loads it)
document.addEventListener('visibilitychange', () => { if (document.hidden) lockVidPlay(false); });
