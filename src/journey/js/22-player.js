/* ---------------- the player: what is playing, from anywhere ---------------- */
const np = $('#jy-np'), npPlay = $('#jy-np-play');
let offer = null; // a song the Music chapter offers before anything has played
const shownWork = () => (nowSlug ? bySlug[nowSlug] : offer);
function syncPlayer() {
  const w = shownWork();
  np.hidden = !w;
  if (!w) return;
  const p = !audio.paused && nowSlug === w.slug;
  $('#jy-npd').style.backgroundImage = `url(${ASSET}${w.thumb})`;
  $('#jy-npt').textContent = nowSlug === w.slug && nowTrack != null && w.tracks[nowTrack] ? w.tracks[nowTrack].title : w.title;
  $('#jy-npa').textContent = w.artist;
  np.classList.toggle('is-playing', p);
  npPlay.setAttribute('aria-label', (p ? COPY.pause : COPY.listen) + ': ' + w.title);
  $('#jy-np-i').setAttribute('d', p ? 'M6 4h3v12H6zM11 4h3v12h-3z' : 'M6 4l10 6-10 6z');
}
listeners.add(syncPlayer);
const setOffer = (w) => { if (offer !== w) { offer = w; syncPlayer(); } };
npPlay.addEventListener('click', () => { const w = shownWork(); if (!w) return; if (!audio.paused && nowSlug === w.slug) pause(); else play(w, nowSlug === w.slug && nowTrack != null ? nowTrack : undefined); });
$('#jy-np-open').addEventListener('click', (e) => { const w = shownWork(); if (w) openStory(w.slug, e.currentTarget); });
