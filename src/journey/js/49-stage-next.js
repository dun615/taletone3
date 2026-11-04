// The next message's place, marked like a notification once the visitor has the current one (STOPS): a click on it
// plays the story on to that message (one leg, one motion), so each message stays for as long as it is read.
const nextEl = $('#jy-next');
let nextShown = false;
// the leg that starts where the visitor is (at a stop, or scrolled back a little before the next one)
function legAt(u) { for (let i = 0; i < LEGS.length; i++) if (u >= LEGS[i][0] - 0.006 && u < LEGS[i][1] - 0.003) return i; return -1; }
function goNext() { const u = U(), i = legAt(u); if (i < 0 || auto) return; hold = null; lastU = u; playScene(LEGS[i], Math.max(u, LEGS[i][0] + 0.001)); }
nextEl.addEventListener('click', goNext);
// each frame: on the line where the next message will be (the nearest point of the line toward it that is in view,
// clear of the chat room), shown only while the story is at rest
function placeNext(u) {
  const i = legAt(u);
  const show = i >= 0 && !auto && !hold && frozenU == null && performance.now() > navUntil && !passing && story.hidden && !html.classList.contains('jy-held');
  if (show !== nextShown) { nextShown = show; nextEl.classList.toggle('on', show); nextEl.tabIndex = show ? 0 : -1; nextEl.setAttribute('aria-hidden', String(!show)); }
  if (!show) return;
  const m = 34, top = NARROW ? 84 : 76, bot = NARROW ? roomBox().top - 30 : H - 70, rr = roomEl.classList.contains('on') ? roomEl.getBoundingClientRect() : null;
  const inView = (q) => q && q[0] > m && q[0] < W - m && q[1] > top && q[1] < bot && !(rr && q[0] > rr.left - 30 && q[0] < rr.right + 30 && q[1] > rr.top - 30 && q[1] < rr.bottom + 30);
  // (a leg that passes into the next world points where it goes first: up the line to the phone coming down it)
  const L = LEGS[i], zN = penAt(L[4] ? L[4][0][0] : L[1]);
  let p = null;
  for (let z = zN; z > penZ + 0.2; z -= 0.1) { const q = V(pathAt(z)); if (inView(q)) { p = q; break; } }
  // (none of it in view: just ahead of the tip)
  if (!p) { const q = V(pathAt(penZ + 0.2)) || [W * 0.35, H * 0.4]; p = [clamp(q[0], m, W - m), clamp(q[1], top, bot)]; }
  nextEl.style.translate = `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`;
}
