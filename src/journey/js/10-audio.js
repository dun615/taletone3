/* ---------------- audio ----------------
   One sound at a time. A song plays from an audio element; a multilingual single plays all its language versions at
   once, decoded and started together to the sample (they are made to line up to the phase), with only the chosen
   language heard: switching language is instant and never breaks the song. `audio` is what the rest of the page
   reads (paused, currentTime, duration, and the play, pause, ended, timeupdate events), whichever of the two plays. */
const el = new Audio();
el.preload = 'none';
// (the versions at once: decoded buffers, each through its own gain; only the chosen one is up)
const stem = { on: false, slug: null, bufs: null, gains: {}, srcs: [], playing: false, base: 0, at: 0, duration: 0, tick: 0, token: 0 };
const stemTime = () => (stem.playing ? Math.min(stem.duration, Math.max(0, actx.currentTime - stem.base)) : stem.at);
const audio = new (class extends EventTarget {
  get paused() { return stem.on ? !stem.playing : el.paused; }
  get currentTime() { return stem.on ? stemTime() : el.currentTime; }
  get duration() { return stem.on ? stem.duration : el.duration; }
  get error() { return stem.on ? null : el.error; }
})();
const tell = (type) => audio.dispatchEvent(new Event(type));
['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata'].forEach((e) => el.addEventListener(e, () => { if (!stem.on) tell(e); }));
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
  try { const AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); const node = actx.createMediaElementSource(el); trackGain = actx.createGain(); master = actx.createGain(); node.connect(trackGain); trackGain.connect(master); master.connect(actx.destination); } catch (_) { actx = false; }
}
function applyGain() {
  const g = Math.pow(10, (curGain || 0) / 20);
  if (actx) { trackGain.gain.value = g; master.gain.value = vol; el.volume = 1; } else el.volume = Math.min(1, vol * g);
  $$('.jy-wc audio').forEach((a) => { a.volume = Math.min(1, vol * Math.pow(10, (+a.dataset.gain || 0) / 20)); });
}
function setVolume(v) { vol = clamp(v); applyGain(); try { localStorage.setItem('tt_vol', String(vol)); } catch (_) {} }
// only one sound at a time: the record, a card's audio, or a video
function quietOthers(except) {
  $$('.jy-wc audio').forEach((a) => { if (a !== except && !a.paused) a.pause(); });
  $$('.jy-embed').forEach((f) => { if (f !== except) unEmbed(f); });
}
const multi = (w, track) => track == null && (w.versions || []).length > 1;
// the chosen version up, the others silent (a 12 ms glide, so the switch makes no click)
function stemLevels(w) {
  if (!stem.bufs) return;
  const v = versionOf(w), now = actx.currentTime;
  (w.versions || []).forEach((x) => { const g = stem.gains[x.language]; if (!g) return; const to = x === v ? Math.pow(10, (x.gain || 0) / 20) : 0; g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(to, now + 0.012); });
}
function stemStop(keep) {
  stem.srcs.forEach((x) => { x.onended = null; try { x.stop(); } catch (_) {} x.disconnect(); }); stem.srcs = [];
  if (keep) stem.at = stemTime();
  stem.playing = false; clearInterval(stem.tick);
}
function stemStart(w, at) {
  stem.base = actx.currentTime + 0.03 - at;
  const t0 = actx.currentTime + 0.03;
  stem.srcs = (w.versions || []).map((x) => { const b = stem.bufs[x.language]; if (!b) return null; const n = actx.createBufferSource(); n.buffer = b; n.connect(stem.gains[x.language]); n.start(t0, at); return n; }).filter(Boolean);
  // (they all end together; the first tells)
  if (stem.srcs[0]) stem.srcs[0].onended = () => { if (!stem.playing) return; stem.playing = false; stem.at = 0; clearInterval(stem.tick); tell('ended'); };
  stem.playing = true; stemLevels(w); tell('play');
  clearInterval(stem.tick); stem.tick = setInterval(() => tell('timeupdate'), 250);
}
// fetch and decode every version of a work (once; the last two works are kept)
const stemCache = new Map();
function stemLoad(w) {
  if (!stemCache.has(w.slug)) {
    stemCache.set(w.slug, Promise.all((w.versions || []).map((x) => fetch(ASSET + x.audio).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, no) => actx.decodeAudioData(b, ok, no))).then((buf) => [x.language, buf]))).then(Object.fromEntries));
    if (stemCache.size > 2) stemCache.delete(stemCache.keys().next().value);
  }
  return stemCache.get(w.slug);
}
function playStem(w, at) {
  el.pause();
  if (stem.on && stem.slug === w.slug && stem.bufs) { stemStop(false); stemStart(w, at); return; }
  stemStop(false); stem.on = true; stem.slug = w.slug; stem.bufs = null; stem.at = at; const token = ++stem.token;
  Object.values(stem.gains).forEach((g) => g.disconnect()); stem.gains = {};
  (w.versions || []).forEach((x) => { const g = actx.createGain(); g.gain.value = 0; g.connect(master); stem.gains[x.language] = g; });
  stemLoad(w).then((bufs) => {
    if (token !== stem.token || nowSlug !== w.slug) return;
    stem.bufs = bufs; stem.duration = Math.min(...Object.values(bufs).map((b) => b.duration)); tell('loadedmetadata');
    if (stem.wantPlay) stemStart(w, stem.at);
  }).catch(() => { if (token !== stem.token) return; stem.on = false; stem.token++; playEl(w, null, at); });
}
function leaveStem() { if (!stem.on) return; stemStop(false); stem.on = false; stem.slug = null; stem.bufs = null; stem.token++; }
function playEl(w, track, at) {
  const src = sourceOf(w, track); if (!src) return;
  const url = ASSET + src.audio;
  if (!el.src.endsWith(url)) { el.src = url; if (at) el.addEventListener('loadedmetadata', () => { try { el.currentTime = at; } catch (_) {} }, { once: true }); }
  curGain = src.gain || 0; applyGain();
  el.play().catch(() => {});
}
function play(w, track, keepTime) {
  if (!sourceOf(w, track)) return;
  const same = nowSlug === w.slug && nowTrack === (track == null ? null : track);
  wire(); if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  quietOthers(null);
  const at = keepTime || same ? audio.currentTime || 0 : 0;
  nowSlug = w.slug; nowTrack = track == null ? null : track;
  if (actx && multi(w, track)) { stem.wantPlay = true; playStem(w, at >= (stem.duration || Infinity) - 0.05 ? 0 : at); }
  else { leaveStem(); playEl(w, track, keepTime ? at : 0); }
  emit();
}
function pause() { if (stem.on) { stem.wantPlay = false; if (stem.playing) { stemStop(true); tell('pause'); } } else el.pause(); emit(); }
// a language version: on a multilingual single playing, only which one is heard changes, at once; otherwise the next
// play starts in it
function setVersion(w, lang) {
  chosen[w.slug] = lang;
  if (nowSlug === w.slug && nowTrack == null) {
    if (stem.on && stem.slug === w.slug) stemLevels(w);
    else { const was = !audio.paused; play(w, null, true); if (!was) pause(); }
  }
  emit();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && !audio.paused) pause(); });
{ const vs = $('#jy-vol'); if (vs) { vs.value = Math.round(vol * 100); vs.setAttribute('aria-valuetext', `${vs.value}%`); vs.addEventListener('input', () => { setVolume(vs.value / 100); vs.setAttribute('aria-valuetext', `${vs.value}%`); }); } }
const isPlaying = (slug, track) => (!audio.paused || (stem.on && stem.wantPlay && !stem.bufs)) && nowSlug === slug && (track === undefined || nowTrack === track);
['play', 'pause', 'ended'].forEach((e) => audio.addEventListener(e, emit));
