// The worlds as backgrounds that run by themselves. While a chapter's words are read, its world (the land, the sea,
// space) goes along its own stretch of the line at its own pace, round and round: near the end of a round its start
// already shows through and takes over, so it never jumps. The way on (its button): the world dissolves to where the
// phone shows, then the pen goes on through the phone into the next world, where the next round starts; the case's
// way runs on along the stars to the record. Scrolling back is plain scrolling.
const STORY = ['tale', 'tone', 'case'];
// each world's round: [where it starts, where it ends] along the line, and how fast the pen goes (z a second)
// (each starts a little way into its world, so the start that shows through at a round's end is still that world)
const LOOPS = { tale: [PEN.tale[0] + 0.05, PEN.tale[0] + 13], tone: [ZS + 2.8, S0 - 4.5], case: [S0 + 2.6, S0 + 15.5] };
// (ROUND_D: how far before its end a round's start begins to show through: a dissolve of some three seconds)
const LOOP_V = 0.6, ROUND_D = 2;
// each chapter's way on: from where the phone shows (from) to the next round's start (to); the case's runs to the music
const WAY = { tale: { from: ZS - PH.land, to: LOOPS.tone[0] }, tone: { from: S0 - PH.sea, to: LOOPS.case[0] }, case: { from: null, to: PEN.music[0] } };
const RUSH = 0.25, READ_MAX = 1.2;
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
// the pen on a way on: (after the dissolve, below) from where the phone shows, through it, at an even pace
function wayZ(k, s, from) {
  const w = WAY[k];
  if (w.from == null) return lerp(from, w.to, ease(s));
  return s < RUSH ? lerp(from, w.from, ease(s / RUSH)) : lerp(w.from, w.to, (s - RUSH) / (1 - RUSH));
}
// the scroll position where the pen is at z on chapter k's way on (for the scenes' steps)
const uOnWay = (k, z) => { const w = WAY[k], r = readEnd(k); return r + (RUSH + (1 - RUSH) * (z - w.from) / (w.to - w.from)) * (CH[k][1] - r); };
const loopT0 = { tale: 0, tone: 0, case: 0 }, wayFrom = { tale: 0, tone: 0, case: 0 };
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
  if (!zn) { zoneKey = null; return { z: penAt(u) }; }
  const key = zn.k + zn.part, prev = zoneKey; zoneKey = key;
  if (zn.part === 'read') {
    // (a round starts afresh when the way in arrives; coming back from the way on, it goes on from where it was)
    if (prev !== key) loopT0[zn.k] = prev === zn.k + 'pass' ? T - (wayFrom[zn.k] - LOOPS[zn.k][0]) / LOOP_V : T;
    return roundAt(zn.k, T);
  }
  if (prev !== key) { const [a, b] = LOOPS[zn.k]; wayFrom[zn.k] = prev === zn.k + 'read' ? roundAt(zn.k, T).z : (a + b) / 2; }
  // (first the round dissolves into the place where the phone shows: that place drawn first, the round fading over it)
  if (WAY[zn.k].from != null && zn.s < RUSH) return { z: wayFrom[zn.k], z2: WAY[zn.k].from, f: ease(zn.s / RUSH) };
  return { z: wayZ(zn.k, zn.s, wayFrom[zn.k]) };
}
