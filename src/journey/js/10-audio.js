/* ---------------- audio ---------------- */
const audio = new Audio();
audio.preload = 'none';
let nowSlug = null, nowTrack = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const versionLang = { kr: 'KR', en: 'EN', jp: 'JP' }[LANG];
const chosen = {};
const versionOf = (w) => { const vs = w.versions || []; return vs.find((x) => x.language === chosen[w.slug]) || vs.find((x) => x.language === versionLang) || vs.find((x) => x.language === 'KR') || vs[0] || null; };
function sourceOf(w, track) {
  if (track != null && w.tracks[track] && w.tracks[track].audio) return w.tracks[track];
  const v = versionOf(w);
  if (v) return v;
  if (w.tracks && w.tracks.length > 1) { const t = w.tracks[w.titleTrack] && w.tracks[w.titleTrack].audio ? w.tracks[w.titleTrack] : w.tracks.find((x) => x.audio); if (t && !w.audio) return t; }
  return w.audio ? { audio: w.audio, gain: w.gain } : null;
}
let actx = null, trackGain = null, master = null, curGain = 0, vol = 1;
try { const v = parseFloat(localStorage.getItem('tt_vol')); if (v >= 0 && v <= 1) vol = v; } catch (_) {}
function wire() {
  if (actx !== null) return;
  try { const AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); const node = actx.createMediaElementSource(audio); trackGain = actx.createGain(); master = actx.createGain(); node.connect(trackGain); trackGain.connect(master); master.connect(actx.destination); } catch (_) { actx = false; }
}
function applyGain() {
  const g = Math.pow(10, (curGain || 0) / 20);
  if (actx) { trackGain.gain.value = g; master.gain.value = vol; audio.volume = 1; } else audio.volume = Math.min(1, vol * g);
  $$('.jy-wc audio').forEach((a) => { a.volume = Math.min(1, vol * Math.pow(10, (+a.dataset.gain || 0) / 20)); });
}
function setVolume(v) { vol = clamp(v); applyGain(); try { localStorage.setItem('tt_vol', String(vol)); } catch (_) {} }
// only one sound at a time: the record, a card's audio, or a video
function quietOthers(except) {
  $$('.jy-wc audio').forEach((a) => { if (a !== except && !a.paused) a.pause(); });
  $$('.jy-embed').forEach((f) => { if (f !== except) unEmbed(f); });
}
function play(w, track, keepTime) {
  const src = sourceOf(w, track);
  if (!src) return;
  const url = ASSET + src.audio, at = keepTime ? audio.currentTime : 0;
  if (!audio.src.endsWith(url)) { audio.src = url; if (at) audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = at; } catch (_) {} }, { once: true }); }
  curGain = src.gain || 0; wire(); if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); applyGain();
  quietOthers(null);
  nowSlug = w.slug; nowTrack = track == null ? null : track;
  audio.play().catch(() => {});
  emit();
}
function pause() { audio.pause(); emit(); }
// a language version: switch at the same moment of the song
function setVersion(w, lang) {
  chosen[w.slug] = lang;
  if (nowSlug === w.slug && nowTrack == null) { const was = !audio.paused; play(w, null, true); if (!was) audio.pause(); }
  emit();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && !audio.paused) pause(); });
{ const vs = $('#jy-vol'); if (vs) { vs.value = Math.round(vol * 100); vs.setAttribute('aria-valuetext', `${vs.value}%`); vs.addEventListener('input', () => { setVolume(vs.value / 100); vs.setAttribute('aria-valuetext', `${vs.value}%`); }); } }
const isPlaying = (slug, track) => !audio.paused && nowSlug === slug && (track === undefined || nowTrack === track);
['play', 'pause', 'ended'].forEach((e) => audio.addEventListener(e, emit));
