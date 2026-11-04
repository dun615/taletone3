/* ---------------- profile sheet ---------------- */
const profile = $('#about');
let untrapProfile = null, profileReturn = null;
function openProfile(from) {
  profileReturn = from || document.activeElement;
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
}
$('#jy-p-close').addEventListener('click', closeProfile);
profile.addEventListener('click', (e) => { if (e.target === profile) closeProfile(); });
