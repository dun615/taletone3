// The story's ways on. Under each chapter's words a question and a button: going on into the next world is the
// visitor's to choose (a scroll stops at the words' end and the button asks, 48-stage-scenes); the button plays the
// way through the phone. And a way past the whole story, straight to the discography, while its chapters are read.
const goOnEl = $('#jy-goon'), goOnBtn = $('#jy-goon-b'), goOnT = $('#jy-goon-t');
let goOnOf = null, goOnOn = false;
// the next chapter's name on the button
const nextName = (k) => (k === 'tale' ? ((COPY.rooms || {}).tone || {}).title : k === 'tone' ? ((COPY.rooms || {}).case || {}).title : (COPY.rail || {}).record) || '';
function goOn() { const zn = zoneOf(U()); if (!zn || auto) return; hold = null; lastU = U(); playScene(wayScene(zn.k), Math.max(U(), readEnd(zn.k) + 0.001)); }
goOnBtn.addEventListener('click', goOn);
const nudgeGoOn = () => { goOnEl.classList.remove('jy-nudge'); void goOnEl.offsetWidth; goOnEl.classList.add('jy-nudge'); };
// placed by the words' layout (54-stage-conversation): k the chapter (null: hidden), x/y where, visible: inside the spot
function placeGoOn(k, x, y, visible) {
  const show = !!k && visible && !auto;
  if (k && k !== goOnOf) { goOnOf = k; goOnT.textContent = nextName(k); }
  if (show !== goOnOn) { goOnOn = show; goOnEl.classList.toggle('on', show); goOnBtn.tabIndex = show ? 0 : -1; goOnEl.setAttribute('aria-hidden', String(!show)); }
  if (k) goOnEl.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
}
// (its height, read once and again only when the window changes size: not every frame)
let goOnH = 0;
const goOnHeight = () => goOnH || (goOnH = goOnEl.offsetHeight || 46);
addEventListener('resize', () => { goOnH = 0; });
// (the way past: on screen for the whole story)
const toWork = $('#jy-towork');
let toWorkOn = false;
toWork.addEventListener('click', () => goStage('record'));
function placeToWork(u) {
  const show = u >= CH.tale[0] && u < CH.music[0] && frozenU == null && story.hidden && !html.classList.contains('jy-held');
  if (show !== toWorkOn) { toWorkOn = show; toWork.classList.toggle('on', show); toWork.tabIndex = show ? 0 : -1; toWork.setAttribute('aria-hidden', String(!show)); }
}
