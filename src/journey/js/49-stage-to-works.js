// A way past the story, straight to the discography: on screen while the story's chapters are read.
const toWork = $('#jy-towork');
let toWorkOn = false;
toWork.addEventListener('click', () => goStage('record'));
function placeToWork(u) {
  const show = u >= CH.tale[0] && u < CH.music[0] && frozenU == null && story.hidden && !html.classList.contains('jy-held');
  if (show !== toWorkOn) { toWorkOn = show; toWork.classList.toggle('on', show); toWork.tabIndex = show ? 0 : -1; toWork.setAttribute('aria-hidden', String(!show)); }
}
