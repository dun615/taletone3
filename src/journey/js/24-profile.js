/* ---------------- profile sheet ---------------- */
const profile = $('#about');
let untrapProfile = null, profileReturn = null, profileUrl = null;
const PROFILE_URL = BASE + '/about/?profile';
function openProfile(from) {
  profileReturn = from || document.activeElement;
  if (!profile.classList.contains('open')) profileUrl = new URLSearchParams(location.search).has('profile') ? BASE + '/about/' : location.pathname + location.search;
  setUrl(PROFILE_URL);
  profile.classList.add('open');
  profile.setAttribute('role', 'dialog'); profile.setAttribute('aria-modal', 'true');
  [$('.jy-top'), $('#journey'), $('.jy-skip')].forEach((el) => { el.inert = true; });
  untrapProfile = trap(profile, closeProfile);
  $('#jy-p-close').focus();
}
function closeProfile() {
  if (!profile.classList.contains('open')) return;
  profile.classList.remove('open');
  profile.removeAttribute('role'); profile.removeAttribute('aria-modal');
  [$('.jy-top'), $('#journey'), $('.jy-skip')].forEach((el) => { el.inert = false; });
  stage.syncInert();
  if (untrapProfile) untrapProfile();
  if (profileReturn && profileReturn.focus) profileReturn.focus({ preventScroll: true });
  if (profileUrl != null) { setUrl(profileUrl); profileUrl = null; }
}
copyButton($('#jy-p-share'), () => PROFILE_URL);
$('#jy-p-ask').addEventListener('click', (e) => { e.preventDefault(); profileUrl = null; closeProfile(); setUrl(BASE + '/contact/'); go('epi'); });
$('#jy-p-close').addEventListener('click', closeProfile);
profile.addEventListener('click', (e) => { if (e.target === profile) closeProfile(); });
