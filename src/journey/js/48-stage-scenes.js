/* ---- the story's two kinds of motion ----
   Reading belongs to the visitor: the scroll moves the words, at the visitor's pace. A change of scene belongs
   to the story: one scroll down at its edge and it plays through at its own pace, all the way to its end, without
   stopping on the way to ask for anything (going back up is plain scrolling); it stops where the next words are,
   swallows the rest of that flick, and a small cue says it is the visitor's turn.
   [from, to, ms, , steps] in story units; each 'to' is where the next words have just arrived. */
const ENTER = [0.33, uOfPen(SET.land[0] + 0.01), 0, 0, [[0.45, 1500, 250], [0.7, 2000, 350], [1, 1500, 0], [uOfPen(SET.land[0] + 0.01), 1100, 0]]];
const AUTO = [
  [0.02, 0.30, 900],    // the phone turns over: a message on its lock screen
  // entering: the film breaks up and goes out and the room goes dark; points gather into the land in the screen; it
  // lights up and the visitor is drawn in: the first hello (beats: the dark, the land formed, inside, the hello)
  ENTER,
  // straight up into the sky, where a phone comes down the line and stops; its screen wakes; it pulls the visitor
  // in, and somewhere it became straight down into the sea
  [uOfPen(SET.land[3] + 0.4), uOfPen(SET.sea[0] + 0.1), 0, 0, [[uOfPen(ZS - PH.land * (1 - PH_HOLD)), 2600, 250], [uOfPen(ZS - PH.land * (1 - PH_WAKE)), 1200, 0], [uOfPen(SET.sea[0] + 0.1), 2400, 0]]],
  // down into the dark, a phone comes up the line and wakes, and pulls the visitor out into space: a real project
  [uOfPen(SET.sea[3] + 0.56), uOfPen(SET.space[0] + 0.15), 0, 0, [[uOfPen(S0 - PH.sea * (1 - PH_HOLD)), 2000, 250], [uOfPen(S0 - PH.sea * (1 - PH_WAKE)), 1200, 0], [uOfPen(SET.space[0] + 0.15), 2200, 0]]],
  [uOfPen(SET.space[3] + 0.8), uOfPen(PEN.music[1] - 0.75), 2400],   // along the stars to the record: found
  [CH.music[1] - 0.06, CH.record[0] + 0.4, 1500],   // the line splits in five and draws the staff: the first song
  // past the last song, all the way into the inquiry in one go, resting a moment on each of the words between:
  // the staff becomes the record's groove and the record goes into the phone (the letter), the empty seat, and the
  // line out to the form. Steps: [where, ms to get there, ms to rest there]
  [CH.done[0] - 0.3, CH.epi[0] + 0.55, 0, 0, [[CH.done[0] + 0.65, 2300, 150], [CH.epi[0] + 0.18, 1000, 900], [CH.epi[0] + 0.55, 1200, 0]]],
];
let auto = null, hold = null, lastU = 0, inputAt = 0;
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const cueEl = $('#jy-cue'), cue = (v) => cueEl && cueEl.classList.toggle('on', v);
// rest: further steps of the same scene, each [where, ms, ms to rest there]; a step's start can lie in the future
// (the rest after the step before), where it simply stays put
function runAuto(from, to, ms, rest = [], pause = 0) { auto = { from, to, t0: performance.now(), d: reduce ? 0 : ms, rest, pause }; cue(false); }
// play a scene from u on: straight to its end, or through those of its steps still ahead
function playScene([a, b, ms, , steps], u) {
  if (!steps) { runAuto(u, b, (ms * (b - u)) / (b - a)); return; }
  const ahead = steps.filter((st) => st[0] > u + 0.003), prev = steps[steps.indexOf(ahead[0]) - 1], from0 = prev ? prev[0] : a;
  if (!ahead.length) return;
  const [to, ms0, rest0] = ahead[0];
  runAuto(u, to, (ms0 * (to - u)) / (to - from0), ahead.slice(1), rest0);
}
function autoStep(now) {
  if (auto) {
    const k = auto.d ? clamp((now - auto.t0) / auto.d) : 1;
    scrollTo({ top: topFor(lerp(auto.from, auto.to, easeIO(k))), behavior: 'instant' });
    if (k >= 1 && auto.rest.length) { const [to, ms, pause] = auto.rest[0]; lastU = auto.to; auto = { from: auto.to, to, t0: now + (reduce ? 0 : auto.pause), d: reduce ? 0 : ms, rest: auto.rest.slice(1), pause }; }
    else if (k >= 1) { hold = { u: auto.to, t0: now }; lastU = auto.to; auto = null; }
  } else if (hold && ((now - hold.t0 > 450 && now - inputAt > 220) || now - hold.t0 > 1800)) { hold = null; cue(true); }
}
const swallow = (e) => { if (!auto && !hold) return; inputAt = performance.now(); if (e.cancelable) e.preventDefault(); };
addEventListener('wheel', swallow, { passive: false });
addEventListener('touchmove', swallow, { passive: false });
// presenting (a shared screen, a meeting): the number keys 1 to 5 go straight to the chapters
addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('input,textarea,select,[contenteditable]') || !story.hidden) return;
  const n = '12345'.indexOf(e.key); if (n < 0) return;
  const a = $$('.jy-rail a[data-go]')[n]; if (a) { e.preventDefault(); a.click(); }
});
addEventListener('keydown', (e) => { if ((auto || hold) && [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && !e.target.closest('input,textarea,select')) e.preventDefault(); });
addEventListener('scrollend', () => { if (navUntil && !auto) { navUntil = 0; lastU = U(); } });
addEventListener('scroll', () => {
  if (auto) return;
  const u = U();
  if (hold) { if (Math.abs(u - hold.u) > 0.002) scrollTo({ top: topFor(hold.u), behavior: 'instant' }); return; }
  if (performance.now() < navUntil || frozenU != null) { lastU = u; return; }
  cue(false);
  // only going on plays a scene (from wherever in it the visitor is); going back is plain scrolling
  if (u > lastU) for (const sc of AUTO) {
    const [a, b] = sc;
    if (u > a && u < b) { playScene(sc, u); break; }
  }
  lastU = u;
}, { passive: true });
