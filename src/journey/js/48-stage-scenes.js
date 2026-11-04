/* ---- the story's two kinds of motion ----
   Reading belongs to the visitor: the scroll moves the words, at the visitor's pace. A change of scene belongs
   to the story: one scroll down at its edge and it plays through at its own pace, all the way to its end, without
   stopping on the way to ask for anything (going back up is plain scrolling); it stops where the next words are,
   swallows the rest of that flick, and a small cue says it is the visitor's turn.
   [from, to, ms, , steps] in story units; each 'to' is where the next words have just arrived. */
const ENTER = [0.33, uOfPen(SET.land[0] + 0.01), 0, 0, [[0.45, 1500], [0.7, 2000], [1, 1500], [uOfPen(SET.land[0] + 0.01), 1100]]];
const AUTO = [
  [0.02, 0.30, 900],    // the phone turns over: a message on its lock screen
  // entering: the film breaks up and goes out and the room goes dark; points gather into the land in the screen; it
  // lights up and the visitor is drawn in: the first hello (beats: the dark, the land formed, inside, the hello)
  ENTER,
  // straight up into the sky, where a phone comes down the line and stops; its screen wakes; it pulls the visitor
  // in, and somewhere it became straight down into the sea
  [uOfPen(SET.land[3] + 0.4), uOfPen(SET.sea[0] + 0.1), 0, 0, [[uOfPen(ZS - PH.land * (1 - PH_HOLD)), 2600], [uOfPen(ZS - PH.land * (1 - PH_WAKE)), 1200], [uOfPen(SET.sea[0] + 0.1), 2400]]],
  // down into the dark, a phone comes up the line and wakes, and pulls the visitor out into space: a real project
  [uOfPen(SET.sea[3] + 0.56), uOfPen(SET.space[0] + 0.15), 0, 0, [[uOfPen(S0 - PH.sea * (1 - PH_HOLD)), 2000], [uOfPen(S0 - PH.sea * (1 - PH_WAKE)), 1200], [uOfPen(SET.space[0] + 0.15), 2200]]],
  [uOfPen(SET.space[3] + 0.8), uOfPen(PEN.music[1] - 0.75), 2400],   // along the stars to the record: found
  [CH.music[1] - 0.06, CH.record[0] + 0.4, 1500],   // the line splits in five and draws the staff: the first song
  // past the last song, all the way into the inquiry in one go, slowing (never stopping) on each of the words between:
  // the staff becomes the record's groove and the record goes into the phone (the letter), the empty seat, and the
  // line out to the form. Steps: [where, ms to get there]
  [CH.done[0] - 0.3, CH.epi[0] + 0.55, 0, 0, [[CH.done[0] + 0.65, 2300], [CH.epi[0] + 0.18, 1000], [CH.epi[0] + 0.55, 1900]]],
];
let auto = null, hold = null, lastU = 0, inputAt = 0;
// the first screen: the visitor goes in by pressing the lock screen's enter, not by scrolling; until then the story
// stays at the lock screen (scrolling there only turns the phone over and nudges the button)
let entered = false;
const nudgeEnter = () => { phone.classList.remove('jy-nudge'); void phone.offsetWidth; phone.classList.add('jy-nudge'); };
const cueEl = $('#jy-cue'), cue = (v) => cueEl && cueEl.classList.toggle('on', v);
/* A scene is one unbroken motion: its steps are waypoints [u, ms to get there] of a single curve through them
   (monotone cubic, so it never turns back), at rest only at its start and its end. Between the steps it slows where a
   step asks for time (a phone waking) and speeds up where it does not, but it never stops on the way. */
function runPath(pts) { // pts: [[ms from the start, u], ...], the first [0, where it is now]
  const n = pts.length - 1, h = [], d = [];
  for (let k = 0; k < n; k++) { h.push(Math.max(1, pts[k + 1][0] - pts[k][0])); d.push((pts[k + 1][1] - pts[k][1]) / h[k]); }
  const m = pts.map((_, k) => {
    if (k === 0 || k === n) return 0;
    const a = d[k - 1], b = d[k]; if (a * b <= 0) return 0;
    const w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1];
    return (w1 + w2) / (w1 / a + w2 / b);
  });
  auto = { pts, h, m, t0: performance.now(), end: reduce ? 0 : pts[n][0] }; cue(false);
}
function sceneAt(a, t) {
  if (t >= a.end) return a.pts[a.pts.length - 1][1];
  let k = 0; while (k < a.h.length - 1 && t > a.pts[k + 1][0]) k++;
  const s = clamp((t - a.pts[k][0]) / a.h[k]), s2 = s * s, s3 = s2 * s, y0 = a.pts[k][1], y1 = a.pts[k + 1][1], hk = a.h[k];
  return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * hk * a.m[k] + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * hk * a.m[k + 1];
}
// play a scene from u on: straight to its end, or through those of its steps still ahead, as one motion
function playScene([a, b, ms, , steps], u) {
  if (!steps) { runPath([[0, u], [(ms * (b - u)) / (b - a), b]]); return; }
  const ahead = steps.filter((st) => st[0] > u + 0.003), prev = steps[steps.indexOf(ahead[0]) - 1], from0 = prev ? prev[0] : a;
  if (!ahead.length) return;
  const pts = [[0, u]]; let t = 0;
  ahead.forEach(([to, msk], i) => { t += i === 0 ? (msk * (to - u)) / (to - from0) : msk; pts.push([t, to]); });
  runPath(pts);
}
function autoStep(now) {
  if (auto) {
    const t = now - auto.t0;
    scrollTo({ top: topFor(sceneAt(auto, t)), behavior: 'instant' });
    if (t >= auto.end) { const u = auto.pts[auto.pts.length - 1][1]; hold = { u, t0: now }; lastU = u; auto = null; }
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
  if (performance.now() < navUntil || frozenU != null) { lastU = u; if (u >= ENTER[1] - 0.01) entered = true; return; }
  if (u >= ENTER[1] - 0.01) entered = true;
  if (!entered && u > AUTO[0][1] + 0.004) {
    if (lastU < AUTO[0][1] - 0.02) playScene(AUTO[0], Math.max(lastU, AUTO[0][0] + 0.001)); else { scrollTo({ top: topFor(AUTO[0][1]), behavior: 'instant' }); lastU = AUTO[0][1]; nudgeEnter(); }
    return;
  }
  cue(false);
  // only going on plays a scene (from wherever in it the visitor is); going back is plain scrolling
  if (u > lastU) for (const sc of AUTO) {
    const [a, b] = sc;
    if (sc === ENTER && !entered) continue;
    if (u > a && u < b) { playScene(sc, u); break; }
  }
  lastU = u;
}, { passive: true });
