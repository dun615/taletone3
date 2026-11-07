// The worlds as backgrounds that run by themselves. While a chapter's words are read, its world (the land, the sea,
// space) goes along its own stretch of the line at its own pace, round and round: near the end of a round its start
// already shows through and takes over, so it never jumps. The way on (its button): the world keeps running where it
// is, at its own pace, while a phone comes to it along its line and stops; the line goes into the phone's middle and
// the phone's screen, where the next world's round is already starting, grows to fill the view. The case's way runs
// on along the stars to the record. Scrolling back is plain scrolling.
const STORY = ['tale', 'tone', 'case'];
// each world's round: [where it starts, where it ends] along the line, and how fast the pen goes (z a second)
// (each starts a little way into its world, so the start that shows through at a round's end is still that world)
const LOOPS = { tale: [PEN.tale[0] + 0.05, PEN.tale[0] + 11], tone: [ZS + 3.4, S0 - 6], case: [S0 + 3.4, S0 + 15.5] };
// (ROUND_D: how far before its end a round's start begins to show through: a dissolve of some three seconds)
const LOOP_V = 0.9, ROUND_D = 2.7;
// each chapter's way on: where it leads (the next round's start, seen through the phone's screen; the case's: the
// music), and how far its world may run meanwhile (if the visitor lingers half way, it waits there)
const WAY = { tale: { to: LOOPS.tone[0], stop: CL0 - 0.2 }, tone: { to: LOOPS.case[0], stop: S0 - 1.5 }, case: { to: PEN.music[0] } };
const READ_MAX = 1.2;
// the phone between worlds: how far along it is (0 to 1) and on which chapter's way (58-stage-phone-passage)
let passP = 0, passK = null;
// how much of each chapter is its words (in u): set by their layout (54-stage-conversation), longer when they do not
// all fit and scrolling moves them through the reading spot
const readLen = { tale: 0.05, tone: 0.05, case: 0.05 };
const readEnd = (k) => CH[k][0] + readLen[k];
// where u is in the story: a chapter's words ('read', s along them) or its way on ('pass', s along it)
function zoneOf(u) {
  for (const k of STORY) {
    const [a, b] = CH[k]; if (u < a || u >= b) continue;
    const r = readEnd(k);
    return u < r ? { k, part: 'read', s: (u - a) / Math.max(1e-6, r - a) } : { k, part: 'pass', s: (u - r) / Math.max(1e-6, b - r) };
  }
  return null;
}
// the scroll position s of the way along chapter k's way on (for the scenes' steps)
const uAtS = (k, sv) => readEnd(k) + sv * (CH[k][1] - readEnd(k));
const loopT0 = { tale: 0, tone: 0, case: 0 }, wayFrom = { tale: 0, tone: 0, case: 0 }, wayT0 = { tale: 0, tone: 0, case: 0 };
let zoneKey = null;
// where a world's round is at time t (and, near its end, where its next start already is and how far it has come in)
function roundAt(k, t) {
  const [a, b] = LOOPS[k], C = b - a, q = ((((t - loopT0[k]) * LOOP_V) % C) + C) % C, r = { z: a + q };
  if (q > C - ROUND_D) { r.z2 = a - ROUND_D + (q - (C - ROUND_D)); r.f = ease((q - (C - ROUND_D)) / ROUND_D); }
  return r;
}
// where the pen is for u now
function penFor(u) {
  const zn = zoneOf(u);
  passP = 0; passK = null;
  if (!zn) { zoneKey = null; return { z: penAt(u) }; }
  const key = zn.k + zn.part, prev = zoneKey; zoneKey = key;
  if (zn.part === 'read') {
    // (a round starts afresh when the way in arrives; coming back from the way on, it goes on from where it was)
    if (prev !== key) loopT0[zn.k] = prev === zn.k + 'pass' ? T - (wayFrom[zn.k] - LOOPS[zn.k][0]) / LOOP_V : T;
    return roundAt(zn.k, T);
  }
  if (prev !== key) { const [a, b] = LOOPS[zn.k]; wayFrom[zn.k] = prev === zn.k + 'read' ? roundAt(zn.k, T).z : (a + b) / 2; wayT0[zn.k] = T; }
  // (the case's: from where its world has run on to meanwhile, along the stars to the music, so it never halts first)
  if (zn.k === 'case') return { z: lerp(wayFrom.case + (T - wayT0.case) * LOOP_V, WAY.case.to, ease(zn.s)) };
  // (the world runs on at its own pace from where its round was; the phone comes by the way's progress)
  passP = zn.s; passK = zn.k;
  return { z: Math.min(WAY[zn.k].stop, wayFrom[zn.k] + (T - wayT0[zn.k]) * LOOP_V) };
}
