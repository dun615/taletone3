// TALETONE journey: a trip through a phone to find the record that holds every story.
//
//   Prologue  the back of a phone; scrolling turns it over and falls into the lock screen
//   Tale      a field of ink dots; TALETONE introduces itself in messages (who, a profile card, what stories)
//   Tone      a line runs into wires, hills and clouds while the philosophy arrives: TALE, TONE, MUSIC
//   Case      a real project as a conversation: HAEBOM's request, her strength, our question, the answer
//   Music     the signature songs play and their colours fill the hills; the track record; the landscape turns to dots
//             that curl like the logo and settle into a record's groove
//   Record    the record of every story: diving into its groove, the groove becomes a swirling current in 3D;
//             every work sits on it, newest first; an album in focus lets its tracks out on an earphone cord
//   Done      the phone is seen again from outside, the record in it
//   Epilogue  the only dark place: one groove is still empty; the visitor writes it (the inquiry form)
//
// Wide screens with JS get the fixed stage (html.jy-stage-mode). Elsewhere the same document reads as a column,
// and this script only wires up the panels, audio, filters and the form. Counts that cost frames are constants.
(() => {
  'use strict';
  const DATA = window.TT_JOURNEY;
  if (!DATA) return;
  const COPY = DATA.copy, WORKS = DATA.works, EXTRAS = DATA.extras || [];
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const DOTS = { wide: 900, narrow: 420 };          // Tale: the dot field
  const TURN_POINTS = { wide: 2600, narrow: 1500 }; // Music: points that become the groove
  const CH = { pro: [0, 1], tale: [1, 3.7], tone: [3.7, 7.3], case: [7.3, 9.6], music: [9.6, 11.2], record: [11.2, 15.2], done: [15.2, 16.1], epi: [16.1, 17.1] };
  const TOTAL = 17.1;
  /* The things of each world the line passes, in its depth z: eight poles on the land, eight jellyfish of light in the
     sea, eight stars in space. Every other one (the 1st, 3rd, 5th, 7th) carries a message (SET); the ones between let
     the scene go on a while, so the words come at a pace that can be read without the line slowing down. */
  const OBJ = { land: Array.from({ length: 8 }, (_, k) => 3.6 + 1.8 * k) };
  const CL0 = OBJ.land[7], ZS = CL0 + 3; // the line lifts off the last pole; where the sky becomes the sea
  OBJ.sea = Array.from({ length: 8 }, (_, k) => ZS + 2.6 + 2.6 * k);
  const S0 = ZS + 22.5; // where the deep opens onto space
  OBJ.space = Array.from({ length: 8 }, (_, k) => S0 + 4.5 + 1.6 * k);
  const SET = { land: OBJ.land.filter((_, i) => i % 2 === 0), sea: OBJ.sea.filter((_, i) => i % 2 === 0), space: OBJ.space.filter((_, i) => i % 2 === 0) };
  const PEN = { tale: [2, CL0 + 1], tone: [CL0 + 1, S0], case: [S0, S0 + 17], music: [S0 + 17, S0 + 29] };
  // the phone between worlds (see phoneIn): how much of the line each passage takes, where it rests, where it has woken
  const PH = { land: 2.0, sea: 2.4 }, PH_HOLD = 0.45, PH_WAKE = 0.62;
  const FLOW_DOTS = { wide: 260, narrow: 120 };    // Record: specks drifting along the current
  const INK = '20,28,48';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement, body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the stage needs room across: a screen taller than it is wide reads the story as one column
  // with script, every screen gets the stage; narrow and upright screens get its narrow layout (NARROW, below)
  const STAGE = true;
  const LANG = body.dataset.lang || 'kr';
  const BASE = body.dataset.base || '/preview';
  const ASSET = body.dataset.assets || '/';
  const bySlug = Object.fromEntries(WORKS.map((w) => [w.slug, w]));
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const local = (u, c) => (u - CH[c][0]) / (CH[c][1] - CH[c][0]);
  // the scroll position where the pen is at z (the tale holds the pen still over its first 8%)
  const uOfPen = (z) => { for (const k of ['tale', 'tone', 'case', 'music']) { const [a, b] = PEN[k]; if (z <= b || k === 'music') { let l = Math.min(1, Math.max(0, (z - a) / (b - a))); if (k === 'tale') l = 0.08 + 0.92 * l; return CH[k][0] + l * (CH[k][1] - CH[k][0]); } } return 0; };
  const on = (el, v) => el && el.classList.toggle('on', !!v);

  if (STAGE) html.classList.add('jy-stage-mode');

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

  /* ---------------- cover colours ---------------- */
  const colorOf = {};
  const sampling = {};
  function sample(w) {
    if (colorOf[w.slug] || sampling[w.slug]) return sampling[w.slug] || Promise.resolve();
    sampling[w.slug] = new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 24;
          const x = c.getContext('2d'); x.drawImage(im, 0, 0, 24, 24);
          const d = x.getImageData(0, 0, 24, 24).data, px = [];
          for (let i = 0; i < d.length; i += 4) { const R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B); px.push([mx ? (mx - mn) / mx : 0, R, G, B]); }
          px.sort((a, b) => b[0] - a[0]);
          const top = px.slice(0, 140), s = top.reduce((a, p) => [a[0] + p[1], a[1] + p[2], a[2] + p[3]], [0, 0, 0]);
          colorOf[w.slug] = s.map((v) => Math.round(v / top.length));
        } catch (_) { colorOf[w.slug] = [163, 168, 181]; }
        done();
      };
      im.onerror = () => { colorOf[w.slug] = [163, 168, 181]; done(); };
      im.src = ASSET + w.thumb;
    });
    return sampling[w.slug];
  }

  // every record is a colour vinyl: the disc takes its cover's colour once sampled
  function tintVinyls() {
    WORKS.forEach((w) => sample(w).then(() => {
      const c = colorOf[w.slug]; if (!c) return;
      document.querySelectorAll(`.jy-sw[data-slug="${w.slug}"], .jy-trks[data-slug="${w.slug}"]`).forEach((el) => el.style.setProperty('--vinyl', c.join(' ')));
    }));
  }
  setTimeout(tintVinyls, 1200);

  /* ---------------- dialogs: focus stays inside, Esc closes, focus returns ---------------- */
  const outside = () => [$('.jy-top'), $('#journey'), $('#about'), $('.jy-skip')].filter(Boolean);
  function trap(box, closeFn) {
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeFn(); return; }
      if (e.key !== 'Tab') return;
      const f = $$('a[href],button:not([disabled]),input,textarea,summary,[tabindex]:not([tabindex="-1"])', box).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }

  /* ---------------- story panel ---------------- */
  const story = $('#jy-story'), storyBox = $('.jy-box', story), playBtn = $('#jy-play'), prog = $('#jy-pg'), sLp = $('#jy-s-lp');
  let storyWork = null, storyReturn = null, untrapStory = null;
  function roleLine(roles) { const t = (roles || []).map((r) => COPY.roles[r]).filter(Boolean).join(' · '); return t ? 'TALETONE · ' + t : ''; }
  // ---- videos: a YouTube card or stage turns into the player in place (or opens YouTube where embedding is not allowed) ----
  const EMBED = !window.TT_NO_EMBED;
  const ytWatch = (id) => `https://www.youtube.com/watch?v=${id}`;
  function embed(box, id, title) {
    if (!EMBED) { const l = document.createElement('a'); l.href = ytWatch(id); l.target = '_blank'; l.rel = 'noopener'; document.body.appendChild(l); l.click(); l.remove(); return; }
    pause(); quietOthers(null);
    const f = document.createElement('iframe');
    f.className = 'jy-embed'; f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`; f.title = title || 'YouTube';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
    f._was = [...box.childNodes]; box.replaceChildren(f); box.classList.add('playing');
  }
  function unEmbed(f) { const box = f.parentNode; if (!box) return; box.replaceChildren(...(f._was || [])); box.classList.remove('playing'); }
  const thumb = (img, box) => { img.addEventListener('error', () => box.classList.add('noimg'), { once: true }); };
  // credits keep their wording: blank lines split groups, '[Music Credits]' or '1. Song' lines head them
  function creditsInto(el, text) {
    el.textContent = '';
    text.replace(/\r/g, '').split(/\n\s*\n/).forEach((group) => {
      const p = document.createElement('p');
      group.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => { const head = /^\[.+\]$/.test(line) || /^\d+\.\s/.test(line); const e = document.createElement(head ? 'strong' : 'span'); e.textContent = head ? line.replace(/^\[|\]$/g, '') : line; p.appendChild(e); });
      if (p.children.length) el.appendChild(p);
    });
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  // language versions as chips (KR / EN / JP), wherever a work has them
  function versionChips(box, w) {
    const vs = w.versions || []; box.textContent = ''; box.hidden = vs.length < 2;
    vs.forEach((v) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'jy-vchip'; b.textContent = v.language; b.dataset.lang = v.language; b.addEventListener('click', () => setVersion(w, v.language)); box.appendChild(b); });
    syncVersionChips();
  }
  function syncVersionChips() { $$('.jy-vchip').forEach((b) => { const w = bySlug[b.closest('[data-slug]') ? b.closest('[data-slug]').dataset.slug : (storyWork && storyWork.slug)]; const v = w && versionOf(w); b.setAttribute('aria-pressed', String(!!v && v.language === b.dataset.lang)); }); }
  listeners.add(syncVersionChips);
  // the track the detail shows: the one playing, else the album's title track
  const shownTrack = (w) => (nowSlug === w.slug && nowTrack != null ? nowTrack : w.titleTrack || 0);
  function storyTrackView(w) {
    const album = w.tracks && w.tracks.length > 1, i = shownTrack(w), t = album ? w.tracks[i] : null;
    const text = String((t && t.credits) || w.credits || '').trim();
    $('#jy-s-cr').hidden = !text; creditsInto($('#jy-s-credits'), text);
    $('#jy-s-crh').textContent = COPY.credits + (album ? ` · ${pad2(i + 1)} ${t.title}` : '');
    const vid = (t && t.yt) || w.yt;
    // with a video, the detail shows the video, ready to play in place; without one, the cover
    const film = $('#jy-s-film');
    if (film.dataset.yt !== (vid || '') && !film.classList.contains('playing')) {
      film.dataset.yt = vid || ''; film.hidden = !vid; $('.jy-s-cover', story).hidden = !!vid;
      if (vid) { const im = $('#jy-s-filmi'); im.onerror = () => { im.onerror = null; im.src = ASSET + (w.image || w.thumb); }; im.src = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`; im.alt = ''; $('#jy-s-filmb').setAttribute('aria-label', `${COPY.video} · ${(t && t.title) || w.title}`); }
    }
    const yt = $('#jy-s-yt'); yt.href = vid ? ytWatch(vid) : (w.youtube || '#'); yt.parentNode.hidden = !(vid || w.youtube);
  }
  function openStory(slug, from) {
    const w = bySlug[slug];
    if (!w) return;
    storyWork = w; storyReturn = from || document.activeElement;
    story.dataset.slug = w.slug;
    ['jy-s-bg', 'jy-s-v'].forEach((id) => { $('#' + id).src = ASSET + w.thumb; });
    const art = $('#jy-s-a'); art.src = ASSET + (w.image || w.thumb); art.alt = w.title; art.style.objectFit = w.fit || 'cover'; art.style.objectPosition = w.pos || '50% 50%';
    $('#jy-s-video').hidden = true; $('#jy-s-video').textContent = '';
    { const film = $('#jy-s-film'), f = $('.jy-embed', film); if (f) unEmbed(f); film.dataset.yt = '-'; }
    $('#jy-s-fmt').textContent = [w.format, (w.date || '').slice(0, 4)].filter(Boolean).join(' · ');
    $('#jy-s-title').textContent = w.title;
    $('#jy-s-meta').textContent = w.artist || '';
    $('#jy-s-desc').textContent = w.description || '';
    $('#jy-s-roles').textContent = roleLine(w.roles);
    const facts = $('#jy-s-facts'); facts.textContent = '';
    [['date', w.date], ['format', w.format], ['type', w.type]].forEach(([k, v]) => { if (!v || !facts.dataset[k]) return; const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = facts.dataset[k]; dd.textContent = v; facts.append(dt, dd); });
    versionChips($('#jy-s-vers'), w);
    const tracks = $('#jy-s-tracks'); tracks.innerHTML = '';
    if (w.tracks && w.tracks.length > 1) {
      w.tracks.forEach((t, i) => {
        const li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.disabled = !t.audio; b.dataset.track = i; b.setAttribute('aria-pressed', 'false');
        b.innerHTML = '<i></i><span></span>'; b.firstChild.textContent = pad2(i + 1); b.lastChild.textContent = t.title;
        b.addEventListener('click', () => (isPlaying(w.slug, i) ? pause() : play(w, i)));
        li.appendChild(b); tracks.appendChild(li);
      });
    }
    tracks.hidden = !tracks.children.length;
    storyTrackView(w);
    const cov = $('#jy-s-covl'); cov.textContent = '';
    (w.covers || []).forEach((c) => {
      const li = document.createElement('li'), a = document.createElement('a'), img = document.createElement('img'), name = document.createElement('span');
      a.href = ytWatch(c.yt); a.target = '_blank'; a.rel = 'noopener'; a.className = 'jy-cov';
      img.src = `https://i.ytimg.com/vi/${c.yt}/mqdefault.jpg`; img.alt = ''; img.loading = 'lazy'; thumb(img, a);
      name.textContent = c.artist; a.append(img, name);
      a.addEventListener('click', (e) => { if (!EMBED) return; e.preventDefault(); const st = $('#jy-s-video'); st.hidden = false; st.textContent = ''; embed(st, c.yt, `${w.title} — ${c.artist}`); });
      li.appendChild(a); cov.appendChild(li);
    });
    $('#jy-s-covers').hidden = !cov.children.length;
    playBtn.hidden = !sourceOf(w);
    story.hidden = false;
    outside().forEach((el) => { el.inert = true; });
    requestAnimationFrame(() => story.classList.add('open'));
    untrapStory = trap(storyBox, closeStory);
    $('#jy-s-close').focus();
    syncStory();
  }
  $('#jy-s-filmb').addEventListener('click', () => { const film = $('#jy-s-film'); embed(film, film.dataset.yt, storyWork && storyWork.title); });
  listeners.add(() => { if (storyWork && !story.hidden) storyTrackView(storyWork); });
  function closeStory() {
    if (story.hidden) return;
    $$('#jy-story .jy-embed').forEach(unEmbed); $('#jy-s-video').hidden = true; $('#jy-s-video').textContent = '';
    story.classList.remove('open');
    setTimeout(() => { story.hidden = true; }, reduce ? 0 : 250);
    outside().forEach((el) => { el.inert = false; });
    if (STAGE) stage.syncInert();
    if (untrapStory) untrapStory();
    if (storyReturn && storyReturn.focus) storyReturn.focus({ preventScroll: true });
    storyWork = null;
  }
  function syncStory() {
    if (!storyWork) return;
    const p = isPlaying(storyWork.slug);
    playBtn.setAttribute('aria-pressed', String(p));
    playBtn.setAttribute('aria-label', p ? COPY.pause : COPY.listen);
    $('#jy-pi').setAttribute('d', p ? 'M6 4h3v12H6zM11 4h3v12h-3z' : 'M6 4l10 6-10 6z');
    sLp.classList.toggle('spin', p);
    $$('#jy-s-tracks button').forEach((b) => b.setAttribute('aria-pressed', String(isPlaying(storyWork.slug, Number(b.dataset.track)))));
  }
  listeners.add(syncStory);
  audio.addEventListener('timeupdate', () => {
    if (!storyWork || nowSlug !== storyWork.slug || !audio.duration) return;
    prog.style.strokeDashoffset = String(100 - (audio.currentTime / audio.duration) * 100);
  });
  playBtn.addEventListener('click', () => { if (!storyWork) return; if (isPlaying(storyWork.slug)) pause(); else { prog.style.strokeDashoffset = '100'; play(storyWork); } });
  $('#jy-s-close').addEventListener('click', closeStory);
  story.addEventListener('click', (e) => { if (e.target === story) closeStory(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (!b || story.contains(b)) return;
    // on the stage a record on the staff (or in the list) is picked: its card shows; the detail opens from the card
    if (STAGE && b.classList.contains('jy-sw-btn')) { stage.pick(b.dataset.open); return; }
    openStory(b.dataset.open, b);
  });

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

  /* ---------------- profile sheet ---------------- */
  const profile = $('#about');
  let untrapProfile = null, profileReturn = null;
  function openProfile(from) {
    if (!STAGE) { profile.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); profile.focus({ preventScroll: true }); return; }
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
  profile.addEventListener('click', (e) => { if (STAGE && e.target === profile) closeProfile(); });

  /* ---------------- the chapter list: the rail on wide screens; on phones it opens from the chapter chip ---------------- */
  const chipBtn = $('#jy-mchap'), menu = $('#jy-menu');
  function setMenu(open) { if (chipBtn) chipBtn.setAttribute('aria-expanded', String(open)); menu.classList.toggle('open', open); }
  document.addEventListener('click', (e) => { if (!menu.contains(e.target) && !(chipBtn && chipBtn.contains(e.target))) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); if (chipBtn) chipBtn.focus(); } });
  $$('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); setMenu(false);
    try { history.replaceState(null, '', a.getAttribute('href')); } catch (_) {}
    go(a.dataset.go, a);
  }));
  $('.jy-mark').addEventListener('click', (e) => { e.preventDefault(); try { history.replaceState(null, '', BASE + '/'); } catch (_) {} go('pro'); });

  $$('[data-profile]').forEach((b) => b.addEventListener('click', () => openProfile(b)));
  /* ---------------- discography filters: they light works, they never hide them ---------------- */
  const filter = { field: 'all', roles: new Set() };
  const roleOk = (w) => [...filter.roles].every((r) => (w.roles || []).includes(r));
  const lit = (w) => (filter.field === 'all' || w.field === filter.field) && roleOk(w);
  function applyFilter() {
    $$('.jy-fchip[data-field]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.field === filter.field)));
    $$('.jy-fchip[data-role]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === 'all' ? !filter.roles.size : filter.roles.has(b.dataset.role))));
    // songs are counted one by one, an album's tracks each as a song (as on the live site); a role counts the
    // songs (or tracks) credited with every chosen role
    const songsOf = (w) => (w.tracks && w.tracks.length > 1 ? w.tracks : [w]);
    $$('.jy-fchip[data-field]').forEach((b) => { let n = b.querySelector('small'); if (!n) { n = document.createElement('small'); b.appendChild(n); } n.textContent = WORKS.filter((w) => b.dataset.field === 'all' || w.field === b.dataset.field).reduce((t, w) => t + songsOf(w).filter((u) => [...filter.roles].every((r) => (u.roles || []).includes(r))).length, 0); });
    $$('.jy-sw').forEach((li) => li.classList.toggle('dim', !lit(bySlug[li.dataset.slug])));
    const chosen = $$('.jy-fchip[aria-pressed="true"]').filter((b) => (b.dataset.field || b.dataset.role) !== 'all').map((b) => b.firstChild.textContent.trim());
    $('#jy-fbtn').textContent = [COPY.filter, ...chosen].join(' · ');
    if (STAGE) stage.paintRecord();
  }
  $$('.jy-fchip').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.field) filter.field = b.dataset.field;
    else if (b.dataset.role === 'all') filter.roles.clear();
    else if (filter.roles.has(b.dataset.role)) filter.roles.delete(b.dataset.role); else filter.roles.add(b.dataset.role);
    applyFilter();
  }));

  /* ---------------- the inquiry: the visitor writes the empty groove ---------------- */
  const form = $('#jy-form'), note = $('#jy-note'), label = $('#jy-rec-label'), rec = $('#jy-rec'), banner = $('#jy-banner');
  let sending = false;
  form.project.addEventListener('input', () => { label.textContent = form.project.value; });
  function say(text, err) { note.textContent = text; note.classList.toggle('err', !!err); }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (sending) return;
    const value = (n) => String((form.elements[n] && form.elements[n].value) || '').trim();
    form.project.setAttribute('aria-invalid', 'false'); form.reply.setAttribute('aria-invalid', 'false');
    if (!value('project')) { form.project.setAttribute('aria-invalid', 'true'); say(COPY.needProject, true); form.project.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('reply'))) { form.reply.setAttribute('aria-invalid', 'true'); say(COPY.needEmail, true); form.reply.focus(); return; }
    const f = COPY.form || {}, contact = COPY.mail || {};
    const songs = $$('input[name="song"]:checked', form).map((x) => x.value).join(', ');
    const lines = [
      [f.nameLabel, value('name')], [f.contactLabel, value('reply')], [f.projectLabel, value('project')],
      [f.songLabel, songs], [f.budgetLabel, value('budget')], [f.scheduleLabel, value('schedule')], [f.messageLabel, value('message')],
    ].filter((r) => r[0]).map((r) => r[0] + ': ' + (r[1] || '-'));
    const subject = (contact.mailSubject || 'TALETONE MUSIC') + ' — ' + value('project');
    const mailto = () => { location.href = 'mailto:' + contact.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n')); };
    const done = () => {
      rec.classList.add('lit'); on(banner, true); say(STAGE && !html.classList.contains('jy-narrow') ? '' : COPY.received);
      $('#jy-rewind').hidden = false;
      setTimeout(() => on(banner, false), 6000);
    };
    if (!contact.formKey) { mailto(); return; }
    sending = true; say(COPY.sending);
    fetch('https://api.web3forms.com/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ access_key: contact.formKey, subject, from_name: value('name') || value('reply'), replyto: value('reply'), message: lines.join('\n') }),
    }).then((r) => r.json()).then((res) => {
      if (!res || !res.success) throw new Error('send failed');
      done();
    }).catch(() => { say(COPY.failed, true); mailto(); }).finally(() => { sending = false; });
  });
  $('#jy-rewind').addEventListener('click', () => {
    rec.classList.remove('lit'); on(banner, false); $('#jy-rewind').hidden = true; say(''); form.reset(); label.textContent = '';
    if (STAGE) stage.reset();
    go('pro');
  });

  /* ---------------- moving between scenes ---------------- */
  /* ---- Sound Engineering and ETC: the other work, as cards on a shelf over the record ----
     Each card is a video (its thumbnail turns into the player) or, without a video, the song's own audio. Sound
     Engineering can be narrowed by role (every chosen role must be credited); both show 12 more at a time. */
  const shelf = $('#jy-shelf'), cards = $('#jy-cards'), moreBtn = $('#jy-more'), shelfRoles = new Set();
  let shelfG = null, shelfShown = 12, shelfReturn = null;
  const cardKey = (k) => (k === 'Inst Mix' ? 'Mix' : k);
  function cardEl(it, g) {
    const li = document.createElement('li'); li.className = 'jy-wc';
    const box = document.createElement('div'); box.className = 'jy-wc-m';
    if (it.yt) {
      const a = document.createElement('a'); a.href = ytWatch(it.yt); a.target = '_blank'; a.rel = 'noopener'; a.className = 'jy-wc-v';
      a.setAttribute('aria-label', `${it.title} — ${it.artist} · ${COPY.video}`);
      const img = document.createElement('img'); img.src = `https://i.ytimg.com/vi/${it.yt}/hqdefault.jpg`; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; thumb(img, box);
      const pl = document.createElement('span'); pl.className = 'jy-wc-play'; pl.setAttribute('aria-hidden', 'true');
      const fb = document.createElement('span'); fb.className = 'jy-wc-fb'; fb.textContent = it.title;
      a.append(img, fb, pl); box.appendChild(a);
      a.addEventListener('click', (e) => { if (!EMBED) return; e.preventDefault(); embed(box, it.yt, `${it.title} — ${it.artist}`); });
    } else {
      box.classList.add('jy-wc-au');
      const tag = document.createElement('span'); tag.className = 'jy-wc-tag'; tag.textContent = it.roles;
      const au = document.createElement('audio'); au.controls = true; au.preload = 'none'; au.src = ASSET + it.audio; au.dataset.gain = it.gain; au.setAttribute('aria-label', it.title);
      au.addEventListener('play', () => { if (!audio.paused) pause(); quietOthers(au); applyGain(); });
      box.append(tag, au);
    }
    const copy = document.createElement('div'); copy.className = 'jy-wc-c';
    const st = document.createElement('strong'); st.textContent = it.title;
    const ar = document.createElement('span'); ar.textContent = it.artist + (it.cover ? ` · ${g.coverTag}` : '') + (it.own ? ` · ${COPY.ownSong}` : '');
    const sm = document.createElement('small'); sm.innerHTML = esc(it.roles).replace(/\(([^)]*)\)/g, '(<i>$1</i>)');
    copy.append(st, ar, sm);
    if (it.dateText) { const t = document.createElement('time'); t.dateTime = it.date; t.textContent = it.dateText; copy.appendChild(t); }
    li.append(box, copy);
    return li;
  }
  function renderShelf(focusKey) {
    const g = shelfG; if (!g) return;
    const list = g.items.filter((it) => [...shelfRoles].every((r) => it.keys.map(cardKey).includes(r)));
    const shown = list.slice(0, shelfShown);
    cards.replaceChildren(...shown.map((it) => cardEl(it, g)));
    const rest = list.length - shown.length; moreBtn.hidden = rest <= 0; moreBtn.innerHTML = `${esc(COPY.more)} <span>${rest}</span>`;
    const rr = $('#jy-shelf-roles'); rr.hidden = !g.roles; rr.textContent = '';
    if (g.roles) [['all', COPY.all], ...g.roles].forEach(([k, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'jy-fchip'; b.dataset.k = k; b.textContent = label;
      b.setAttribute('aria-pressed', String(k === 'all' ? !shelfRoles.size : shelfRoles.has(k)));
      b.addEventListener('click', () => { if (k === 'all') shelfRoles.clear(); else if (shelfRoles.has(k)) shelfRoles.delete(k); else shelfRoles.add(k); shelfShown = 12; renderShelf(k); });
      rr.appendChild(b);
    });
    $('#jy-shelf-roles').setAttribute('aria-label', COPY.roleCaption || '');
    if (focusKey) { const b = rr.querySelector(`[data-k="${focusKey}"]`); if (b) b.focus({ preventScroll: true }); }
  }
  function openShelf(key, from) {
    const g = EXTRAS[key === 'mix' ? 0 : 1]; if (!g) return;
    const was = !shelf.hidden;
    if (was) $$('#jy-shelf .jy-embed').forEach(unEmbed);
    shelfG = g; shelfShown = 12; shelfRoles.clear(); if (!was) shelfReturn = from || document.activeElement;
    $('#jy-shelf-k').textContent = COPY.tabs[key]; $('#jy-shelf-h').textContent = g.label; $('#jy-shelf-n').textContent = g.note;
    renderShelf(); shelf.hidden = false; shelf.scrollTop = 0; requestAnimationFrame(() => shelf.classList.add('open'));
    $$('.jy-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === key)));
    if (!was && STAGE) stage.hold(true);
    if (from) from.focus({ preventScroll: true });
  }
  function closeShelf() {
    if (shelf.hidden) return;
    $$('#jy-shelf .jy-embed').forEach(unEmbed); $$('#jy-shelf audio').forEach((a) => a.pause());
    shelf.classList.remove('open'); shelf.hidden = true; shelfG = null;
    $$('.jy-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === 'songs')));
    if (STAGE) stage.hold(false);
    if (shelfReturn && shelfReturn.focus) shelfReturn.focus({ preventScroll: true });
  }
  $$('.jy-tab').forEach((t) => t.addEventListener('click', () => (t.dataset.tab === 'songs' ? closeShelf() : openShelf(t.dataset.tab, t))));
  $('#jy-shelf-x').addEventListener('click', closeShelf);
  moreBtn.addEventListener('click', () => { shelfShown += 12; renderShelf(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !shelf.hidden && story.hidden && !profile.classList.contains('open')) closeShelf(); });
  // the history: the profile's full credits, by year
  $$('[data-history]').forEach((b) => b.addEventListener('click', () => { openProfile(b); const d = $('.jy-p-all'); if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }), 350); } }));

  function go(where, from) {
    if (where === 'profile') { openProfile(from); return; }
    closeShelf();
    if (!STAGE) {
      const id = { pro: 'journey', tale: 'intro', tone: 'approach', record: 'discography', epi: 'contact' }[where];
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    stage.go(where);
  }

  /* ======================= the stage ======================= */
  const stage = (() => {
    if (!STAGE) return { paintRecord() {}, reset() {}, syncInert() {}, go() {} };
    const stageEl = $('#jy-stage'), cv = $('#jy-cv'), ctx = cv.getContext('2d');
    const track = $('#jy-track');
    // a screen of scrolling for each unit of the story
    const PER_U = 100;
    track.style.setProperty('--track', (TOTAL * PER_U + 100) + 'vh');
    const sections = $$('.jy-ch');
    // the lock screen's film: loaded once the page has loaded (it is not what the first paint waits for), silent, looping,
    // paused while the phone is gone or the tab hidden; with reduced motion only its first frame shows
    const lockVid = $('#jy-lockvid'), lockShade = $('.jy-lockshade');
    // on a metered or slow connection (data saver, 2G/3G) the lock screen keeps its still instead of the film
    const SAVE_DATA = (() => { try { const c = navigator.connection; return !!c && (c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || '')); } catch (_) { return false; } })();
    let lockVidOn = false;
    function lockVidPlay(on) {
      if (!lockVid || reduce || on === lockVidOn) return; lockVidOn = on;
      if (on && SAVE_DATA) return;
      if (on) { if (!lockVid.getAttribute('src')) lockVid.src = lockVid.dataset.src; const p = lockVid.play(); if (p) p.catch(() => {}); } else lockVid.pause();
    }
    // (started by the frame loop once the page has loaded, and only while the phone is there: a visitor who lands deep in
    // the story never loads it)
    document.addEventListener('visibilitychange', () => { if (document.hidden) lockVidPlay(false); });
    // ---- entering (see ENTER) ----
    const frontFace = $('#jy-phone .jy-front'), blackout = $('#jy-blackout'), pshot = $('#jy-pshot'), pcloud = $('#jy-pcloud'), pctx = pcloud.getContext('2d'), topBar = $('.jy-top'), railEl = $('.jy-rail');
    let cloud = null;
    // The land as it will be met, drawn once into the world canvas from the first camera (with the land a little way along
    // so there is something to see) and cut to the screen's shape: a picture for the screen, and points sampled from it.
    function buildCloud() {
      const r = screen.getBoundingClientRect(), sw = screen.offsetWidth || 218, sh = screen.offsetHeight || 400, ar = sw / sh;
      const keep = { z: penZ, cam: getCam(), lead: leadOf }; leadOf = null;
      penZ = SET.land[1] + 0.4; setCam(rig(PEN.tale[0], 0));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); drawWorld(1);
      const cw = Math.min(W, H * ar), ch = cw / ar, cx = (W - cw) / 2, cy = (H - ch) / 2;
      const pw = Math.round(cw * DPR), ph = Math.round(ch * DPR);
      pshot.width = pw; pshot.height = ph; const sctx = pshot.getContext('2d');
      sctx.fillStyle = '#fefefe'; sctx.fillRect(0, 0, pw, ph); sctx.drawImage(cv, Math.round(cx * DPR), Math.round(cy * DPR), pw, ph, 0, 0, pw, ph);
      // (sampled from the picture as seen on paper: points go where it changes, the outlines of hills, poles and trees)
      const img = sctx.getImageData(0, 0, pw, ph).data, lum = (o) => img[o] * 0.3 + img[o + 1] * 0.59 + img[o + 2] * 0.11, st = Math.max(2, Math.round(DPR * 1.5));
      ctx.clearRect(0, 0, W, H); penZ = keep.z; setCam(keep.cam); leadOf = keep.lead;
      const S = 1.6; pcloud.width = Math.round(sw * S * (DPR > 1 ? 1.5 : 1)); pcloud.height = Math.round(sh * S * (DPR > 1 ? 1.5 : 1));
      const n = NARROW ? 1900 : 2600, pts = [], PAL = [[214, 233, 246], [200, 214, 236], [190, 222, 199], [214, 230, 186]];
      for (let tries = 0; pts.length < n && tries < n * 60; tries++) {
        const x = (Math.random() * (pw - st)) | 0, y = (Math.random() * (ph - st)) | 0, o = (y * pw + x) * 4;
        const edge = Math.abs(lum(o) - lum(o + st * 4)) + Math.abs(lum(o) - lum(o + st * pw * 4)); if (edge < 14 && Math.random() > 0.005) continue;
        const v = y / ph, base = v < 0.38 ? PAL[0] : v < 0.52 ? PAL[1] : PAL[2 + ((x + y) & 1)], c = [0, 1, 2].map((k) => Math.round(lerp(img[o + k], base[k], 0.45) * 1.15));
        pts.push({ u: x / pw, v, c: `${Math.min(255, c[0])},${Math.min(255, c[1])},${Math.min(255, c[2])}`, s: 0.8 + Math.random() * 1.1 });
      }
      // (and a dust of light across the sky, so the whole screen fills)
      for (let k = 0; k < n * 0.14; k++) pts.push({ u: Math.random(), v: Math.random() * 0.55, c: '236,242,252', s: 0.5 + Math.random() * 0.6, dust: 1 });
      // each comes from outside the screen or out of its depth, at its own moment
      for (const p of pts) { const a = Math.random() * Math.PI * 2, far = Math.random() < 0.55; p.sx = far ? 0.5 + Math.cos(a) * (0.9 + Math.random() * 0.8) : 0.5 + (p.u - 0.5) * 0.08; p.sy = far ? 0.5 + Math.sin(a) * (0.9 + Math.random() * 0.8) : 0.5 + (p.v - 0.5) * 0.08; p.d = Math.random() * 0.45; p.tw = Math.random() * 6.3; }
      cloud = { pts };
    }
    function drawEnter(ip) {
      const g = clamp((ip - 0.33) / 0.1), form = clamp((ip - 0.45) / 0.25), lit = ease((ip - 0.68) / 0.1), wash = ease((ip - 0.84) / 0.12);
      const blk = ease((ip - 0.35) / 0.08) * (1 - ease((ip - 0.86) / 0.12));
      blackout.style.opacity = String(blk);
      topBar.style.opacity = railEl.style.opacity = blk > 0.01 ? String(1 - 0.92 * blk) : '';
      // the film breaks up: it shakes, its colours tear, it collapses to a bright line and goes out
      if (lockVid) {
        if (g > 0 && g < 1 && !reduce) {
          const sy = g < 0.7 ? 1 : Math.max(0.006, 1 - ease((g - 0.7) / 0.2)), sx = g < 0.9 ? 1 : Math.max(0.01, 1 - ease((g - 0.9) / 0.1)), jx = (Math.random() - 0.5) * 16 * (1 - g * 0.6);
          lockVid.style.transform = `translateX(${jx.toFixed(1)}px) scale(${sx},${sy})`;
          lockVid.style.filter = `contrast(${(1 + g * 0.8).toFixed(2)}) saturate(${(1 + g).toFixed(2)}) brightness(${(1 + 2.5 * ease((g - 0.6) / 0.35)).toFixed(2)}) hue-rotate(${((Math.random() - 0.5) * 50) | 0}deg)`;
        } else { lockVid.style.transform = ''; lockVid.style.filter = ''; }
        lockVid.style.opacity = g >= 1 ? '0' : '1'; lockShade.style.opacity = String(1 - ease(g / 0.7));
      }
      lock.style.opacity = String(g > 0 && g < 0.4 && !reduce ? (Math.random() < 0.35 ? 0.15 : 1) * (1 - g / 0.4) : g >= 0.4 ? 0 : 1);
      // the points, then the picture lighting up under them, then washing out white as the visitor goes in
      const wantCloud = ip > 0.33 && ip < 0.98;
      if (wantCloud && !cloud) buildCloud();
      pshot.style.opacity = String(lit * (1 - ease((wash - 0.25) / 0.6)));
      pshot.style.filter = wash > 0 ? `brightness(${(1 + 1.4 * wash).toFixed(2)}) saturate(${(1 - 0.6 * wash).toFixed(2)})` : lit > 0 ? `brightness(${(1 + 0.18 * lit).toFixed(2)})` : '';
      const tear = g > 0 && g < 1 && !reduce, showPts = cloud && form > 0 && lit < 1;
      pcloud.style.opacity = tear || showPts ? '1' : '0';
      if (!tear && !showPts) return;
      const cw = pcloud.width, ch = pcloud.height, t = reduce ? 0 : T;
      pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, cw, ch);
      if (tear) {
        // static: torn bars and snow over the film
        for (let k = 0; k < 9; k++) { const y = Math.random() * ch, hh = 1 + Math.random() * ch * 0.03; pctx.fillStyle = ['rgba(255,255,255,', 'rgba(110,232,240,', 'rgba(246,120,190,'][k % 3] + (0.15 + 0.5 * Math.random()) + ')'; pctx.fillRect(0, y, cw, hh); }
        pctx.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 500; k++) pctx.fillRect(Math.random() * cw, Math.random() * ch, 1.5, 1.5);
      }
      if (showPts) {
        pctx.globalCompositeOperation = 'lighter';
        const fade = 1 - lit, sc = cw / 300;
        for (const p of cloud.pts) {
          const k = reduce ? 1 : ease(clamp((form - p.d) / 0.55)); if (k <= 0) continue;
          const x = lerp(p.sx, p.u, k) * cw, y = lerp(p.sy, p.v, k) * ch, a = (0.35 + 0.65 * k) * fade * (p.dust ? 0.5 + 0.5 * Math.sin(t * 3 + p.tw) : 1);
          const r = p.s * sc * 1.25 * (k < 1 ? 1.5 - 0.5 * k : 1);
          pctx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`; pctx.fillRect(x - r / 2, y - r / 2, r, r);
        }
        pctx.globalCompositeOperation = 'source-over';
      }
    }
    const phone = $('#jy-phone'), phoneCharm = $('#jy-phone .jy-charm'), card = $('#jy-card'), screen = $('#jy-screen'), lead = $('#jy-lead'), lock = $('#jy-lock');
    const frame = $('#jy-frame'), frameScr = $('.jy-scr', frame);
    const markImg = $('.jy-mark img');
    const recordEl = $('#jy-record'), spiral = $('#jy-spiral'), readout = $('#jy-readout');
    const items = $$('.jy-sw', spiral);
    const N = items.length;
    let W = 0, H = 0, DPR = 1, T = 0, last = 0, passing = false;
    // NARROW: a phone or an upright screen. The scene keeps to the upper part (horizon HZ higher), the words to the
    // bottom, the record sits in the middle above its card.
    let NARROW = false, HZ = 0.46;
    let palette = [];
    let chapter = '', caseOffer = false, recBuilt = false;
    const CASE = ($('.jy-case-btn') || {}).dataset ? $('.jy-case-btn').dataset.open : null;
    const rail = $$('.jy-rail a'), railOf = { pro: 'pro', tale: 'tale', tone: 'tone', case: 'tone', music: 'tone', record: 'record', done: 'record', epi: 'epi' };
    // ---- on a phone: a chapter chip and a progress line instead of the rail, sheets instead of panels ----
    const mchap = $('#jy-mchap'), mprog = $('#jy-mprog'), fbtn = $('#jy-fbtn'), filtersEl = $('#jy-filters'), scrim = $('#jy-scrim');
    const contactEl = $('#jy-contact'), fopen = $('#jy-fopen');
    mchap.setAttribute('aria-expanded', 'false');
    mchap.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!menu.classList.contains('open')); });
    let sheet = null, heldY = 0, holds = 0;
    function holdStory(on) {
      if (on) { if (holds++ === 0) { heldY = scrollY; frozenU = U(); html.classList.add('jy-held'); } return; }
      if (holds > 0 && --holds === 0) { html.classList.remove('jy-held'); frozenU = null; scrollTo(0, heldY); }
    }
    // one sheet at a time: the filters, or the inquiry (which also holds the page still, so typing never scrolls the story)
    function setSheet(which, opener) {
      if (sheet === which) return;
      if (sheet === 'form') holdStory(false);
      sheet = which;
      filtersEl.classList.toggle('open', which === 'filters'); fbtn.setAttribute('aria-expanded', String(which === 'filters'));
      contactEl.classList.toggle('open', which === 'form'); fopen.setAttribute('aria-expanded', String(which === 'form'));
      scrim.hidden = which !== 'filters';
      if (which === 'form') { holdStory(true); setTimeout(() => $('#jy-f-project').focus({ preventScroll: true }), 60); }
      if (which === 'filters') setTimeout(() => $('.jy-fchip[aria-pressed="true"]', filtersEl)?.focus({ preventScroll: true }), 60);
      if (!which && opener) opener.focus({ preventScroll: true });
    }
    fbtn.addEventListener('click', () => setSheet(sheet === 'filters' ? null : 'filters'));
    $('#jy-fclose').addEventListener('click', () => setSheet(null, fbtn));
    scrim.addEventListener('click', () => setSheet(null, fbtn));
    fopen.addEventListener('click', () => setSheet('form'));
    $('#jy-cclose').addEventListener('click', () => setSheet(null, fopen));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet) setSheet(null, sheet === 'form' ? fopen : fbtn); });

    // while the inquiry sheet is open the story holds still, whatever the browser does to the scroll as fields take focus
    let frozenU = null;
    const U = () => { if (frozenU != null) return frozenU; const m = document.documentElement.scrollHeight - innerHeight; return m > 0 ? (scrollY / m) * TOTAL : 0; };
    const topFor = (u) => (u / TOTAL) * (document.documentElement.scrollHeight - innerHeight);
    // a jump (rail, menu, the record's arrows) passes through scene changes without playing them
    let navUntil = 0;
    const goU = (u, smooth = true) => { navUntil = performance.now() + 4000; auto = null; hold = null; if (asking) unask(); scrollTo({ top: topFor(u), behavior: smooth && !reduce ? 'smooth' : 'auto' }); };

    /* ---- the story's two kinds of motion ----
       Reading belongs to the visitor: the scroll moves the words, at the visitor's pace. A change of scene belongs
       to the story: one scroll down at its edge and it plays through at its own pace (going back up is plain scrolling), stops
       where the next words are, swallows the rest of that flick, and a small cue says it is the visitor's turn.
       [from, to, ms, ask] in story units; each 'to' is where the next words have just arrived. Where a scene leaves
       one place for the next (ask), the story first stops after the chapter's last words and asks whether to go on:
       one more scroll down (a new one, not the rest of the last), the button or the down key goes on; up goes back. */
    const ENTER = [0.33, uOfPen(SET.land[0] + 0.01), 0, 0, [[0.45, 1500, 250], [0.7, 2000, 350], [1, 1500, 0], [uOfPen(SET.land[0] + 0.01), 1100, 0]]];
    const AUTO = [
      [0.02, 0.30, 900],    // the phone turns over: a message on its lock screen
      // entering: the film breaks up and goes out and the room goes dark; points gather into the land in the screen; it
      // lights up and the visitor is drawn in: the first hello (beats: the dark, the land formed, inside, the hello)
      ENTER,
      // straight up into the sky, where a phone comes down the line and stops; its screen wakes; it pulls the visitor
      // in, and somewhere it became straight down into the sea
      [uOfPen(SET.land[3] + 0.4), uOfPen(SET.sea[0] + 0.1), 0, 1, [[uOfPen(ZS - PH.land * (1 - PH_HOLD)), 2600, 250], [uOfPen(ZS - PH.land * (1 - PH_WAKE)), 1200, 0], [uOfPen(SET.sea[0] + 0.1), 2400, 0]]],
      // down into the dark, a phone comes up the line and wakes, and pulls the visitor out into space: a real project
      [uOfPen(SET.sea[3] + 0.56), uOfPen(SET.space[0] + 0.15), 0, 1, [[uOfPen(S0 - PH.sea * (1 - PH_HOLD)), 2000, 250], [uOfPen(S0 - PH.sea * (1 - PH_WAKE)), 1200, 0], [uOfPen(SET.space[0] + 0.15), 2200, 0]]],
      [uOfPen(SET.space[3] + 0.8), uOfPen(PEN.music[1] - 0.75), 2400, 1],   // along the stars to the record: found
      [CH.music[1] - 0.06, CH.record[0] + 0.4, 1500],   // the line splits in five and draws the staff: the first song
      // past the last song, all the way into the inquiry in one go, resting a moment on each of the words between:
      // the staff becomes the record's groove and the record goes into the phone (the letter), the empty seat, and the
      // line out to the form. Steps: [where, ms to get there, ms to rest there]
      [CH.done[0] - 0.3, CH.epi[0] + 0.55, 0, 1, [[CH.done[0] + 0.65, 2300, 150], [CH.epi[0] + 0.18, 1000, 900], [CH.epi[0] + 0.55, 1200, 0]]],
    ];
    let auto = null, hold = null, lastU = 0, inputAt = 0, asking = null;
    const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const cueEl = $('#jy-cue'), cue = (v) => cueEl && cueEl.classList.toggle('on', v);
    // rest: further steps of the same scene, each [where, ms, ms to rest there]; a step's start can lie in the future
    // (the rest after the step before), where it simply stays put
    function runAuto(from, to, ms, rest = [], pause = 0) { auto = { from, to, t0: performance.now(), d: reduce ? 0 : ms, rest, pause }; cue(false); }
    // play a scene from u on: straight to its end, or through those of its steps still ahead
    function playScene([a, b, ms, , steps], u) {
      if (!steps) { runAuto(u, b, (ms * (b - u)) / (b - a)); return; }
      const ahead = steps.filter((st) => st[0] > u + 0.003), prev = steps[steps.indexOf(ahead[0]) - 1], from0 = prev ? prev[0] : a;
      if (!ahead.length) return;
      const [to, ms0, rest0] = ahead[0];
      runAuto(u, to, (ms0 * (to - u)) / (to - from0), ahead.slice(1), rest0);
    }
    function autoStep(now) {
      if (auto) {
        const k = auto.d ? clamp((now - auto.t0) / auto.d) : 1;
        scrollTo({ top: topFor(lerp(auto.from, auto.to, easeIO(k))), behavior: 'instant' });
        if (k >= 1 && auto.rest.length) { const [to, ms, pause] = auto.rest[0]; lastU = auto.to; auto = { from: auto.to, to, t0: now + (reduce ? 0 : auto.pause), d: reduce ? 0 : ms, rest: auto.rest.slice(1), pause }; }
        else if (k >= 1) { hold = { u: auto.to, t0: now }; lastU = auto.to; auto = null; }
      } else if (hold && ((now - hold.t0 > 450 && now - inputAt > 220) || now - hold.t0 > 1800)) { hold = null; cue(true); }
    }
    const swallow = (e) => { if (!auto && !hold) return; inputAt = performance.now(); if (e.cancelable) e.preventDefault(); };
    // asking before the next place: the story waits at the scene's edge
    const askEl = $('#jy-ask');
    function ask(seg) { asking = { seg, t0: performance.now() }; scrollTo({ top: topFor(seg[0]), behavior: 'instant' }); lastU = seg[0]; askEl.classList.add('on'); html.classList.add('jy-asking'); $('#jy-ask-go').tabIndex = 0; cue(false); }
    function unask() { if (!asking) return; asking = null; askEl.classList.remove('on'); html.classList.remove('jy-asking'); $('#jy-ask-go').tabIndex = -1; }
    function goOn() { const s = asking && asking.seg; if (!s) return; unask(); playScene(s, s[0]); }
    $('#jy-ask-go').addEventListener('click', goOn);
    addEventListener('wheel', (e) => {
      if (asking) {
        const now = performance.now(), fresh = now - inputAt > 260; inputAt = now;
        if (e.deltaY < 0) { unask(); return; }
        if (e.cancelable) e.preventDefault();
        if (e.deltaY > 0 && fresh && now - asking.t0 > 500) goOn();
        return;
      }
      swallow(e);
    }, { passive: false });
    let touchY = 0;
    addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
    addEventListener('touchmove', (e) => {
      if (asking) {
        const dy = touchY - e.touches[0].clientY; inputAt = performance.now();
        if (dy < -12) { unask(); return; }
        if (e.cancelable) e.preventDefault();
        if (dy > 30 && performance.now() - asking.t0 > 500) goOn();
        return;
      }
      swallow(e);
    }, { passive: false });
    addEventListener('keydown', (e) => {
      if (!asking || e.target.closest('input,textarea,select')) return;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); if (performance.now() - asking.t0 > 300) goOn(); }
      else if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) unask();
    });
    // presenting (a shared screen, a meeting): the number keys 1 to 5 go straight to the chapters
    addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('input,textarea,select,[contenteditable]') || !story.hidden) return;
      const n = '12345'.indexOf(e.key); if (n < 0) return;
      const a = $$('.jy-rail a[data-go]')[n]; if (a) { e.preventDefault(); unask(); a.click(); }
    });
    addEventListener('keydown', (e) => { if ((auto || hold) && [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && !e.target.closest('input,textarea,select')) e.preventDefault(); });
    addEventListener('scrollend', () => { if (navUntil && !auto) { navUntil = 0; lastU = U(); } });
    addEventListener('scroll', () => {
      if (auto) return;
      const u = U();
      if (hold) { if (Math.abs(u - hold.u) > 0.002) scrollTo({ top: topFor(hold.u), behavior: 'instant' }); return; }
      if (asking) { if (u < asking.seg[0] - 0.01) { unask(); lastU = u; } else if (Math.abs(u - asking.seg[0]) > 0.002) scrollTo({ top: topFor(asking.seg[0]), behavior: 'instant' }); return; }
      if (performance.now() < navUntil || frozenU != null) { lastU = u; return; }
      cue(false);
      // only going on plays a scene (from wherever in it the visitor is); going back is plain scrolling
      if (u > lastU) for (const sc of AUTO) {
        const [a, b, , gate] = sc;
        if (u > a && u < b) { if (gate && lastU <= a + 0.003) ask(sc); else playScene(sc, u); break; }
      }
      lastU = u;
    }, { passive: true });

    // clock on the lock screen
    // The visitor's own time, as their device shows it: its time zone and its 12- or 24-hour clock (a lock screen
    // leaves out AM/PM); the date line in the page's language. It keeps time while the page is open.
    { const loc = { kr: 'ko-KR', en: 'en-US', jp: 'ja-JP' }[LANG], clockEl = $('#jy-clock'), dateEl = $('#jy-date');
      let fmt = null; try { fmt = new Intl.DateTimeFormat(navigator.languages && navigator.languages.length ? navigator.languages : undefined, { hour: 'numeric', minute: '2-digit' }); } catch (_) {}
      let shown = '';
      const tick = () => {
        const d = new Date();
        let time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        if (fmt && fmt.formatToParts) { try { time = fmt.formatToParts(d).filter((x) => x.type !== 'dayPeriod').map((x) => x.value).join('').trim(); } catch (_) {} }
        if (time === shown) return; shown = time; clockEl.textContent = time;
        try { dateEl.textContent = d.toLocaleDateString(loc, { month: 'long', day: 'numeric', weekday: 'long' }); } catch (_) {}
      };
      tick(); setInterval(tick, 5000); }

    /* ---- one world in depth. The pen draws a single line forward through it and the camera follows the pen,
       a few steps behind. Hills, poles, the wire, grass and clouds stand along the way; every message is written
       at a point of the line and recedes as the visitor passes it. At the end the same line coils around the
       view, and in the next chapter it splits into the five lines of the staff. ---- */
    const pinned = WORKS.filter((w) => w.pinned).sort((a, b) => a.pinned - b.pinned);
    Promise.all(pinned.map(sample)).then(() => { palette = pinned.map((w, i) => ({ slug: w.slug, c: colorOf[w.slug], s: 1 - i * 0.1 })).filter((p) => p.c); });
    const layerColour = (i) => { const fall = [[176, 178, 184], [163, 168, 181], [159, 161, 166]]; return (palette[i % Math.max(1, palette.length)] || { c: fall[i % 3] }).c; };
    // three worlds along one line, a gate (a phone's screen) between them: the land of the intro (mountains,
    // grass, poles and the wire), the sea of the philosophy (the line dives in like a fishing line) and the space
    // of the real project (the line joins star to star). Everything starts pale and colourless; what the pen has
    // passed slowly takes on a pastel colour.
    // the land ends where the line lifts off the last pole and swings up, steeper and steeper, until it runs straight
    // up into the sky (from CL0, CLH high at ZS); the camera rides the line and ends up looking straight up. Then the
    // trick: looking straight up into a clear sky and straight down into clear water look the same (the line runs
    // into the middle of the screen, everything passes outwards), so at ZS the world is quietly swapped for the sea,
    // the camera now looking down. The end of the line is a fishing line going straight down into the deep (DD in
    // all), and what passes is no longer clouds but bubbles, fish, rays and jellyfish, darker and darker, until a phone
    // comes up out of the dark at S0 and through it is space.
    // Each world has one kind of thing each of its messages is set on, where the line is when the message comes:
    // a pole on the land (the line rests on its top), a jellyfish of light in the sea (the line threads through it and
    // it lights up), a star in space (the line turns at it and it lights up).
    const CLH = 40, CLX = 2.6, DD = 232, YS = 7.25, YB = 7;
    const WIRE = [OBJ.land[0], OBJ.land[7]], POLE = 1.8, GROUND = 1.35, AHEAD = 4.2, FAR3 = 26, TAIL = PEN.music[1] - 2.5;
    const PASTEL = { land: { sky: [214, 233, 246], hill: [[190, 222, 199], [214, 230, 186], [200, 214, 236]], grass: [140, 190, 150], pole: [196, 170, 150], cloud: [250, 226, 236] },
      space: { sky: [226, 220, 245], star: [[252, 232, 170], [246, 196, 222], [196, 214, 250]] } };
    const tint = (c, k, a) => `rgba(${Math.round(lerp(150, c[0], k))},${Math.round(lerp(152, c[1], k))},${Math.round(lerp(160, c[2], k))},${a})`;
    const passed = (z, lag = 0.4) => ease(clamp((penZ - z - lag) / 2.6)); // 0 pale, 1 fully coloured
    const penAt = (u) => { for (const k of ['music', 'case', 'tone', 'tale']) { const l = local(u, k); if (l > 0) return lerp(PEN[k][0], PEN[k][1], clamp(k === 'tale' ? (l - 0.08) / 0.92 : l)); } return PEN.tale[0]; };
    const wireW = (z) => clamp((z - WIRE[0] + 0.8) / 0.8) * clamp((WIRE[1] + 0.8 - z) / 0.8);
    // the end of the constellation: the line leaves the last star for the head of the staff (set in buildCurrent),
    // where it splits in five and draws the record's staff
    const climbK = (z) => clamp((z - CL0) / (ZS - CL0));
    // which world a point of the line is in (0 the land, 1 the sea, 2 space), and how high the line runs there without
    // its small waves: climbing on the land, straight down in the sea (straight up out of it before ZS), level in space
    const worldOf = (z) => (z < ZS ? 0 : z < S0 ? 1 : 2);
    // the dive slows down at each jellyfish, so the depth (and the colour of the water) holds while its message is
    // read, and goes on between them: depth = DD * dive(z), dive rising from 0 at ZS to 1 at S0
    const DIVE_T = (() => { const n = 600, t = [0]; let s = 0; for (let i = 1; i <= n; i++) { const z = ZS + ((i - 0.5) / n) * (S0 - ZS); let slow = 0; for (const sz of SET.sea) slow = Math.max(slow, Math.exp(-Math.pow((z - sz - 0.5) / 0.9, 2))); s += 1 - 0.82 * slow; t.push(s); } return t.map((v) => v / s); })();
    const dive = (z) => { const f = clamp((z - ZS) / (S0 - ZS)) * (DIVE_T.length - 1), i = Math.min(DIVE_T.length - 2, Math.floor(f)); return lerp(DIVE_T[i], DIVE_T[i + 1], f - i); };
    const SL0 = (DD * DIVE_T[1] * (DIVE_T.length - 1)) / (S0 - ZS), SL1 = (DD * (1 - DIVE_T[DIVE_T.length - 2]) * (DIVE_T.length - 1)) / (S0 - ZS);
    const seaY = (z) => (z < ZS ? SL0 * (z - ZS) : z > S0 ? DD + SL1 * (z - S0) : DD * dive(z));
    // where along the dive the line is y deep
    const zOfDepth = (y) => { if (y <= 0) return ZS + y / SL0; if (y >= DD) return S0 + (y - DD) / SL1; let lo = ZS, hi = S0; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (seaY(m) < y) lo = m; else hi = m; } return (lo + hi) / 2; };
    const baseOf = (z, w) => (w === 0 ? -CLH * Math.pow(climbK(z), CLX) : w === 1 ? seaY(z) : YB);
    const xAt = (z) => -0.35 + 0.5 * Math.sin(z * 0.33) + 0.15 * Math.sin(z * 0.91 + 1.2);
    // how deep the camera is in the sea: 0 at the top, 1 at the bottom where space opens
    const depthK = () => clamp(camY / DD);
    const spaceIn = () => (penZ >= S0 ? 1 : 0);
    const tailK = (z) => ease((z - TAIL) / (PEN.music[1] - TAIL));
    // tail.T: the staff's head on screen, tail.tg: the way the staff leaves it (both from the final camera)
    let tail = { T: [0, 0], tg: [1, 0], L: 0 };
    function tailAt(z) {
      const cz = PEN.music[1] - AHEAD, s = clamp((z - TAIL) / (PEN.music[1] - TAIL)), d = Math.max(0.2, z - cz) / F3;
      return [(tail.T[0] - tail.tg[0] * tail.L * (1 - s) - W / 2) * d, (tail.T[1] - tail.tg[1] * tail.L * (1 - s) - H * HZ) * d + YS];
    }
    // the constellation: stars at fixed points, the line runs straight from one to the next
    // (the stars of the case's messages at SET.space; others before and after)
    const STARS = (() => { let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); const zs = [S0 + 1.2, S0 + 2.85, ...OBJ.space]; for (let z = OBJ.space[7] + 1.7; z < PEN.music[1] + 1; z += 1.5 + r() * 0.5) zs.push(z); return zs.map((z) => [-0.4 + (r() - 0.5) * 1.6, YS - 0.55 + (r() - 0.5) * 1.1, z]); })();
    function constAt(z) {
      if (z <= STARS[0][2]) return STARS[0];
      for (let i = 1; i < STARS.length; i++) if (z <= STARS[i][2]) { const a = STARS[i - 1], b = STARS[i], f = (z - a[2]) / (b[2] - a[2]); return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), z]; }
      return STARS[STARS.length - 1];
    }
    function pathAt(z, w = worldOf(z)) {
      let x = xAt(z), y = 0.35 + 0.16 * Math.sin(z * 0.47);
      if (w === 0) {
        const ww = wireW(z);
        if (ww > 0) { let f = ((z - WIRE[0]) / POLE) % 1; if (f < 0) f += 1; y = lerp(y, -0.55 + 0.2 * 4 * f * (1 - f), ww); }
        // off the last pole and up into the sky
        if (z > CL0) y = -0.55 + baseOf(z, 0);
      } else if (w === 1) {
        // the fishing line, straight down
        y = baseOf(z, 1);
      } else {
        // space: level, then from star to star
        y = YS - 0.55;
        const ck2 = ease((z - S0) / 2.6);
        if (ck2 > 0) { const c = constAt(z); x = lerp(x, c[0], ck2); y = lerp(y, c[1], ck2); }
        // aimed in screen terms: from the last star the line swings onto the way the staff leaves, and comes in along it
        const tk = ease((z - TAIL) / 2.1);
        if (tk > 0) { const t2 = tailAt(z); x = lerp(x, t2[0], tk); y = lerp(y, t2[1], tk); }
      }
      return [x, y, z];
    }
    // the line as the sea and as space have it, before and after their own stretch too
    const seaPath = (z) => pathAt(z, 1), spacePath = (z) => pathAt(z, 2);
    let penZ = PEN.tale[0], camX = 0, camY = 0, camZ = -1, camP = 0, cP = 1, sP = 0, F3 = 800;
    // the camera looks along +z, tilted up by camP (down when negative); y runs downward
    const setCam = (c) => { camX = c.x; camY = c.y; camZ = c.z; camP = c.p; cP = Math.cos(c.p); sP = Math.sin(c.p); };
    const getCam = () => ({ x: camX, y: camY, z: camZ, p: camP });
    const V = (p) => { const rx = p[0] - camX, ry = p[1] - camY, rz = p[2] - camZ, d = rz * cP - ry * sP; if (d < 0.12) return null; const s3 = F3 / d; return [W / 2 + rx * s3, H * HZ + (ry * cP + rz * sP) * s3, d]; };
    // how far above the horizon (radians) the camera looks at screen row y
    const elevAt = (y) => camP - Math.atan((y - H * HZ) / F3);
    // the camera rides the line AHEAD behind the pen (measured along the line), a little above it, looking along the
    // chord to the pen: on the level it is the old view, where the line bends up or down the camera turns with it
    function rig(pz, w) {
      let z = pz, y = baseOf(z, w), L = 0;
      while (L < AHEAD && z > -4) { const z2 = z - 0.02, y2 = baseOf(z2, w); L += Math.hypot(0.02, y - y2); z = z2; y = y2; }
      const p = Math.atan2(y - baseOf(pz, w), pz - z), ck = tailK(pz), cp = Math.cos(p), sp = Math.sin(p);
      // where the line bows up between the camera and the pen (as it goes over into a dive), the camera rises just
      // enough above it that no part of the line shows above the pen on the screen (h high, d deep: o >= h L / (L - d))
      const Lc = Math.hypot(pz - z, baseOf(pz, w) - y); let o = 0.45;
      for (let i = 1; i < 12; i++) { const zi = lerp(z, pz, i / 12), dy = baseOf(zi, w) - y, h = -dy * cp - (zi - z) * sp, d = (zi - z) * cp - dy * sp; if (h > 0 && d < Lc - 0.05) o = Math.max(o, Math.min(3, (1.1 * h * Lc) / (Lc - d))); }
      // (and, while it runs level, partly follows the line's small waves and sags, and its stars sideways)
      const pc = pathAt(pz - 1.2, w), wob = 0.7 * (pc[1] - baseOf(pz - 1.2, w)) * cp * cp;
      // (raised, it looks down at the pen so the pen stays where it always is on the screen; turning does not change
      // which points show above which)
      const cy = y - o * cp, cz = z - o * sp, p2 = Math.atan2(cy - baseOf(pz, w), pz - cz) + Math.atan(0.45 / Lc);
      return { x: lerp(pc[0] * 0.35, 0, ck), y: lerp(cy + wob, YS, ck), z: cz, p: p2 };
    }
    const fogA = (dz) => clamp((FAR3 - dz) / 8) * clamp((dz - 0.15) / 0.5);

    let puffs = [], mounts = [], birds = [], shafts = [], kelps = [], whale = null, fish = [], mantas = [], snow = [], jellies = [], glows = [], ridges = [], clouds = [], grass = [], poles = [], bubbles = [], stars = [], nebulae = [], milky = [], bodies = [];
    let spaceDark = 0, lineRGB = INK;
    const dots = [];
    function buildWorld() {
      F3 = Math.min(NARROW ? Math.max(W, H * 0.75) : W, H * 1.6) * 0.62;
      const dens = NARROW ? 0.55 : 1;
      let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const G2 = S0;
      // far ranges: triangular peaks, snow where they are highest
      mounts = [[CL0 + 14, 3.4, [184, 198, 232]], [CL0 + 8, 2.4, [168, 206, 200]]].map(([z, hMax, c]) => {
        const pk = []; for (let x = -30; x < 30;) { const h = hMax * (0.45 + rnd() * 0.55), w2 = 2.2 + rnd() * 2.6; pk.push([x + w2 * 0.5, h, w2]); x += w2 * (0.5 + rnd() * 0.35); }
        const pts = []; for (let x = -31; x <= 31.001; x += 0.3) { let h = 0; for (const [px, ph, pw] of pk) h = Math.max(h, ph * Math.max(0, 1 - Math.abs(x - px) / (pw * 0.5))); pts.push([x, GROUND - h, z]); }
        const peaks = pk.filter((p) => p[1] > hMax * 0.8).map(([px, ph, pw]) => [[px, GROUND - ph, z], [px - pw * 0.1, GROUND - ph * 0.8, z], [px + pw * 0.1, GROUND - ph * 0.8, z]]);
        return { z, hMax, c, pts, peaks };
      });
      ridges = [];
      for (let k = 0, z = 2.2; z < ZS; k++, z += 1.8 + rnd() * 1.2) {
        const amp = 0.35 + rnd() * 0.55 + (k % 4 === 3 ? 0.45 : 0), f1 = 0.5 + rnd() * 0.7, f2 = 1.4 + rnd(), p1 = rnd() * 6, p2 = rnd() * 6, pts = [];
        for (let x = -14; x <= 14.001; x += 0.25) pts.push([x, GROUND - amp * (0.55 + 0.45 * Math.sin(x * f1 + p1)) * (0.7 + 0.3 * Math.sin(x * f2 + p2)), z]);
        const trees = []; if (k % 3 !== 1) { const n = 2 + ((rnd() * 5) | 0); for (let j = 0; j < n; j++) trees.push({ i: 4 + ((rnd() * (pts.length - 8)) | 0), s: 0.7 + rnd() * 0.7 }); }
        ridges.push({ z, k, pts, trees });
      }
      ridges.sort((a, b) => b.z - a.z);
      grass = [];
      for (let z = 1.2; z < CL0 + 0.6; z += 0.08 + rnd() * 0.1) {
        const x = pathAt(z)[0] + (rnd() - 0.5) * 5, blades = [];
        for (let j = 0; j < 5; j++) blades.push({ dx: (j - 2) * 0.012, h: (j === 2 ? 0.12 : 0.06) + rnd() * 0.06, lean: (j - 2) * 0.02 + (rnd() - 0.5) * 0.02 });
        grass.push({ x, z, blades, flower: rnd() < 0.3 ? 1 + ((rnd() * 3) | 0) : 0 });
      }
      poles = [];
      for (let z = WIRE[0]; z <= WIRE[1] + 0.01; z += POLE) poles.push(z);
      birds = [];
      for (let i = 0; i + 1 < poles.length; i++) for (const s of [-0.2, 0.2]) { const n = (rnd() * 3) | 0; for (let j = 0; j < n; j++) birds.push({ i, s, f: 0.2 + rnd() * 0.6, dir: rnd() < 0.5 ? -1 : 1, ph: rnd() * 6 }); }
      clouds = [];
      // low clouds over the land, and high ones the camera rises past at the end
      const cloudAt = (z, X, Y, wd) => {
        const pts = [], bx = [[-0.36, 0.13], [-0.18, 0.22], [0.04, 0.3], [0.25, 0.22], [0.4, 0.12]];
        for (let j = 0; j <= 40; j++) { const x = -0.5 + j / 40; let top = 0; for (const [b2, r] of bx) { const d = x - b2; if (Math.abs(d) < r) top = Math.max(top, Math.sqrt(r * r - d * d)); } pts.push([X + x * wd, Y - top * wd * 1.05, z]); }
        for (let j = 1; j <= 10; j++) pts.push([X + (0.5 - j / 10) * wd, Y + Math.sin((j / 10) * Math.PI) * 0.03, z]);
        clouds.push({ z, pts, ci: clouds.length });
      };
      for (let z = 3; z < CL0; z += 3 + rnd() * 3) cloudAt(z, (rnd() - 0.5) * 7, -2.1 + rnd() * 0.6, 0.9 + rnd() * 0.9);
      puffs = [];
      for (let i = 0; i < 34; i++) {
        const y = -2.4 - i * 0.85 - rnd() * 0.5, c = Math.pow(-y / CLH, 1 / CLX); if (y < -29) break;
        const z = CL0 + c * (ZS - CL0), an = rnd() * Math.PI * 2, rad = 1.1 + rnd() * 2.6, X = xAt(z) + Math.cos(an) * rad, Z = z + Math.sin(an) * rad * 0.8, blobs = [];
        for (let j = 0, n = 4 + ((rnd() * 4) | 0); j < n; j++) blobs.push([X + (rnd() - 0.5) * 1.4, y + (rnd() - 0.5) * 0.4, Z + (rnd() - 0.5) * 0.9, 0.3 + rnd() * 0.45]);
        puffs.push(blobs);
      }
      // the sea, by depth along the fishing line (k: 0 the top, 1 the bottom): light from above and bubbles near the
      // top, fish circling the line and rays gliding round it further down, jellyfish and glowing plankton in the dark
      const around = (k, r0, r1) => { const y = k * DD, z = zOfDepth(y), a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0); return [xAt(z) + Math.cos(a) * r, y, z + Math.sin(a) * r]; };
      shafts = []; for (let i = 0; i < 26; i++) { const [x, , z] = around(0, 0.7, 6.5); shafts.push({ x, z, w: 0.07 + rnd() * 0.2, ph: rnd() * 6 }); }
      bubbles = []; for (let i = 0; i < Math.round(340 * dens); i++) { const k = 0.02 + Math.pow(rnd(), 1.3) * 0.43; bubbles.push({ p: around(k, 0.25, 4), r: 0.025 + rnd() * 0.06, off: rnd(), v: 0.4 + rnd() * 0.6 }); }
      fish = []; for (let s2 = 0; s2 < 8; s2++) { const c = around(0.1 + s2 * 0.05 + rnd() * 0.03, 0, 0.4), R = 0.9 + rnd() * 1.4, dir = rnd() < 0.5 ? -1 : 1, col = (rnd() * 3) | 0, n = 18 + ((rnd() * 12) | 0), ph0 = rnd() * 6.3; for (let j = 0; j < n; j++) fish.push({ c, R: R + (rnd() - 0.5) * 0.5, y: c[1] + (rnd() - 0.5) * 1.2, ph: ph0 + rnd() * 2.4, dir, col, sz: 0.1 + rnd() * 0.06, w: 0.4 + rnd() * 0.06 }); }
      mantas = [0.27, 0.4].map((k) => { const c = around(k, 0, 0.4); return { c, R: 2 + rnd() * 1, ph: rnd() * 6.3, dir: rnd() < 0.5 ? -1 : 1, s: 1.2 + rnd() * 0.4 }; });
      jellies = []; for (let i = 0; i < Math.round(30 * dens) + 8; i++) jellies.push({ p: around(0.42 + rnd() * 0.48, 0.9, 4), r: 0.07 + rnd() * 0.1, c: (rnd() * 3) | 0, ph: rnd() * 6 });
      snow = []; for (let i = 0; i < Math.round(420 * dens); i++) snow.push({ p: around(0.1 + rnd() * 0.9, 0.2, 5), ph: rnd() });
      // a kelp forest in the shallows: long stalks standing up out of the deep around the line, swaying, with blades
      kelps = []; for (let i = 0; i < Math.round(12 * (0.6 + 0.4 * dens)); i++) { const [x, , z] = around(0, 1.6, 6.5); kelps.push({ x, z, y1: 26 + rnd() * 34, ph: rnd() * 6.3, c: (rnd() * 2) | 0, gap: 2 + rnd() * 0.8 }); }
      // a whale far below, crossing slowly under the line
      whale = { c: around(0.34, 2.2, 2.6), L: 10, h: rnd() * 6.3 };
      glows = []; for (let i = 0; i < Math.round(260 * dens); i++) glows.push({ p: around(0.5 + rnd() * 0.5, 0.3, 5), c: (rnd() * 3) | 0, s: rnd() });
      nebulae = [[G2 + 8, -2.2, -1.2, 2.6, [246, 196, 222]], [G2 + 13, 2.4, -0.4, 3.0, [200, 190, 246]], [G2 + 19.5, -1.0, 0.9, 3.4, [180, 226, 236]], [G2 + 25, 2.0, -1.6, 2.8, [252, 224, 200]]].map(([z, x, y, r, c]) => ({ z, x, y: y + YS, r, c }));
      milky = [];
      for (let i = 0; i < Math.round(520 * dens); i++) { const t = rnd(), sp = (rnd() + rnd() + rnd() - 1.5) * 0.9; milky.push({ x: -9 + t * 18, y: YS - 3.2 + t * 2.6 + sp, z: PEN.music[1] - 0.5 + rnd() * 6, s: rnd() }); }
      bodies = [{ kind: 'ring', z: G2 + 10, x: 2.3, y: YS + -1.5, r: 0.55, c: [214, 200, 246], c2: [246, 206, 226] }, { kind: 'moon', z: G2 + 15.5, x: -2.6, y: YS + -1.9, r: 0.42, c: [252, 238, 196] }, { kind: 'ring', z: G2 + 21.5, x: -2.0, y: YS + 0.9, r: 0.32, c: [186, 226, 236], c2: [252, 232, 170] }];
      stars = [];
      for (let i = 0; i < Math.round(300 * dens); i++) stars.push({ x: (rnd() - 0.5) * 12, y: YS - 3.4 + rnd() * 5.2, z: G2 - 1 + rnd() * 33, s: rnd(), sparkle: rnd() < 0.14, c: (rnd() * 3) | 0 });
    }

    // messages written along the line: [selector, z on the line, side (1 right, -1 left, 0 hanging, 0.5 a note on the line)]
    const ANCHORS = [
      ['#jy-hello', SET.land[0], 1], ['#jy-pcard', SET.land[1], -1], ['#jy-types', SET.land[2], 1], ['#jy-clients', SET.land[3], -1],
      ['#jy-creed', SET.sea[0], 1], ['#jy-step-0', SET.sea[1], 0], ['#jy-step-1', SET.sea[2], 0], ['#jy-step-2', SET.sea[3], 0],
      ['#jy-case-req', SET.space[0], 1], ['#jy-case-m0', SET.space[1], 0.5], ['#jy-case-m1', SET.space[2], -0.5], ['#jy-case-ans', SET.space[3], -1],
    ].map(([sel, z, side]) => ({ el: $(sel), z, side, w: 0, h: 0 })).filter((a) => a.el);
    ANCHORS.forEach((a) => a.el.setAttribute('data-anchor', ''));
    const swellZ = ANCHORS.filter((a) => a.side === 0 || Math.abs(a.side) === 0.5).map((a) => a.z);
    ANCHORS.sort((a, b) => a.z - b.z);
    // the messages of one chapter make one thread: each stays once written, the newest at the bottom of the
    // reading spot and the older ones above it, quieter; a new chapter starts a new thread. What shows depends
    // only on where the pen is, and the arrival itself is a short timed animation, so a quick scroll loses nothing.
    const groupOf = (z) => (z < PEN.tone[0] ? 0 : z < PEN.case[0] ? 1 : z < PEN.music[0] ? 2 : 3);
    let leadOf = null;
    // The words of the about, the philosophy and the case are said in a chat room: a light frame, as tall as its
    // thread, named for the chapter, the messages arriving at its bottom and the older ones going up and out of it.
    // It keeps out of the scene's way: no fill, only its outline and the name.
    const roomEl = $('#jy-room'), roomT = $('#jy-room-t'), roomS = $('#jy-room-s'), ROOMS = ['tale', 'tone', 'case'];
    let roomOf = -1;
    function roomBox() {
      // a tablet held upright: the room in the middle, at a reading width
      if (NARROW && W >= 700) { const w = Math.min(640, W - 64); return { x: (W - w) / 2, w, top: H * 0.36, bottom: H - 24 - (asking ? 86 : 0), head: 64, foot: 6 }; }
      if (NARROW) return { x: 8, w: W - 16, top: H * 0.3, bottom: H - 8 - (asking ? 78 : 0), head: 58, foot: 4 };
      const w = Math.min(460, W * 0.36); return { x: Math.min(W * 0.57, W - w - 28), w, top: H * 0.11, bottom: H * 0.86, head: 66, foot: 6 };
    }
    function placeAnchors() {
      const RB = roomBox(), slotX = RB.x + 18, bottom = RB.bottom - RB.foot - 12, ceil = RB.top + RB.head + 10;
      let topY = bottom;

      let latest = -1;
      ANCHORS.forEach((a, i) => { if (penZ >= a.z) latest = i; });
      const g = latest >= 0 ? groupOf(ANCHORS[latest].z) : -1, gone = latest >= 0 && (penZ > ANCHORS[latest].z + 6 || (g === 0 && penZ > CL0 + 0.75));
      let y = bottom;
      leadOf = null;
      for (let i = ANCHORS.length - 1; i >= 0; i--) {
        const a = ANCHORS[i], shown = !gone && i <= latest && groupOf(a.z) === g;
        if (!a.w) { a.w = a.el.offsetWidth; a.h = a.el.offsetHeight; }
        a.el.classList.toggle('on', shown);
        a.el.classList.toggle('older', shown && i !== latest);
        // a hidden message waits just under the spot it will take, so it rises a short way when it arrives
        if (!shown) { a.el.style.setProperty('--aa', '0'); a.el.style.setProperty('--ax', slotX.toFixed(1) + 'px'); a.el.style.setProperty('--ay', (bottom - a.h + 18).toFixed(1) + 'px'); a.el.style.setProperty('--as', '1'); continue; }
        // (the older ones go up and out of the room once the thread would climb past its top)
        if (i !== latest && y - a.h < ceil) { a.el.classList.remove('on'); a.el.style.setProperty('--aa', '0'); continue; }
        y -= a.h; topY = y;
        a.el.style.setProperty('--aa', i === latest ? '1' : spaceDark > 0.5 ? '0.88' : '0.62');
        a.el.style.setProperty('--ax', slotX.toFixed(1) + 'px'); a.el.style.setProperty('--ay', y.toFixed(1) + 'px'); a.el.style.setProperty('--as', '1');
        if (i === latest) leadOf = { a, A: 1, x: slotX, y: y + Math.min(a.h / 2, 40) };
        y -= 10;
      }
      // the room around the thread
      const show = latest >= 0 && !gone && g >= 0 && g < 3;
      roomEl.classList.toggle('on', show);
      if (!show) return;
      if (g !== roomOf) { roomOf = g; const r = (COPY.rooms || {})[ROOMS[g]] || {}; roomT.textContent = r.title || ''; roomS.textContent = g === 2 && CASE && bySlug[CASE] ? bySlug[CASE].title : r.sub || ''; }
      const top = Math.max(RB.top, topY - 12 - RB.head);
      roomEl.style.transform = `translate(${RB.x}px,${top}px)`; roomEl.style.width = `${RB.w}px`; roomEl.style.height = `${RB.bottom - top}px`;
    }
    function drawLead(A) {
      if (!leadOf) return;
      const p = V(pathAt(leadOf.a.z)); if (!p) return;
      const al = A * leadOf.A;
      ctx.save(); ctx.strokeStyle = `rgba(${lineRGB},${0.55 * al})`; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(leadOf.x - 8, leadOf.y); ctx.stroke(); ctx.restore();
      ctx.fillStyle = `rgba(${lineRGB},${al})`; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(leadOf.x - 8, leadOf.y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    function polyline(pts, n) { ctx.beginPath(); let started = false; for (let i = 0; i < n; i++) { const q = pts[i]; if (!q) { started = false; continue; } if (started) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); started = true; } } }
    function drawTip(rgb, A, P = pathAt, hook = false) {
      const tip = V(P(penZ)); if (!tip || penZ <= PEN.tale[0] + 0.05) return;
      ctx.fillStyle = `rgba(${rgb},${A})`;
      if (!hook) { ctx.beginPath(); ctx.arc(tip[0], tip[1], clamp(4 * AHEAD / tip[2], 2, 6), 0, Math.PI * 2); ctx.fill(); return; }
      // a fishing hook on the end, turned the way the line runs on the screen
      const pr = V(P(penZ - 0.08)); if (!pr) return;
      const r = clamp(6 * AHEAD / tip[2], 4, 11);
      ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(Math.atan2(tip[1] - pr[1], tip[0] - pr[0]));
      ctx.strokeStyle = `rgba(${rgb},${A})`; ctx.lineWidth = Math.max(1.4, r * 0.2); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.5, 0); ctx.arc(r * 1.5, r * 0.55, r * 0.55, -Math.PI / 2, Math.PI * 0.92); ctx.lineTo(r * 1.2, r * 0.36); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, Math.max(1.6, r * 0.22), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // fish in pastel colours
    const SETC = ['252,226,160', '246,190,222', '204,192,250', '172,230,240'], FISHC = ['248,168,156', '252,210,128', '140,190,238'], KELPC = ['104,170,138', '148,186,116'];
    const TREE = [136, 190, 146], FLOWER = [[248, 186, 204], [252, 226, 150], [255, 255, 255]];
    const JELLY = ['246,190,222', '204,192,250', '172,230,240'], GLOW = ['150,236,240', '246,180,226', '240,236,170'];
    // the sky at the zenith and the water at the top of the dive share one colour: that is the change of world
    const ZEN = [196, 228, 242], HAZE = [252, 240, 230];
    const mixA = (c0, c1, k) => c0.map((v, i) => lerp(v, c1[i], k));
    const rgbA = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
    // a gradient down the screen, coloured row by row by how far up or down that row looks
    // (drawn as a one-pixel-wide strip, row by row, stretched over the screen: much lighter than a many-stop gradient)
    const strip = document.createElement('canvas'), sctx = strip.getContext('2d'), SN = 96; strip.width = 1; strip.height = SN;
    const sdata = sctx.createImageData(1, SN);
    function skyFill(colAt, a) {
      for (let i = 0; i < SN; i++) { const [c, al] = colAt(elevAt(((i + 0.5) / SN) * H)), o = i * 4; sdata.data[o] = c[0]; sdata.data[o + 1] = c[1]; sdata.data[o + 2] = c[2]; sdata.data[o + 3] = 255 * clamp(al * a); }
      sctx.putImageData(sdata, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(strip, 0, 0, 1, SN, 0, 0, W, H);
    }
    const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    // the water by depth: the sky's own colour at the top, then blue, navy, and the colour of the night it opens onto
    const WATER = [[0, ZEN], [0.12, [178, 216, 236]], [0.3, [122, 178, 216]], [0.5, [66, 112, 170]], [0.72, [34, 56, 110]], [1, [22, 24, 50]]];
    const waterAt = (k) => { for (let i = 1; i < WATER.length; i++) if (k <= WATER[i][0]) return mixA(WATER[i - 1][1], WATER[i][1], (k - WATER[i - 1][0]) / (WATER[i][0] - WATER[i - 1][0])); return WATER[WATER.length - 1][1]; };
    // the far end of the view, straight up or straight down: deeper there, like the sky at its zenith and the sea
    // below. (Straight up into the sky and straight down into the water look the same, which is the trick.)
    function well(c, a, down) {
      if (a <= 0) return; const d = down ? -sP : sP; if (d < 0.05) return;
      const x = W / 2, y = H * HZ + ((down ? cP : -cP) * F3) / d, R = Math.hypot(W, H) * 0.62, g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, rgbA(c, a)); g.addColorStop(1, rgbA(c, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    function seaBackdrop(a) {
      const dk = depthK(), c = waterAt(dk);
      ctx.fillStyle = rgbA(c, a); ctx.fillRect(0, 0, W, H);
      well(waterAt(Math.min(1, dk + 0.12)), 0.85 * a * clamp((-camP - 0.6) / 0.6), true);
    }
    function nightBackdrop(a) { const g = ctx.createLinearGradient(0, 0, W * 0.3, H); g.addColorStop(0, `rgba(18,22,44,${a})`); g.addColorStop(1, `rgba(40,34,74,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // what the pen's line looks like from z0 to z1: thick close by, a hair far away, swelling where something is written
    function drawLine(z0, z1, rgb, A, P = pathAt) {
      let run = [], wPrev = -1, aPrev = -1;
      const flush = () => { if (run.length > 1) { ctx.lineWidth = wPrev; ctx.lineCap = aPrev < 1 ? 'butt' : 'round'; ctx.strokeStyle = `rgba(${rgb},${aPrev})`; ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); for (let n2 = 1; n2 < run.length; n2++) ctx.lineTo(run[n2][0], run[n2][1]); ctx.stroke(); } };
      const wOf = P === seaPath ? () => 1 : P === spacePath ? () => 2 : worldOf;
      for (let z = Math.max(PEN.tale[0], camZ - 3, z0); z <= z1 + 1e-6; z += 0.03 / Math.max(1, Math.abs(baseOf(z + 0.01, wOf(z)) - baseOf(z, wOf(z))) * 50)) {
        const p = V(P(Math.min(z, z1))); if (!p) continue;
        let sw = 1; for (const az of swellZ) sw += 0.8 * Math.exp(-Math.pow((z - az) / 0.35, 2));
        const wd = Math.round(clamp(2.3 * AHEAD / p[2], 0.5, 5) * sw * 4) / 4, al = Math.round(A * fogA(p[2]) * 20) / 20;
        if (wd !== wPrev || al !== aPrev) { const lastP = run[run.length - 1]; flush(); run = lastP ? [lastP] : []; wPrev = wd; aPrev = al; }
        run.push(p);
      }
      flush(); ctx.lineCap = 'round';
    }
    const near = (z, far = FAR3) => { const dz = z - camZ; return dz > 0.3 && dz < far; };
    // the three worlds, each drawn whole from the same camera: 0 land, 1 sea, 2 space
    const spaceFade = () => 1 - ease(clamp((penZ - (PEN.music[1] - 0.8)) / 0.7));
    function backdrop(w, A) {
      if (w === 0) {
        const k = passed(2, 0) * A;
        skyFill((e) => (e < 0.3 ? [mixA(HAZE, PASTEL.land.sky, clamp(e / 0.3)), e < 0 ? 0.5 * clamp(1 + e / 0.25) : lerp(0.5, 0.85, e / 0.3)] : [mixA(PASTEL.land.sky, ZEN, ease((e - 0.3) / 0.9)), lerp(0.85, 1, ease((e - 0.3) / 0.9))]), k);
        // deeper blue at the zenith, exactly as the water at the top of the dive is deeper straight below
        well(waterAt(0.12), 0.85 * k * clamp((camP - 0.6) / 0.6), false);
        // the sun, far away in one direction, so it only moves when the camera turns
        const sd = 1 * cP + 0.31 * sP; if (sd < 0.05) return;
        const sx = W / 2 + (0.39 * F3) / sd, sy = H * HZ + ((-0.31 * cP + sP) * F3) / sd, R = Math.min(W, H) * 0.045, gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 6);
        gl.addColorStop(0, `rgba(255,246,222,${0.7 * k})`); gl.addColorStop(1, 'rgba(255,246,222,0)'); ctx.fillStyle = gl; ctx.fillRect(sx - R * 6, sy - R * 6, R * 12, R * 12);
        ctx.fillStyle = `rgba(255,244,214,${0.95 * k})`; ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.fill();
        return;
      }
      if (w === 1) { seaBackdrop(A); return; }
      // night: deep indigo, nebulae of pastel light, the milky way far behind
      const d = A * spaceFade(); if (d <= 0) return; nightBackdrop(d);
        for (const nb of nebulae) {
          const q = V([nb.x, nb.y, nb.z]); if (!q || q[2] > FAR3 + 8) continue;
          const R = nb.r * F3 / q[2], k = 0.25 + 0.75 * passed(nb.z - 6), gr = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R);
          gr.addColorStop(0, `rgba(${nb.c},${0.32 * k * d})`); gr.addColorStop(0.5, `rgba(${nb.c},${0.12 * k * d})`); gr.addColorStop(1, `rgba(${nb.c},0)`);
          ctx.fillStyle = gr; ctx.fillRect(q[0] - R, q[1] - R, 2 * R, 2 * R);
        }
        for (const m of milky) { const q = V([m.x, m.y, m.z]); if (!q) continue; ctx.fillStyle = `rgba(230,232,250,${(0.25 + 0.5 * m.s) * d * (reduce ? 0.8 : 0.75 + 0.25 * Math.sin(T * 2 + m.s * 40))})`; ctx.fillRect(q[0], q[1], 1.2, 1.2); }
        for (const b of bodies) {
          const q = V([b.x, b.y, b.z]); if (!q || q[2] < 0.6 || q[2] > FAR3) continue;
          const R = b.r * F3 / q[2], k = passed(b.z - 4), a = d * fogA(q[2]) * clamp((penZ - (b.z - 12)) / 2) * clamp(1 - (R - H * 0.1) / (H * 0.1));
          ctx.fillStyle = tint(b.c, k, 0.95 * a); ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, Math.PI * 2); ctx.fill();
          if (b.kind === 'moon') { ctx.fillStyle = `rgba(22,25,50,${a})`; ctx.beginPath(); ctx.arc(q[0] + R * 0.42, q[1] - R * 0.18, R * 0.92, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(-0.38); ctx.strokeStyle = tint(b.c2, k, 0.9 * a); ctx.lineWidth = Math.max(1.5, R * 0.12); ctx.beginPath(); ctx.ellipse(0, 0, R * 1.9, R * 0.5, 0, Math.PI * 1.02, Math.PI * 1.98, true); ctx.stroke(); ctx.restore(); }
        }
        // now and then a shooting star
        if (!reduce) { const cyc = (T % 5.5) / 5.5, sx = W * (0.15 + ((Math.floor(T / 5.5) * 0.37) % 0.7)), sy = H * 0.12; if (cyc < 0.16) { const t2 = cyc / 0.16, x2 = sx + t2 * W * 0.22, y2 = sy + t2 * H * 0.12; const gl = ctx.createLinearGradient(x2 - W * 0.08, y2 - H * 0.045, x2, y2); gl.addColorStop(0, 'rgba(254,254,254,0)'); gl.addColorStop(1, `rgba(254,254,254,${0.85 * d * (1 - t2)})`); ctx.strokeStyle = gl; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x2 - W * 0.08, y2 - H * 0.045); ctx.lineTo(x2, y2); ctx.stroke(); } }
    }
    // the world's things between zLo and zHi (so what stands behind a gate can be drawn before it, the rest after)
    function elements(w, A, zLo = -1e9, zHi = 1e9) {
      const inR = (z) => z >= zLo && z < zHi;
      if (w === 0) {
        const t = reduce ? 0 : T, kL = passed(2, 0);
        // far ranges: big and pale, bluer and hazier the farther, snow on the highest peaks
        for (const mt of mounts) {
          if (!near(mt.z, 40)) continue;
          const dz = mt.z - camZ, Q = mt.pts.map(V), first = Q[0], last = Q[Q.length - 1]; if (!first || !last) continue;
          const a = A * clamp((40 - dz) / 10) * clamp((penZ - 1) / 2), top = V([0, GROUND - mt.hMax, mt.z]), bot = V([0, GROUND, mt.z]);
          const g = ctx.createLinearGradient(0, top ? top[1] : 0, 0, bot ? bot[1] : H); g.addColorStop(0, tint(mt.c, kL, 0.75 * a)); g.addColorStop(1, tint(mt.c, kL, 0.12 * a));
          polyline(Q, Q.length); ctx.lineTo(last[0], H * 2); ctx.lineTo(first[0], H * 2); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${0.85 * a * (0.3 + 0.7 * kL)})`;
          for (const pk of mt.peaks) { const p0 = V(pk[0]), p1 = V(pk[1]), p2 = V(pk[2]); if (!p0 || !p1 || !p2) continue; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.fill(); }
        }
        for (const cl of clouds) {
          if (!near(cl.z) || penZ < cl.z - 10) continue;
          const dz = cl.z - camZ, reveal = clamp((penZ - (cl.z - 10)) / 2), k = passed(cl.z - 3), Q = cl.pts.map((p) => V([p[0] + (reduce ? 0 : Math.sin(T * 0.08 + cl.ci) * 0.15), p[1], p[2]]));
          if (k > 0 && reveal >= 1) { polyline(Q, Q.length); ctx.closePath(); ctx.fillStyle = tint(PASTEL.land.cloud, 1, 0.8 * k * fogA(dz) * A); ctx.fill(); }
          ctx.strokeStyle = tint(PASTEL.land.cloud, k * 0.4, 0.5 * fogA(dz) * A); ctx.lineWidth = clamp(1.2 * AHEAD / dz, 0.5, 1.8); polyline(Q, Math.max(2, Math.round(reveal * Q.length))); ctx.stroke();
        }
        // the hills, hazier with distance, with round trees on their ridges
        for (const r of ridges) {
          if (!near(r.z)) continue;
          const dz = r.z - camZ, reveal = clamp((penZ - (r.z - 7)) / 2.5); if (reveal <= 0) continue;
          const Q = r.pts.map(V), k = passed(r.z - 4), haze = clamp(dz / 14) * 0.6, c = PASTEL.land.hill[r.k % 3].map((v, i) => lerp(v, PASTEL.land.sky[i], haze)), a = fogA(dz) * A;
          if (k > 0 && reveal >= 1 && Q[0] && Q[Q.length - 1]) { const first = Q[0], lastQ = Q[Q.length - 1]; polyline(Q, Q.length); ctx.lineTo(lastQ[0], H * 2); ctx.lineTo(first[0], H * 2); ctx.closePath(); ctx.fillStyle = tint(c, 1, 0.62 * k * a); ctx.fill(); }
          ctx.strokeStyle = tint([110, 140, 120], k, 0.5 * a); ctx.lineWidth = clamp(1.4 * AHEAD / dz, 0.5, 2); polyline(Q, Math.max(2, Math.round(reveal * Q.length))); ctx.stroke();
          if (reveal < 1) continue;
          const leaf = TREE.map((v, i) => lerp(v, PASTEL.land.sky[i], haze * 0.8)), wood = [170, 140, 120];
          for (const tr of r.trees) {
            const [x, y] = r.pts[tr.i], b0 = V([x, y + 0.02, r.z]), b1 = V([x, y - 0.12 * tr.s, r.z]), cc = V([x, y - 0.2 * tr.s, r.z]); if (!b0 || !b1 || !cc) continue;
            const R = 0.1 * tr.s * F3 / dz;
            ctx.strokeStyle = tint(wood, k, 0.8 * a); ctx.lineWidth = Math.max(1, R * 0.28); ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
            ctx.fillStyle = tint(leaf, k, 0.9 * a); ctx.beginPath(); ctx.arc(cc[0], cc[1], R, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255,255,255,${0.22 * a * k})`; ctx.beginPath(); ctx.arc(cc[0] - R * 0.3, cc[1] - R * 0.3, R * 0.45, 0, Math.PI * 2); ctx.fill();
          }
        }
        // the other wires, crossarm to crossarm, sagging between the poles, drawn as far as the pen has gone
        const wireAt = (i, s, f) => { const t0 = pathAt(poles[i]), t1 = pathAt(poles[i + 1]); return [lerp(t0[0], t1[0], f) + s, lerp(t0[1], t1[1], f) + 0.07 + 0.16 * 4 * f * (1 - f), lerp(poles[i], poles[i + 1], f)]; };
        for (let i = 0; i + 1 < poles.length; i++) {
          if (penZ < poles[i]) continue;
          const fMax = clamp((penZ - poles[i]) / (poles[i + 1] - poles[i])), k = passed(poles[i]);
          for (const s of [-0.2, 0.2]) {
            const Q = []; for (let n = 0; n <= 20; n++) { const p = wireAt(i, s, (n / 20) * fMax); Q.push(p[2] - camZ > 0.2 ? V(p) : null); }
            const mid = wireAt(i, s, 0.5), dz = Math.max(0.3, mid[2] - camZ);
            ctx.strokeStyle = tint([120, 126, 146], k, 0.55 * fogA(dz) * A); ctx.lineWidth = clamp(1 * AHEAD / dz, 0.5, 1.6); polyline(Q, Q.length); ctx.stroke();
          }
        }
        for (const z of poles) {
          if (penZ < z || !near(z)) continue; const dz = z - camZ;
          const top = pathAt(z), a = V(top), b = V([top[0], GROUND + 0.05, z]), ca = V([top[0] - 0.26, top[1] + 0.1, z]), cb = V([top[0] + 0.26, top[1] + 0.1, z]);
          if (!a || !b) continue;
          const k = passed(z), al = 0.85 * fogA(dz) * A;
          ctx.strokeStyle = tint(PASTEL.land.pole, k, al); ctx.lineWidth = clamp(2.8 * AHEAD / dz, 0.8, 5.5); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          if (ca && cb) { ctx.lineWidth = clamp(1.8 * AHEAD / dz, 0.6, 3.5); ctx.beginPath(); ctx.moveTo(ca[0], ca[1]); ctx.lineTo(cb[0], cb[1]); ctx.stroke(); }
          ctx.fillStyle = tint([206, 220, 232], k, al);
          for (const s of [-0.2, 0.2]) { const ins = V([top[0] + s, top[1] + 0.06, z]); if (ins) { ctx.beginPath(); ctx.arc(ins[0], ins[1], clamp(0.03 * F3 / dz, 1, 4.5), 0, Math.PI * 2); ctx.fill(); } }
        }
        // birds on the wires, which take off as the camera comes near
        for (const bd of birds) {
          const p = wireAt(bd.i, bd.s, bd.f); if (penZ < p[2]) continue;
          const fly = reduce ? 0 : clamp((camZ - (p[2] - 2.4)) / 1.4), q = V([p[0] + fly * 1.5 * bd.dir, p[1] - fly * 1.8, p[2] + fly * 0.7]); if (!q || q[2] > FAR3) continue;
          const L = 0.04 * F3 / q[2], a = fogA(q[2]) * A * (1 - clamp((fly - 0.75) / 0.25)); if (a <= 0.02) continue;
          ctx.fillStyle = ctx.strokeStyle = tint([92, 100, 124], passed(p[2]), 0.9 * a);
          if (fly <= 0) { ctx.beginPath(); ctx.ellipse(q[0], q[1] - L * 0.55, L * 0.75, L * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(q[0] + bd.dir * L * 0.6, q[1] - L * 1.05, L * 0.32, 0, Math.PI * 2); ctx.fill(); }
          else { const fl = Math.sin(t * 14 + bd.ph) * 0.6; ctx.lineWidth = Math.max(1, L * 0.22); ctx.beginPath(); ctx.moveTo(q[0] - L * 1.3, q[1] - L * fl); ctx.quadraticCurveTo(q[0] - L * 0.4, q[1] - L * 0.5, q[0], q[1]); ctx.quadraticCurveTo(q[0] + L * 0.4, q[1] - L * 0.5, q[0] + L * 1.3, q[1] - L * fl); ctx.stroke(); }
        }
        // grass in tufts, some with a flower
        for (const g of grass) {
          if (!near(g.z, 10) || penZ < g.z) continue;
          const dz = g.z - camZ, k = passed(g.z), sw = reduce ? 0 : Math.sin(t * 1.8 + g.z * 3) * 0.012, al = 0.7 * A * clamp((dz - 0.3) / 0.6);
          ctx.strokeStyle = tint(PASTEL.land.grass, k, al); ctx.lineWidth = clamp(1.3 * AHEAD / dz, 0.6, 2.4); ctx.beginPath();
          for (const b of g.blades) { const base = V([g.x + b.dx, GROUND, g.z]), mid = V([g.x + b.dx + b.lean * 0.3, GROUND - b.h * 0.55, g.z]), tip = V([g.x + b.dx + b.lean + sw, GROUND - b.h, g.z]); if (!base || !mid || !tip) continue; ctx.moveTo(base[0], base[1]); ctx.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); }
          ctx.stroke();
          if (g.flower) { const b = g.blades[2], f = V([g.x + b.dx + b.lean + sw, GROUND - b.h - 0.012, g.z]); if (f) { ctx.fillStyle = tint(FLOWER[g.flower - 1], k, al / 0.7); ctx.beginPath(); ctx.arc(f[0], f[1], clamp(0.024 * F3 / dz, 1.2, 5), 0, Math.PI * 2); ctx.fill(); } }
        }
        // the clouds high up, which the camera rises through: far ones first
        if (penZ > CL0) {
          const seen = [];
          for (const pf of puffs) { const q = pf.map((b) => [V(b), b[3]]); const d = Math.max(...q.map(([v]) => (v ? v[2] : 0))); if (d > 0.3 && d < 30) seen.push([d, q]); }
          seen.sort((a, b) => b[0] - a[0]);
          for (const [d, q] of seen) {
            const al = A * clamp((d - 0.4) / 1.6) * clamp((30 - d) / 10) * clamp((camP - 0.25) / 0.5); if (al < 0.02) continue;
            const blob = (sc, dx) => { ctx.beginPath(); for (const [v, r] of q) { if (!v) continue; const R = (r * F3 * sc) / v[2]; if (R > W * 2) continue; ctx.moveTo(v[0] + dx * R + R, v[1] + dx * R); ctx.arc(v[0] + dx * R, v[1] + dx * R, R, 0, Math.PI * 2); } };
            blob(1, 0); ctx.fillStyle = rgbA(mixA(PASTEL.land.cloud, [255, 255, 255], 0.35), 0.62 * al); ctx.fill();
            blob(0.72, -0.18); ctx.fillStyle = `rgba(255,255,255,${0.55 * al})`; ctx.fill();
          }
        }
        return;
      }
      if (w === 1) { seaElements(A); return; }
      spaceElements(A, inR);
    }
    // the sea seen straight down the fishing line: what is near passes outwards, what is deep waits in the middle
    function seaElements(A) {
      const t = reduce ? 0 : T, dk = depthK(), inSea = ease((penZ - ZS) / 0.6) * A, ahead = (y) => y > camY - 1 && y < camY + FAR3;
      if (inSea <= 0) return;
      // light from above, running down past the camera and meeting far below
      const lit = inSea * clamp(1 - dk / 0.32);
      if (lit > 0) for (const sh of shafts) {
        const y0 = Math.max(0, camY + 0.4), y1 = y0 + 22, dx = sh.x - camX, dz = sh.z - camZ, r = Math.hypot(dx, dz) || 1, ox = (-dz / r) * sh.w, oz = (dx / r) * sh.w;
        const q = [V([sh.x - ox, y0, sh.z - oz]), V([sh.x + ox, y0, sh.z + oz]), V([sh.x + ox, y1, sh.z + oz]), V([sh.x - ox, y1, sh.z - oz])]; if (q.some((v) => !v)) continue;
        const gr = ctx.createLinearGradient((q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2, (q[2][0] + q[3][0]) / 2, (q[2][1] + q[3][1]) / 2);
        gr.addColorStop(0, `rgba(255,255,255,${(0.32 + 0.1 * Math.sin(t * 0.7 + sh.ph)) * lit})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let n = 1; n < 4; n++) ctx.lineTo(q[n][0], q[n][1]); ctx.closePath(); ctx.fill();
      }
      // in the shallows, the sunlight through the waves makes a net of light that wavers, layer under layer (the
      // two nearest layers a little way ahead, two families of wavy lines crossing; each layer one path, one stroke)
      const net = inSea * clamp(1 - dk / 0.16);
      if (net > 0) {
        ctx.lineWidth = 1; let drawn = 0;
        for (let li = 1; li <= 7 && drawn < 2; li++) {
          const y = li * 6, d = y - camY; if (d < 6 || d > 20) continue;
          const al = net * 0.4 * clamp((d - 6) / 3) * clamp((20 - d) / 6); if (al < 0.01) continue;
          drawn++;
          const zc = zOfDepth(y), cx = xAt(zc);
          ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.beginPath();
          for (let f = 0; f < 2; f++) {
            const an = f * 1.15 + li * 0.4, dx = Math.cos(an), dz = Math.sin(an);
            for (let i = -5; i <= 5; i++) {
              let pen = false;
              for (let a = -6.4; a <= 6.41; a += 0.8) {
                const o = i * 1.1 + 0.3 * Math.sin(a * 1.3 + t * 0.9 + i * 1.7 + f * 2.1), px = a * dx - o * dz, pz = a * dz + o * dx;
                const q = px * px + pz * pz < 40 ? V([cx + px, y, zc + pz]) : null;
                if (!q) { pen = false; continue; } if (pen) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); pen = true; }
              }
            }
          }
          ctx.stroke();
        }
      }
      // a kelp forest: long stalks out of the deep, swaying, blades along them, all leading down to the middle
      // (each stalk one ribbon, its blades one path)
      for (const k of kelps) {
        const y0 = Math.max(-1, camY + 0.45), y1 = Math.min(k.y1, camY + FAR3); if (y0 >= y1) continue;
        const col = KELPC[k.c], at = (y) => [k.x + Math.sin(y * 0.18 + t * 0.8 + k.ph) * 0.3, y, k.z + Math.cos(y * 0.15 + t * 0.7 + k.ph) * 0.2];
        const P = []; for (let y = y0; y <= y1; y += 0.8) { const q = V(at(y)); if (q) P.push(q); }
        if (P.length < 2) continue;
        const Lft = [], Rgt = [];
        for (let i = 0; i < P.length; i++) {
          const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], nx = -(b[1] - a[1]), ny = b[0] - a[0], n = Math.hypot(nx, ny) || 1, w = clamp((0.07 * F3) / P[i][2], 0.7, 14) / 2;
          Lft.push([P[i][0] + (nx / n) * w, P[i][1] + (ny / n) * w]); Rgt.push([P[i][0] - (nx / n) * w, P[i][1] - (ny / n) * w]);
        }
        const fa = fogA(P[P.length - 1][2]) * 0.35 + 0.65 * fogA(P[0][2]);
        ctx.fillStyle = `rgba(${col},${0.85 * inSea * fa})`; ctx.beginPath(); ctx.moveTo(Lft[0][0], Lft[0][1]);
        for (const q of Lft) ctx.lineTo(q[0], q[1]); for (let i = Rgt.length - 1; i >= 0; i--) ctx.lineTo(Rgt[i][0], Rgt[i][1]); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(${col},${0.7 * inSea * fa})`; ctx.beginPath();
        for (let y = Math.ceil(y0 / k.gap) * k.gap, n = 0; y < y1; y += k.gap, n++) {
          const b = at(y), q = V(b); if (!q) continue; const r = Math.hypot(b[0] - camX, b[2] - camZ) || 1, side = n % 2 ? 1 : -1, ox = ((b[0] - camX) / r) * 0.5 + side * ((b[2] - camZ) / r) * 0.25, oz = ((b[2] - camZ) / r) * 0.5 - side * ((b[0] - camX) / r) * 0.25;
          const tp = V([b[0] + ox, y + 0.35, b[2] + oz]); if (!tp) continue;
          const mx = (q[0] + tp[0]) / 2, my = (q[1] + tp[1]) / 2, nx = -(tp[1] - q[1]) * 0.28, ny = (tp[0] - q[0]) * 0.28;
          ctx.moveTo(q[0], q[1]); ctx.quadraticCurveTo(mx + nx, my + ny, tp[0], tp[1]); ctx.quadraticCurveTo(mx - nx, my - ny, q[0], q[1]);
        }
        ctx.fill();
      }
      // specks drifting in the water, and in the dark, plankton glowing
      ctx.fillStyle = 'rgb(255,255,255)';
      for (const sn of snow) {
        const p = sn.p; if (!ahead(p[1])) continue; const q = V([p[0] + Math.sin(t * 0.4 + sn.ph * 6) * 0.05, p[1] + ((sn.ph + t * 0.02) % 1) * 0.5, p[2]]); if (!q) continue;
        const r = clamp(1.5 * AHEAD / q[2], 0.6, 2.4); ctx.globalAlpha = inSea * fogA(q[2]) * (0.35 + 0.35 * clamp(dk / 0.5)); ctx.fillRect(q[0], q[1], r, r);
      }
      ctx.globalAlpha = 1;
      for (const g of glows) {
        const p = g.p; if (!ahead(p[1])) continue; const q = V(p); if (!q) continue;
        const a = inSea * fogA(q[2]) * clamp((dk - 0.45) / 0.2) * (reduce ? 0.7 : 0.45 + 0.55 * Math.sin(t * 1.7 + g.s * 40)); if (a < 0.03) continue;
        const r = clamp(2.4 * AHEAD / q[2], 0.8, 3.4); ctx.fillStyle = `rgba(${GLOW[g.c]},${a})`; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill();
      }
      // jellyfish from above: a round bell, its tentacles hanging down (towards the middle), glowing in the dark
      for (const j of jellies) {
        const p = j.p; if (!ahead(p[1])) continue; const yb = p[1] + Math.sin(t * 0.9 + j.ph) * 0.08, q = V([p[0], yb, p[2]]); if (!q) continue;
        const R = (j.r * F3) / q[2], a = fogA(q[2]) * inSea, c = JELLY[j.c], pl = 1 + 0.08 * Math.sin(t * 2 + j.ph); if (R > W) continue;
        if (dk > 0.4) { const gl = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R * 3); gl.addColorStop(0, `rgba(${c},${0.45 * clamp((dk - 0.4) / 0.3) * a})`); gl.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gl; ctx.fillRect(q[0] - R * 3, q[1] - R * 3, R * 6, R * 6); }
        ctx.strokeStyle = `rgba(${c},${0.55 * a})`; ctx.lineWidth = clamp(R * 0.07, 0.6, 2);
        for (let n = 0; n < 8; n++) { const an = (n / 8) * Math.PI * 2 + j.ph, e0 = V([p[0] + Math.cos(an) * j.r * 0.7, yb, p[2] + Math.sin(an) * j.r * 0.7]), e1 = V([p[0] + Math.cos(an) * j.r * 0.5 + Math.sin(t * 2 + n) * 0.03, yb + j.r * 5, p[2] + Math.sin(an) * j.r * 0.5]); if (!e0 || !e1) continue; ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.stroke(); }
        ctx.fillStyle = `rgba(${c},${0.8 * a})`; ctx.beginPath(); ctx.arc(q[0], q[1], R * pl, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * a})`; ctx.lineWidth = Math.max(1, R * 0.08); ctx.beginPath(); ctx.arc(q[0], q[1], R * pl * 0.55, 0, Math.PI * 2); ctx.stroke();
      }
      // a whale crossing slowly far below, seen from above
      if (whale && ahead(whale.c[1])) {
        const an = whale.h + t * 0.04, R = 6, wx = whale.c[0] + Math.cos(an) * R, wz = whale.c[2] + Math.sin(an) * R, hx = -Math.sin(an), hz = Math.cos(an), L = whale.L, wy = whale.c[1];
        const P = (u, v) => V([wx + hx * u * L - hz * v * L, wy, wz + hz * u * L + hx * v * L]);
        const body = [[0.5, 0], [0.46, 0.06], [0.32, 0.1], [0.12, 0.115], [-0.1, 0.095], [-0.3, 0.055], [-0.44, 0.022], [-0.47, 0.018]];
        const flap = reduce ? 0 : Math.sin(t * 0.9) * 0.04, out = [...body.map(([u, v]) => P(u, v)), P(-0.56, 0.14 + flap), P(-0.52, 0), P(-0.56, -0.14 + flap), ...body.slice().reverse().map(([u, v]) => P(u, -v))];
        const fins = [[P(0.2, 0.11), P(-0.02, 0.36 + flap), P(0.1, 0.115)], [P(0.2, -0.11), P(-0.02, -0.36 - flap), P(0.1, -0.115)]];
        const q = V([wx, wy, wz]);
        if (q && out.every(Boolean)) {
          const a = fogA(q[2]) * inSea * 0.9;
          ctx.fillStyle = `rgba(58,84,132,${a})`; ctx.beginPath(); ctx.moveTo(out[0][0], out[0][1]); for (const o of out.slice(1)) ctx.lineTo(o[0], o[1]); ctx.closePath(); ctx.fill();
          for (const fn of fins) if (fn.every(Boolean)) { ctx.beginPath(); ctx.moveTo(fn[0][0], fn[0][1]); ctx.quadraticCurveTo(fn[1][0], fn[1][1], fn[2][0], fn[2][1]); ctx.closePath(); ctx.fill(); }
          ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`;
          for (const [u, v] of [[0.3, 0.03], [0.18, -0.05], [0.05, 0.04], [-0.1, -0.02], [-0.22, 0.03]]) { const sp = P(u, v); if (sp) { ctx.beginPath(); ctx.arc(sp[0], sp[1], Math.max(1, (0.12 * F3) / q[2]), 0, Math.PI * 2); ctx.fill(); } }
        }
      }
      // rays gliding round the line, seen from above
      for (const m of mantas) {
        if (!ahead(m.c[1])) continue; const an = m.ph + m.dir * t * 0.12, cx = m.c[0] + Math.cos(an) * m.R, cz = m.c[2] + Math.sin(an) * m.R, hx = -Math.sin(an) * m.dir, hz = Math.cos(an) * m.dir;
        const flap = 1 + (reduce ? 0 : 0.14 * Math.sin(t * 1.6 + m.ph)), s = m.s, P = (f, sd) => V([cx + hx * f * s + -hz * sd * s * flap, m.c[1] + Math.abs(sd) * 0.08, cz + hz * f * s + hx * sd * s * flap]);
        const nose = P(0.5, 0), lw = P(-0.05, 0.75), rw = P(-0.05, -0.75), back = P(-0.42, 0), tail = P(-1.2, 0), q = V([cx, m.c[1], cz]); if (!nose || !lw || !rw || !back || !tail || !q) continue;
        const a = fogA(q[2]) * inSea;
        ctx.fillStyle = `rgba(74,96,140,${0.85 * a})`; ctx.beginPath(); ctx.moveTo(nose[0], nose[1]); ctx.quadraticCurveTo((nose[0] + lw[0]) / 2 + (lw[0] - back[0]) * 0.15, (nose[1] + lw[1]) / 2 + (lw[1] - back[1]) * 0.15, lw[0], lw[1]); ctx.quadraticCurveTo((lw[0] + back[0]) / 2, (lw[1] + back[1]) / 2, back[0], back[1]); ctx.quadraticCurveTo((rw[0] + back[0]) / 2, (rw[1] + back[1]) / 2, rw[0], rw[1]); ctx.quadraticCurveTo((nose[0] + rw[0]) / 2 + (rw[0] - back[0]) * 0.15, (nose[1] + rw[1]) / 2 + (rw[1] - back[1]) * 0.15, nose[0], nose[1]); ctx.fill();
        ctx.strokeStyle = `rgba(74,96,140,${0.85 * a})`; ctx.lineWidth = Math.max(1, (0.03 * F3) / q[2]); ctx.beginPath(); ctx.moveTo(back[0], back[1]); ctx.lineTo(tail[0], tail[1]); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`; ctx.beginPath(); ctx.arc((nose[0] + back[0]) / 2, (nose[1] + back[1]) / 2, (0.08 * s * F3) / q[2], 0, Math.PI * 2); ctx.fill();
      }
      // fish circling the line in schools, seen from above
      for (const f of fish) {
        if (!ahead(f.y)) continue; const an = f.ph + f.dir * t * f.w, x = f.c[0] + Math.cos(an) * f.R, z = f.c[2] + Math.sin(an) * f.R, hx = -Math.sin(an) * f.dir, hz = Math.cos(an) * f.dir;
        const h = V([x + hx * f.sz, f.y, z + hz * f.sz]), tl = V([x - hx * f.sz, f.y, z - hz * f.sz]); if (!h || !tl) continue;
        const L = Math.hypot(h[0] - tl[0], h[1] - tl[1]) / 2, a = fogA(h[2]) * inSea * (1 - 0.5 * dk); if (L < 0.4 || L > W) continue;
        const ang = Math.atan2(h[1] - tl[1], h[0] - tl[0]), mx = (h[0] + tl[0]) / 2, my = (h[1] + tl[1]) / 2, wig = reduce ? 0 : Math.sin(t * 9 + f.ph * 7) * 0.3;
        ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.fillStyle = `rgba(${FISHC[f.col]},${0.9 * a})`;
        ctx.beginPath(); ctx.ellipse(0, 0, L, L * 0.36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-L * 0.8, 0); ctx.lineTo(-L * 1.5, -L * (0.42 + wig * 0.3)); ctx.lineTo(-L * 1.5, L * (0.42 - wig * 0.3)); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      // bubbles rising past the camera
      for (const b of bubbles) {
        const p = b.p, y = p[1] - (((b.off + t * 0.05 * b.v) % 1) * 6); if (!ahead(y)) continue; const q = V([p[0] + Math.sin(t + b.off * 9) * 0.04, y, p[2]]); if (!q) continue;
        const r = (b.r * F3) / q[2], a = fogA(q[2]) * inSea; if (r > W * 0.4) continue;
        ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`; ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`; ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${0.7 * a})`; ctx.beginPath(); ctx.arc(q[0] - r * 0.35, q[1] - r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.fill();
      }
      // the jellyfish of light each message of the sea is set on: the line threads through the middle of its bell; pale
      // until the hook reaches it, then it lights up in its own colour and stays lit, glowing more in the dark
      OBJ.sea.forEach((sz, i) => {
        const c = seaPath(sz), q = V(c); if (!q || !ahead(c[1])) return;
        const lit = ease(clamp((penZ - sz) / 0.35)), R = (0.32 * F3) / q[2], col = SETC[i % 4], pl = 1 + (reduce ? 0 : 0.05 * Math.sin(t * 1.8 + i));
        if (R > W * 1.5) return;
        const a = inSea * fogA(q[2]) * clamp((q[2] - 0.6) / 1.2);
        if (lit > 0) { const gl = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R * 3.2); gl.addColorStop(0, `rgba(${col},${(0.35 + 0.35 * dk) * lit * a})`); gl.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = gl; ctx.fillRect(q[0] - R * 3.2, q[1] - R * 3.2, R * 6.4, R * 6.4); }
        // tentacles hanging down, which seen from above run in towards the middle
        ctx.strokeStyle = lit > 0 ? `rgba(${col},${(0.4 + 0.4 * lit) * a})` : `rgba(255,255,255,${0.45 * a})`; ctx.lineWidth = clamp(R * 0.05, 0.8, 2.5);
        for (let n = 0; n < 12; n++) { const an = (n / 12) * Math.PI * 2 + i, e0 = V([c[0] + Math.cos(an) * 0.25, c[1], c[2] + Math.sin(an) * 0.25]), e1 = V([c[0] + Math.cos(an) * 0.13 + Math.sin(t * 1.6 + n) * 0.03, c[1] + 2.4, c[2] + Math.sin(an) * 0.13]); if (!e0 || !e1) continue; ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.stroke(); }
        // the bell: a soft disc, a rim, and an inner ring around the line
        ctx.fillStyle = lit > 0 ? `rgba(${col},${(0.3 + 0.35 * lit) * a})` : `rgba(255,255,255,${0.16 * a})`; ctx.beginPath(); ctx.arc(q[0], q[1], R * pl, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = lit > 0 ? `rgba(255,255,255,${(0.5 + 0.4 * lit) * a})` : `rgba(255,255,255,${0.6 * a})`; ctx.lineWidth = clamp(R * 0.06, 1, 3); ctx.stroke();
        ctx.beginPath(); ctx.arc(q[0], q[1], R * 0.45 * pl, 0, Math.PI * 2); ctx.stroke();
      });
      // a thin stream of bubbles going up from the hook
      const tip = seaPath(penZ);
      for (let i = 0; i < 16; i++) {
        const ph = reduce ? i / 16 : (t * 0.45 + i / 16) % 1, q = V([tip[0] + Math.sin(i * 2.3 + t * 2) * 0.05 * ph, tip[1] - ph * 3.6, tip[2] + Math.cos(i * 1.7 + t * 2) * 0.05 * ph]); if (!q) continue;
        const r = clamp(((0.012 + 0.022 * ph) * F3) / q[2], 1, 9), a = inSea * (1 - ph) * 0.9;
        ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.stroke();
      }
    }
    function spaceElements(A, inR) {
      // space: stars all around; the stars of the constellation are where the line turns
      for (const st of stars) {
        if (!inR(st.z) || !near(st.z, 20) || penZ < st.z - 12) continue;
        const q = V([st.x, st.y, st.z]); if (!q) continue;
        const k = passed(st.z - 2), a = A * fogA(q[2]) * clamp((penZ - (st.z - 12)) / 2) * (reduce ? 0.7 : 0.6 + 0.3 * Math.sin(T * 1.4 + st.s * 30));
        const r = clamp(2.2 * AHEAD / q[2], 0.7, 3.2), col = k > 0.05 ? tint(PASTEL.space.star[st.c], k, a) : `rgba(200,204,222,${0.6 * a})`;
        if (st.sparkle) { const L = r * 3; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q[0] - L, q[1]); ctx.lineTo(q[0] + L, q[1]); ctx.moveTo(q[0], q[1] - L); ctx.lineTo(q[0], q[1] + L); ctx.stroke(); }
        else { ctx.fillStyle = col; ctx.fillRect(q[0] - r / 2, q[1] - r / 2, r, r); }
      }
      for (let i = 0; i < STARS.length; i++) {
        const sp = STARS[i]; if (!inR(sp[2]) || sp[2] > TAIL || !near(sp[2]) || penZ < sp[2] - 10) continue;
        const q = V(sp); if (!q) continue;
        const k = passed(sp[2], 0), lit = penZ >= sp[2], a = A * fogA(q[2]), R = clamp(0.07 * F3 / q[2], 3, 14) * (lit ? 1.3 : 1);
        const col = lit ? tint(PASTEL.space.star[i % 3], Math.max(0.6, k), a) : `rgba(200,204,222,${0.45 * a})`;
        ctx.fillStyle = col; ctx.beginPath();
        for (let j = 0; j < 8; j++) { const an = (j / 8) * Math.PI * 2 - Math.PI / 2, rr = j % 2 ? R * 0.38 : R; ctx.lineTo(q[0] + Math.cos(an) * rr, q[1] + Math.sin(an) * rr); }
        ctx.closePath(); ctx.fill();
        if (lit) { const gl = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R * 3); gl.addColorStop(0, tint(PASTEL.space.star[i % 3], 1, 0.35 * a)); gl.addColorStop(1, tint(PASTEL.space.star[i % 3], 1, 0)); ctx.fillStyle = gl; ctx.fillRect(q[0] - R * 3, q[1] - R * 3, R * 6, R * 6); }
      }
    }
    /* A phone at each change of world, and the visitor goes into it. Three beats over p (0 to 1):
         0 - .45  it comes flying along the line from far ahead, turning to face the visitor, and stops in the middle;
                  the line runs into its charging port
       .45 - .62  its screen wakes: the visitor's own time and a notification, the next world lighting up behind them
       .62 - 1    it pulls: the world around is drawn in towards it, light streams into the screen, and the screen
                  grows until it is the whole view. Through the screen the next world is really there (inside draws
                  it), so when it fills the view it simply is the next scene. */
    // the phone's scale (its screen is 1.9556 of it tall) through the passage
    function phoneScale(p) {
      const hold = (H * (NARROW ? 0.56 : 0.66)) / 1.9556;
      if (p <= PH_HOLD) return lerp(hold * 0.22, hold, Math.pow(ease(p / PH_HOLD), 1.4));
      if (p <= PH_WAKE) return hold * (1 + 0.06 * (p - PH_HOLD) / (PH_WAKE - PH_HOLD));
      const end = 1.12 * Math.max(W / 0.98, H / 1.83), q = (p - PH_WAKE) / (1 - PH_WAKE);
      return hold * 1.06 * Math.pow(end / (hold * 1.06), Math.pow(q, 1.7));
    }
    const phoneDepth = (p) => F3 / phoneScale(p);
    // how hard the phone pulls at the world around it
    const phonePull = (p) => ease((p - PH_WAKE + 0.06) / (1 - PH_WAKE + 0.02));
    // the world outside, drawn in towards the phone at the middle of the view
    function pulled(p, dark, draw) {
      const k = phonePull(p);
      if (k <= 0 || reduce) { draw(); return; }
      ctx.save(); ctx.translate(W / 2, H * 0.5); ctx.scale(1 + 0.55 * k * k, 1 + 0.55 * k * k); ctx.rotate(0.07 * k * k * (dark ? -1 : 1)); ctx.translate(-W / 2, -H * 0.5);
      draw(); ctx.restore();
      const D = Math.hypot(W, H), g = ctx.createRadialGradient(W / 2, H * 0.5, D * 0.12, W / 2, H * 0.5, D * 0.62);
      g.addColorStop(0, 'rgba(10,14,30,0)'); g.addColorStop(1, `rgba(10,14,30,${0.55 * k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // where along the path P (between lo and hi) the line is d deep in front of the camera
    function atDepth(P, d, lo, hi) {
      const dep = (z) => { const q = P(z); return (q[2] - camZ) * cP - (q[1] - camY) * sP; };
      if (dep(hi) <= d) return hi; if (dep(lo) >= d) return lo;
      for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (dep(m) < d) lo = m; else hi = m; }
      return (lo + hi) / 2;
    }
    function phoneIn(p, an, dark, A, inside, note) {
      const s3 = phoneScale(p), show = ease(p / 0.1), t = reduce ? 0 : T;
      // it flies in along the line and comes to rest square in the middle
      const k = ease((p - 0.16) / (PH_HOLD - 0.16)), cx = lerp(an[0], W / 2, k), cy = lerp(an[1], H * 0.5, k);
      const roll = (1 - ease(p / PH_HOLD)) * 0.42 * (dark ? -1 : 1), yaw = (1 - ease(p / (PH_HOLD - 0.04))) * 1.05 * (dark ? 1 : -1);
      // waking (0 to 1), pulling (0 to 1)
      const wake = ease((p - PH_HOLD + 0.03) / (PH_WAKE - PH_HOLD)), pull = phonePull(p);
      // a 9:16 phone
      const w = 1.1 * s3, h = 1.9556 * s3, m = 0.06 * s3, D = Math.hypot(W, H);
      // the phone's own plane (u across, v down), turned by yaw about its upright axis and seen in perspective, so a
      // turned phone narrows to its far edge instead of just getting thinner; then rolled
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll), fp = h * 1.6;
      const P = (u, v) => { const k2 = fp / (fp + u * syw), X = u * cyw * k2, Y = v * k2; return [cx + X * cr - Y * sr, cy + X * sr + Y * cr]; };
      const rr = (x0, y0, ww, hh, r) => {
        ctx.beginPath(); let first = true;
        for (const [ax, ay, a0] of [[x0 + ww - r, y0 + r, -Math.PI / 2], [x0 + ww - r, y0 + hh - r, 0], [x0 + r, y0 + hh - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]])
          for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2), q = P(ax + Math.cos(a) * r, ay + Math.sin(a) * r); if (first) { ctx.moveTo(q[0], q[1]); first = false; } else ctx.lineTo(q[0], q[1]); }
        ctx.closePath();
      };
      // the line runs into its charging port
      if (k > 0) {
        const port = P(0, h / 2 - 0.004 * s3);
        ctx.strokeStyle = dark ? `rgba(220,226,255,${0.9 * A * show})` : `rgba(${INK},${0.9 * A * show})`; ctx.lineWidth = Math.max(1.6, 0.016 * s3); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(an[0], an[1]); ctx.bezierCurveTo(an[0], lerp(an[1], H + 40, 0.5), port[0], port[1] + 0.35 * h, port[0], port[1]); ctx.stroke();
      }
      // light streaming into the screen, ever faster as it pulls
      const st = Math.max(0.35 * wake, pull) * (1 - clamp((p - 0.95) / 0.05));
      if (st > 0 && !reduce) {
        const n = NARROW ? 26 : 40, speed = 1 + 2.4 * pull;
        for (let i = 0; i < n; i++) {
          const ang = i * 2.39996, ph = (t * 0.9 * speed + i * 0.37) % 1, r0 = lerp(0.75, 0.12, ph * ph) * D, r1 = r0 + (0.05 + 0.2 * pull) * D * (1 - ph);
          ctx.lineWidth = 1 + 2 * pull * (1 - ph);
          ctx.strokeStyle = dark ? `rgba(220,226,255,${0.5 * st * (1 - ph)})` : `rgba(255,255,255,${0.85 * st * (1 - ph)})`;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1); ctx.stroke();
        }
      }
      ctx.save();
      ctx.globalAlpha = show;
      // the screen's light falls around it
      const glowA = (dark ? 0.32 : 0.5) * A * Math.max(dark ? 0.6 * show : 0, wake);
      if (glowA > 0) { const gl = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 1.1); gl.addColorStop(0, dark ? `rgba(200,206,255,${glowA})` : `rgba(255,255,255,${glowA})`); gl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.fillRect(cx - h * 1.2, cy - h * 1.2, h * 2.4, h * 2.4); }
      // the body, a side button, a rim catching the light
      ctx.fillStyle = `rgba(${INK},${A})`; rr(-w / 2, -h / 2, w, h, 0.16 * s3); ctx.fill();
      ctx.strokeStyle = dark ? `rgba(196,200,214,${0.8 * A})` : `rgba(255,255,255,${(0.28 + 0.4 * wake) * A})`; ctx.lineWidth = Math.max(1, 0.012 * s3); ctx.stroke();
      ctx.fillStyle = `rgba(${INK},${A})`; rr(w / 2 - 0.004 * s3, -h * 0.22, 0.03 * s3, h * 0.12, 0.01 * s3); ctx.fill();
      rr(-w / 2 + m, -h / 2 + m, w - 2 * m, h - 2 * m, 0.1 * s3); ctx.clip();
      // the next world, dim behind the glass until the screen wakes
      ctx.fillStyle = `rgba(251,251,250,${A})`; ctx.fillRect(0, 0, W, H);
      inside();
      const off = 1 - Math.max(0.25, wake);
      if (off > 0) { ctx.fillStyle = `rgba(8,10,20,${0.85 * off * A})`; ctx.fillRect(0, 0, W, H); }
      // the lock screen over it: the visitor's own time, and a notification from TALETONE; they rush past as it pulls
      const ui = wake * (1 - ease(pull / 0.45));
      if (ui > 0.01 && Math.abs(yaw) < 0.2) {
        const sc = s3 * (1 + 1.2 * pull), fam = '"LINE Seed KR","LINE Seed JP",system-ui,sans-serif', ink = dark ? '244,244,252' : '255,255,255';
        const O = P(0, 0), ox = O[0], oy = O[1];
        ctx.globalAlpha = show * ui; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = `rgba(${ink},0.96)`; ctx.font = `700 ${(0.3 * sc).toFixed(1)}px ${fam}`;
        ctx.fillText(($('#jy-clock') || {}).textContent || '', ox, oy - 0.52 * sc);
        ctx.font = `400 ${(0.06 * sc).toFixed(1)}px ${fam}`; ctx.fillStyle = `rgba(${ink},0.8)`;
        ctx.fillText(($('#jy-date') || {}).textContent || '', ox, oy - 0.43 * sc);
        // the notification rises into place
        const nw = 0.92 * sc, nh = 0.2 * sc, nx = ox - nw / 2, ny = oy - 0.2 * sc + (1 - ease((wake - 0.25) / 0.6)) * 0.12 * sc;
        ctx.globalAlpha = show * ui * ease((wake - 0.25) / 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(nx, ny, nw, nh, 0.05 * sc) : ctx.rect(nx, ny, nw, nh); ctx.fill();
        ctx.fillStyle = `rgb(${INK})`; ctx.beginPath(); ctx.arc(nx + 0.08 * sc, ny + nh / 2, 0.042 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = 'left'; ctx.fillStyle = `rgba(${INK},0.62)`; ctx.font = `700 ${(0.038 * sc).toFixed(1)}px ${fam}`;
        ctx.fillText(COPY.notifyFrom || 'TALETONE', nx + 0.145 * sc, ny + 0.078 * sc);
        ctx.textAlign = 'right'; ctx.fillText(COPY.notifyNow || '', nx + nw - 0.04 * sc, ny + 0.078 * sc);
        ctx.textAlign = 'left'; ctx.fillStyle = `rgb(${INK})`; ctx.font = `700 ${(0.05 * sc).toFixed(1)}px ${fam}`;
        ctx.fillText(note || '', nx + 0.145 * sc, ny + 0.145 * sc, nw - 0.19 * sc);
        ctx.globalAlpha = show;
      }
      // a sheen running across the glass as it is entered
      if (pull > 0 && pull < 1 && !reduce) {
        const gx = lerp(-0.8, 1.8, pull) * W, g = ctx.createLinearGradient(gx - W * 0.25, 0, gx + W * 0.25, H * 0.4);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${0.32 * (1 - pull)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }
    function drawWorld(A) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (penZ < ZS) {
        // the land, then straight up into the sky; at the top a phone comes down the line and the visitor is drawn into
        // it. Through it is the sea, looked straight down into, which looks just like the sky looked straight up into:
        // only once through does it turn out to be water
        const p = clamp((penZ - (ZS - PH.land)) / PH.land);
        if (p <= 0) { backdrop(0, A); elements(0, A); drawLine(-1e9, penZ, lineRGB, A); drawTip(lineRGB, A); drawLead(A); return; }
        const zP = atDepth(pathAt, phoneDepth(p), penZ - 6, ZS - 0.001), an = V(pathAt(zP)) || [W / 2, H * 0.5];
        pulled(p, false, () => { backdrop(0, A); elements(0, A); drawLine(-1e9, Math.min(penZ, zP), lineRGB, A); if (penZ <= zP) drawTip(lineRGB, A); });
        phoneIn(p, an, false, A, () => {
          const c0 = getCam(); setCam(rig(penZ, 1));
          backdrop(1, A); elements(1, A); drawLine(ZS - 4, penZ, INK, A, seaPath); drawTip(INK, A, seaPath, true);
          setCam(c0);
        }, (COPY.phoneNotes || [])[0]);
        drawLead(A);
        return;
      }
      if (penZ < S0) {
        // straight down into the deep; at the bottom a phone comes up the line, and through it is space
        const p = clamp((penZ - (S0 - PH.sea)) / PH.sea);
        if (p <= 0) { backdrop(1, A); elements(1, A); drawLine(ZS - 4, penZ, lineRGB, A, seaPath); drawTip(lineRGB, A, seaPath, true); drawLead(A); return; }
        const zP = atDepth(seaPath, phoneDepth(p), penZ - 2, S0 + 2), an = V(seaPath(zP)) || [W / 2, H * 0.5];
        pulled(p, true, () => { backdrop(1, A); elements(1, A); drawLine(ZS - 4, Math.min(penZ, zP), lineRGB, A, seaPath); if (penZ <= zP) drawTip(lineRGB, A, seaPath, true); });
        phoneIn(p, an, true, A, () => {
          const c0 = getCam(); setCam(rig(penZ, 2));
          backdrop(2, A); elements(2, A); drawLine(S0 - 4, penZ, '244,244,252', A, spacePath); drawTip('244,244,252', A, spacePath);
          setCam(c0);
        }, (COPY.phoneNotes || [])[1]);
        drawLead(A);
        return;
      }
      backdrop(2, A); elements(2, A);
      drawLine(-1e9, penZ, lineRGB, A, spacePath); drawTip(lineRGB, A, spacePath); drawLead(A);
    }
    function buildRecordWash() {
      recBuilt = true;
      const held = WORKS.filter(lit).map((w) => colorOf[w.slug]).filter(Boolean).slice(0, 6).map((c) => ({ c }));
      const cols = (palette.length ? [...palette].sort((a, b) => b.s - a.s) : held.length ? held : [{ c: [163, 168, 181] }]).slice(0, 6).map((p) => `rgb(${p.c})`);
      const stops = cols.length === 1 ? [cols[0], cols[0]] : cols, g = `conic-gradient(${[...stops, stops[0]].join(',')})`;
      $('#jy-rwash').style.background = g; $('#jy-charm-cd').style.background = g;
    }

    /* ---- the record of every story: its groove opens into a staff swirling into the screen ----
       World: five helices around the view axis (a staff); work i is a note on it at depth i*DZ, angle i*TURN and a
       pitch from a gentle melody. The camera flies down the axis; the view rolls so the note in focus always sits
       at the same place, so the swirl turns around the visitor.
       The staff is the pen line itself: it arrives as one line and splits in five. An album in focus lets its tracks out on an earphone cord. */
    const DZ = 0.6, TURN = 0.5, VIEW = 1.5, FOCUS = 0.5, NEAR = 0.25, FAR = 11, GAP = 0.066, HEAD = -1.6;
    // past the last song the camera rises back out of the staff to CEND, where the whole of it, its five lines joined
    // into one again, is seen face on: one spiral from the first song at the rim to the last at the label, the groove
    // of a record (the same as at the start, when the dive went into that groove)
    const CEND = -7.6;
    // the five lines open out of one over the first stretch of the staff (and close into one again at the end)
    const splitAt = (z) => ease((z - HEAD) / 1.1), lineRad = (l, z) => 1 + (l * 2 - 4) * GAP * 0.5 * splitAt(z) * (1 - ((cur && cur.merge) || 0));
    // depth shrinks the swirl gently (a power below 1), so the far turns open out instead of knotting at the centre
    const OPEN = 0.55, shrink = (dz) => Math.pow(VIEW / dz, OPEN);
    const pitchOf = (i) => Math.round(4 + 3 * Math.sin(i * 0.83 + 0.4)); // 0..8: lines and spaces, bottom to top
    const radiusOf = (p) => 1 + (p - 4) * GAP * 0.5;
    const trackLayer = $('#jy-tracks');
    let cur = null, recK = 0, recShown = -1, flow = [], trackEls = {}, albumOpen = -1;
    function buildCurrent() {
      const Rf = NARROW ? Math.min(W * 0.34, H * 0.2) : Math.min(W * 0.26, H * 0.37), size = NARROW ? clamp(W * 0.2, 60, 88) : clamp(H * 0.14, 92, 128);
      const cy0 = NARROW ? H * 0.31 : H * 0.5;
      cur = { cx: NARROW ? W / 2 : W * 0.36, cy: cy0, cy0, F: Rf * VIEW, size, Rf, Rf0: Rf, merge: 0, far: FAR, fade: 1 };
      // where the staff begins on screen when the record opens: the world's line comes in there along the way the
      // staff leaves it. The staff is turned so its head sits upper right, and turns back as the camera dives in.
      { const c0 = -VIEW - 2.2, r0 = FOCUS - ((c0 + VIEW) / DZ) * TURN, at = (z) => { const a = (z / DZ) * TURN + r0 + cur.off, r = Rf * shrink(z - c0); return [W / 2 + Math.cos(a) * r, cur.cy0 + Math.sin(a) * r]; };
        cur.off = 0; cur.off = -0.8 - ((HEAD / DZ) * TURN + r0);
        cur.off = Math.atan2(Math.sin(cur.off), Math.cos(cur.off));
        const T = at(HEAD), T2 = at(HEAD + 0.12), n = Math.hypot(T2[0] - T[0], T2[1] - T[1]) || 1;
        tail = { T, tg: [(T2[0] - T[0]) / n, (T2[1] - T[1]) / n], L: Math.min(W, H) * 0.42 }; }
      spiral.style.setProperty('--s', size + 'px');
      const n = W <= 760 ? FLOW_DOTS.narrow : FLOW_DOTS.wide;
      flow = Array.from({ length: n }, () => ({ z: Math.random() * (N + 4) - 2, a: Math.random() * Math.PI * 2, r: 0.7 + Math.random() * 0.6, v: 0.15 + Math.random() * 0.3 }));
    }
    // tracks of each album, built once
    items.forEach((li, i) => {
      const w = bySlug[li.dataset.slug];
      if (!li.hasAttribute('data-album')) return;
      const box = document.createElement('div'); box.className = 'jy-trks'; box.dataset.i = i; box.dataset.slug = w.slug;
      box.setAttribute('role', 'group'); box.setAttribute('aria-label', `${w.title} · ${COPY.albumTracks || COPY.tracks}`);
      w.tracks.forEach((t, j) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'jy-trk'; b.disabled = !t.audio; b.tabIndex = -1;
        b.setAttribute('aria-label', `${String(j + 1).padStart(2, '0')} ${t.title}`); b.setAttribute('aria-pressed', 'false');
        b.innerHTML = '<span class="jy-vy"><img alt="" loading="lazy" decoding="async"></span><i></i><span class="jy-trk-t"></span>';
        // (the art loads when the album opens, not with the page)
        b.querySelector('img').dataset.src = /^https?:/.test(t.thumb || '') ? t.thumb : ASSET + (t.thumb || w.thumb);
        // (each track on its own vinyl, from its own art)
        if (t.vinyl && t.vinyl.length) ['--v1', '--v2', '--v3'].forEach((k, n) => b.style.setProperty(k, t.vinyl[n])); b.querySelector('i').textContent = String(j + 1).padStart(2, '0'); b.querySelector('.jy-trk-t').textContent = t.title;
        b.addEventListener('click', () => (isPlaying(w.slug, j) ? pause() : play(w, j)));
        box.appendChild(b);
      });
      if (w.vinyl && w.vinyl.length) ['--v1', '--v2', '--v3'].forEach((k, n) => box.style.setProperty(k, w.vinyl[n]));
      trackLayer.appendChild(box); trackEls[i] = box;
    });
    listeners.add(() => Object.entries(trackEls).forEach(([i, box]) => { const w = bySlug[items[i].dataset.slug]; $$('.jy-trk', box).forEach((b, j) => b.setAttribute('aria-pressed', String(isPlaying(w.slug, j)))); }));
    const recordU = (k) => CH.record[0] + (CH.record[1] - CH.record[0]) * (0.1 + 0.82 * (N > 1 ? k / (N - 1) : 0));
    // whatever has passed the note in focus fades out, so nothing covers the words on the right
    const behind = (dz) => clamp((dz - VIEW * 0.45) / (VIEW * 0.4));
    const proj = (theta, z, camZ, roll, rad = 1) => { const dz = z - camZ; if (dz < NEAR) return null; const r = cur.Rf * rad * shrink(dz); return [cur.cx + Math.cos(theta + roll) * r, cur.cy + Math.sin(theta + roll) * r, dz]; };
    // an album's tracks hang on an earphone cord that runs out of the album along the bottom
    const cord = (n, fx) => {
      if (NARROW) {
        // on a narrow screen: one or two rows across, just above the record's card
        const top = (readout.getBoundingClientRect().top || H * 0.7) - 52, rows = n > 6 ? 2 : 1, per = Math.ceil(n / rows), sp = Math.min(64, (W - 56) / per);
        return Array.from({ length: n }, (_, j) => { const r = Math.floor(j / per), c = j % per; return [W - 34 - (c + 0.5) * sp - (r ? sp / 2 : 0), top - r * 58 + Math.sin(c * 1.35 + 0.6) * 6]; });
      }
      const y = H * 0.905, x0 = fx - 70, sp = Math.min(78, (x0 - 72) / Math.max(1, n)); return Array.from({ length: n }, (_, j) => [x0 - (j + 0.5) * sp, y + Math.sin(j * 1.35 + 0.6) * 16]); };
    function placeCurrent(lr) {
      const k = recK, focusZ = k * DZ;
      const dive = ease((lr - 0.02) / 0.1), out = ease((lr - 0.91) / 0.09);
      // diving: from above the groove (a flat spiral) down into it; leaving: back up out of it, to see it whole
      const camIn = lerp(-VIEW - 2.2, focusZ - VIEW, dive), camZ = lerp(camIn, CEND, out);
      cur.cx = lerp(lerp(W / 2, NARROW ? W / 2 : W * 0.36, dive), W / 2, out); cur.cy = lerp(cur.cy0, H * 0.5, out);
      // (seen whole, it is as big as the record it becomes)
      cur.Rf = lerp(cur.Rf0, (Math.min(W, H) * 0.34) / shrink(HEAD - CEND), out); cur.merge = out; cur.far = lerp(FAR, 40, out); cur.fade = 1 - ease(out / 0.5);
      const roll = FOCUS - ((camZ + VIEW) / DZ) * TURN + (cur.off || 0) * (1 - dive);
      cur.camZ = camZ; cur.roll = roll;
      // the pen draws the staff forward from its head; works appear once their part of the staff is drawn
      cur.zMax = HEAD + (camIn + FAR - HEAD) * ease(lr / 0.15);
      const list = recordEl.classList.contains('list');
      spiral.style.opacity = list ? '1' : String(ease((lr - 0.02) / 0.06) * cur.fade);
      if (!list) items.forEach((li, i) => {
        const p = proj(i * TURN, i * DZ, camZ, roll, radiusOf(pitchOf(i)));
        if (!p || p[2] > cur.far) { li.style.visibility = 'hidden'; return; }
        // a note fades as soon as it has passed the focus, so it never covers the words on the right
        const sc2 = Math.pow(VIEW / p[2], 0.8) * (li.classList.contains('pin') ? 1.3 : 1), a = clamp((p[2] - VIEW * 0.72) / (VIEW * 0.22)) * clamp((FAR - p[2]) / 5) * clamp((cur.zMax - i * DZ) / 0.5);
        li.style.visibility = a > 0.02 ? 'visible' : 'hidden';
        li.style.transform = `translate(${p[0]}px,${p[1]}px) scale(${sc2})`;
        li.style.opacity = String(a); li.style.zIndex = String(Math.round(1000 - p[2] * 40));
      });
      const i = Math.round(k);
      if (i !== recShown) { recShown = i; showReadout(i); }
      const near = Math.abs(k - i) < 0.32 && lr > 0.1 && lr < 0.92 && !list && !NARROW ? i : -1;
      Object.entries(trackEls).forEach(([j, box]) => {
        const show = Number(j) === near;
        box.classList.toggle('on', show);
        $$('.jy-trk', box).forEach((b) => { b.tabIndex = show ? 0 : -1; });
        if (!show) return;
        $$('img[data-src]', box).forEach((im) => { im.src = im.dataset.src; delete im.dataset.src; });
        const btns = $$('.jy-trk', box), fp = proj(near * TURN, near * DZ, camZ, roll, radiusOf(pitchOf(near))), pts2 = cord(btns.length, fp ? fp[0] : W * 0.5);
        btns.forEach((b, n) => { b.style.transform = `translate(${pts2[n][0]}px,${pts2[n][1]}px)`; b.style.transitionDelay = (n * 30) + 'ms'; });
      });
      albumOpen = near;
    }
    // one helix of the staff, stroked in short runs so the width can follow the depth
    function staffLine(l, z0, z1, camZ, roll, alpha, width) {
      let run = [], wPrev = -1, aPrev = -1;
      const flush = () => { if (run.length > 1) { ctx.lineWidth = wPrev; ctx.lineCap = aPrev < 1 ? 'butt' : 'round'; ctx.strokeStyle = `rgba(${lineRGB},${aPrev})`; ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); for (let n = 1; n < run.length; n++) ctx.lineTo(run[n][0], run[n][1]); ctx.stroke(); } };
      for (let z = z0; z <= z1; z += 0.04) {
        const p = proj((z / DZ) * TURN, z, camZ, roll, lineRad(l, z)); if (!p) continue;
        // still one line before it splits: as thick as the pen line it continues
        const wd = Math.round(clamp(width * VIEW / p[2] * (1 + 1.4 * Math.max(1 - splitAt(z), cur.merge)), lerp(0.4, 1.5, cur.merge), 3.2) * 4) / 4, al = Math.round(0.85 * alpha * behind(p[2]) * clamp((cur.far - p[2]) / 6) * 20) / 20;
        if (wd !== wPrev || al !== aPrev) { const last = run[run.length - 1]; flush(); run = last ? [last] : []; wPrev = wd; aPrev = al; }
        run.push(p);
      }
      flush(); ctx.lineCap = 'round';
    }
    function drawCurrent(lr, lineA = 1) {
      if (!cur || cur.camZ == null) return;
      const { camZ, roll, zMax } = cur, FAR = cur.far, alpha = cur.fade;
      if (lineA <= 0) return;
      // the colour of the note in focus, faint, around the swirl
      const w = recShown >= 0 && bySlug[items[recShown].dataset.slug], c = w && colorOf[w.slug];
      if (c) { const g = ctx.createRadialGradient(cur.cx, cur.cy, 0, cur.cx, cur.cy, Math.max(W, H) * 0.6); g.addColorStop(0, `rgba(${c},${0.16 * alpha * ease(lr / 0.12)})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      // the staff: five ink lines swirling in, thick close by, a hair far away
      const z0 = Math.max(HEAD, camZ + NEAR + 0.02), z1 = Math.min((N - 1) * DZ + 2.5, camZ + FAR, zMax);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // (once the five have closed into one, only the middle one is drawn)
      for (let l = 0; l < 5; l++) if (cur.merge < 0.97 || l === 2) staffLine(l, z0, z1, camZ, roll, lineA, 1.3);
      if (alpha <= 0) return;
      // while it is still being drawn, the five pen tips at the front
      if (z1 >= z0 && zMax < camZ + FAR - 0.05) {
        ctx.fillStyle = `rgba(${lineRGB},${alpha})`;
        for (let l = 0; l < 5; l++) { const p = proj((z1 / DZ) * TURN, z1, camZ, roll, lineRad(l, z1)); if (!p) continue; ctx.beginPath(); ctx.arc(p[0], p[1], clamp(2.6 * VIEW / p[2], 1.2, 4), 0, Math.PI * 2); ctx.fill(); }
      }
      // bar lines every four notes
      for (let i = 3; i < N; i += 4) {
        const z = (i + 0.5) * DZ, a = proj((z / DZ) * TURN, z, camZ, roll, radiusOf(0)), b2 = proj((z / DZ) * TURN, z, camZ, roll, radiusOf(8));
        if (!a || !b2 || a[2] > FAR || z > zMax) continue;
        ctx.strokeStyle = `rgba(${INK},${0.85 * alpha * behind(a[2]) * clamp((FAR - a[2]) / 6)})`; ctx.lineWidth = clamp(1.6 * VIEW / a[2], 0.4, 3); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
      }
      // stems: from each note, across the staff, away from the middle line
      for (let i = 0; i < N; i++) {
        const pi = pitchOf(i), up = pi < 4, th = i * TURN, z = i * DZ;
        const a = proj(th, z, camZ, roll, radiusOf(pi)); if (!a || a[2] > FAR || a[2] < VIEW * 0.72 || z > zMax) continue;
        const rr = (cur.size / 2) * Math.pow(VIEW / a[2], 0.8), dir = up ? 1 : -1, ang = th + roll, len = cur.Rf * GAP * 3.4 * shrink(a[2]);
        const sx = a[0] + Math.cos(ang) * rr * dir, sy = a[1] + Math.sin(ang) * rr * dir;
        ctx.strokeStyle = `rgba(${INK},${0.85 * alpha * clamp((FAR - a[2]) / 6) * clamp((a[2] - VIEW * 0.72) / (VIEW * 0.22))})`; ctx.lineWidth = clamp(2 * VIEW / a[2], 0.5, 3);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(ang) * len * dir, sy + Math.sin(ang) * len * dir); ctx.stroke();
      }
      // specks drifting down the swirl
      ctx.fillStyle = `rgb(${INK})`;
      for (const d of flow) {
        if (!reduce) d.z -= d.v * 0.016; if (d.z < camZ) d.z += FAR; if (d.z > zMax) continue;
        const p = proj((d.z / DZ) * TURN + d.a * 0.08, d.z, camZ, roll, d.r); if (!p) continue;
        const r = clamp(2.4 * VIEW / p[2], 0.6, 3.5);
        ctx.globalAlpha = alpha * 0.45 * clamp((FAR - p[2]) / 6) * behind(p[2]); ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r);
      }
      ctx.globalAlpha = 1;
      // the album's earphone cord: out of the album and along its tracks
      if (albumOpen >= 0 && trackEls[albumOpen]) {
        const p = proj(albumOpen * TURN, albumOpen * DZ, camZ, roll, radiusOf(pitchOf(albumOpen))), n = $$('.jy-trk', trackEls[albumOpen]).length;
        if (p) {
          const pts2 = cord(n, p[0]);
          let prev = [p[0], p[1] + (cur.size / 2) * Math.pow(VIEW / p[2], 0.8)];
          ctx.strokeStyle = `rgba(${INK},${0.85 * alpha})`; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]);
          for (const q of pts2) { const mx = (prev[0] + q[0]) / 2; ctx.bezierCurveTo(mx, prev[1] + 26, mx, q[1] + 26, q[0], q[1]); prev = q; }
          ctx.stroke();
        }
      }
    }
    // Done: the groove, now where the record is, gives way to the record itself as it goes into the phone (sc: how
    // much the record has shrunk, cx/cy: its centre)
    let grooveSpin = 0;
    function drawGroove(ld, sc, cx, cy) {
      if (!cur) return;
      cur.cx = cx; cur.cy = cy; cur.Rf = ((Math.min(W, H) * 0.34) / shrink(HEAD - CEND)) * sc;
      cur.camZ = CEND; cur.merge = 1; cur.far = 40; cur.fade = 0; cur.zMax = 1e9;
      cur.roll = FOCUS - ((CEND + VIEW) / DZ) * TURN + grooveSpin;
      drawCurrent(1, 1 - ease((ld - 0.06) / 0.22));
    }
    // Epilogue: the line comes back out from under the record in the phone and runs to the inquiry, lies along the
    // first line to write on, and waits at its start, blinking, for the visitor to write the next line
    function drawTrail(le, A) {
      // (on a phone the phone leaves before the form shows, so the line sets out sooner, while it is still there)
      const pr = ease((le - (NARROW ? 0.16 : 0.33)) / 0.2); if (pr <= 0) return;
      const tg = [$('#jy-f-project'), $('#jy-fopen')].find((e) => e && e.offsetParent !== null && e.getBoundingClientRect().width > 0); if (!tg) return;
      const fr = frame.getBoundingClientRect(), r = tg.getBoundingClientRect(), field = tg.id === 'jy-f-project';
      const P0 = [fr.left + fr.width / 2, fr.top + fr.height / 2], P2 = field ? [r.right, r.bottom - 0.5] : [r.left + 22, r.top - 5], P3 = field ? [r.left, r.bottom - 0.5] : P2;
      const pts = []; let cut = 0;
      if (field) {
        // a curve out from under the phone to the end of the field's line, then along it to where writing starts
        const c1 = [lerp(P0[0], P2[0], 0.25), P0[1] + H * 0.26], c2 = [P2[0] + Math.min(170, W * 0.12), P2[1] + 36];
        for (let i = 0; i <= 60; i++) { const t = i / 60, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3; pts.push([a * P0[0] + b * c1[0] + c * c2[0] + d * P2[0], a * P0[1] + b * c1[1] + c * c2[1] + d * P2[1]]); }
        for (let i = 1; i <= 30; i++) pts.push([lerp(P2[0], P3[0], i / 30), P2[1]]);
      } else {
        // on a phone, where the form opens from a button: out sideways to the margin while the phone is still there
        // (that stretch goes as the words come), down the margin clear of the words, and onto the button
        const X = 12;
        for (let i = 0; i <= 24; i++) pts.push([lerp(P0[0], X, i / 24), P0[1]]);
        cut = pts.length - 1;
        for (let i = 1; i <= 30; i++) pts.push([X, lerp(P0[1], P2[1] - 26, i / 30)]);
        for (let i = 1; i <= 12; i++) { const t = i / 12; pts.push([lerp(X, P2[0], t * t), lerp(P2[1] - 26, P2[1], 1 - (1 - t) * (1 - t))]); }
      }
      const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const end = L[L.length - 1] * pr, headA = field ? 1 : 1 - ease((le - 0.3) / 0.07);
      ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      let tip = pts[0];
      const run = (i0, i1, a) => {
        if (a <= 0 || i1 <= i0 || end <= L[i0]) return; ctx.strokeStyle = `rgba(244,244,252,${0.9 * a * A})`; ctx.beginPath(); ctx.moveTo(pts[i0][0], pts[i0][1]);
        for (let i = i0 + 1; i <= i1; i++) { if (L[i] <= end) { ctx.lineTo(pts[i][0], pts[i][1]); continue; } const f = (end - L[i - 1]) / (L[i] - L[i - 1] || 1); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); break; }
        ctx.stroke();
      };
      run(0, cut || pts.length - 1, cut ? headA : 1); if (cut) run(cut, pts.length - 1, 1);
      for (let i = 1; i < pts.length; i++) { if (L[i] <= end) { tip = pts[i]; continue; } const f = (end - L[i - 1]) / (L[i] - L[i - 1] || 1); tip = [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; break; }
      // the pen tip; once there, it blinks like a caret, until the visitor starts writing
      const writing = form.contains(document.activeElement);
      const al = pr < 1 ? 1 : writing ? 0 : reduce ? 1 : 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(T * 4));
      if (al > 0) { ctx.fillStyle = `rgba(244,244,252,${al * A})`; ctx.beginPath(); ctx.arc(tip[0], tip[1], 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    function showReadout(i) {
      const w = bySlug[items[i].dataset.slug];
      items.forEach((li, j) => li.classList.toggle('cur', j === i));
      $('#jy-ro-i').textContent = String(i + 1).padStart(2, '0');
      $('#jy-ro-c').textContent = w.tracks && w.tracks.length > 1 ? ` · ${w.tracks.length}${LANG === 'en' ? ' ' : ''}${COPY.songs}` : '';
      { const pin = $('#jy-ro-pin'); pin.hidden = !w.pinned; if (w.pinned) pin.textContent = `✦ ${COPY.featuredLabel} ${String(w.pinned).padStart(2, '0')}`; }
      $('#jy-ro-t').textContent = w.title; $('#jy-ro-a').textContent = w.artist;
      $('#jy-ro-m').textContent = [w.type, w.date].filter(Boolean).join(' · ');
      $('#jy-ro-r').textContent = roleLine(w.roles);
      $('#jy-ro-play').hidden = !sourceOf(w);
      const rv = $('#jy-ro-vers'); rv.dataset.slug = w.slug; versionChips(rv, w);
      // on a phone an album's tracks are chips in the card (the cord would cross the swirl)
      const tr = $('#jy-ro-trk'); tr.textContent = '';
      tr.hidden = !(NARROW && w.tracks.length > 1);
      if (!tr.hidden) {
        tr.setAttribute('aria-label', `${w.title} · ${COPY.albumTracks || COPY.tracks}`);
        w.tracks.forEach((t, j) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'jy-rtk'; b.disabled = !t.audio;
          b.innerHTML = '<i></i><span></span>'; b.querySelector('i').textContent = String(j + 1).padStart(2, '0'); b.querySelector('span').textContent = t.title;
          b.addEventListener('click', () => (isPlaying(w.slug, j) ? pause() : play(w, j)));
          tr.appendChild(b);
        });
      }
      sample(w);
      syncReadout();
    }
    function syncReadout() {
      if (recShown < 0) return;
      const w = bySlug[items[recShown].dataset.slug], p = isPlaying(w.slug);
      $('#jy-ro-play').textContent = p ? COPY.pause : COPY.listen;
      $('#jy-ro-play').setAttribute('aria-pressed', String(p));
      $$('#jy-ro-trk .jy-rtk').forEach((b, j) => b.setAttribute('aria-pressed', String(isPlaying(w.slug, j))));
    }
    listeners.add(syncReadout);
    $('#jy-ro-play').addEventListener('click', () => { const w = bySlug[items[recShown].dataset.slug]; if (isPlaying(w.slug)) pause(); else play(w); });
    $('#jy-ro-open').addEventListener('click', (e) => openStory(items[recShown].dataset.slug, e.currentTarget));
    const step = (dir) => {
      let i = recShown;
      for (let n = 0; n < N; n++) { i = clamp(i + dir, 0, N - 1); if (lit(bySlug[items[i].dataset.slug]) || i === 0 || i === N - 1) break; }
      goU(recordU(i));
    };
    $('#jy-ro-prev').addEventListener('click', () => step(-1));
    $('#jy-ro-next').addEventListener('click', () => step(1));
    $('#jy-view').addEventListener('click', (e) => {
      const b = e.currentTarget, list = !recordEl.classList.contains('list');
      recordEl.classList.toggle('list', list); b.setAttribute('aria-pressed', String(list));
      b.textContent = list ? b.dataset.on : b.dataset.off;
      items.forEach((li) => { li.style.transform = ''; li.style.opacity = ''; li.style.visibility = ''; li.style.zIndex = ''; });
      recShown = -1;
    });
    // keyboard: focusing a work flies the current to it
    items.forEach((li, i) => $('.jy-sw-btn', li).addEventListener('focus', () => { if (!recordEl.classList.contains('list') && chapter === 'record') goU(recordU(i)); }));
    function paintRecord() { tintVinyls(); }

    /* ---- the frame loop ---- */
    let npShown = -1;
    function setNowPlaying(i) { const w = pinned[i]; if (!w || i === npShown) return; npShown = i; setOffer(w); }
    function chapterOf(u) { for (const k of Object.keys(CH)) if (u < CH[k][1]) return k; return 'epi'; }
    function syncInert() {
      if (story && !story.hidden) return;
      if (profile.classList.contains('open')) return;
      sections.forEach((s) => { s.inert = s.dataset.ch !== chapter; });
    }
    function frameLoop(now) {
      requestAnimationFrame(frameLoop);
      autoStep(now);
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; if (!reduce) T += dt;
      const u = U();
      const ch = chapterOf(u);
      mprog.style.transform = `scaleX(${clamp(u / TOTAL)})`;
      if (ch !== chapter) { chapter = ch; html.classList.toggle('jy-at-pro', ch === 'pro'); syncInert(); mchap.textContent = COPY.rail[railOf[ch]] || ''; if (ch !== 'record' && sheet === 'filters') setSheet(null); rail.forEach((a) => { if (a.dataset.go === railOf[ch]) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); }); }
      // Prologue: fall into the phone
      const ip = clamp(local(u, 'pro')), cover = Math.max(W / 218, H / 400) * 1.08;
      // the phone grows with the screen: a tablet held upright shows it large, a big monitor too
      const ps = NARROW ? Math.min(1.45, (H * 0.47) / 416, (W - 40) / 234) : clamp((H * 0.5) / 416, 0.85, 1.3);
      phone.style.transform = `translateX(${NARROW ? 0 : -W * 0.14 * (1 - ease(ip / 0.35))}px) scale(${ps * (1 + 0.1 * ease((ip - 0.45) / 0.25)) * Math.pow(cover / (ps * 1.1), ease((ip - 0.7) / 0.3))})`;
      // (glowing as the land lights up in it)
      { const glow = ease((ip - 0.66) / 0.12) * (1 - ease((ip - 0.9) / 0.1)); frontFace.style.boxShadow = glow > 0.01 ? `inset 0 0 0 1.5px var(--tt-silver),inset 0 0 0 3px var(--tt-canvas),0 0 ${(60 * glow).toFixed(0)}px ${(12 * glow).toFixed(0)}px rgba(236,230,255,${(0.85 * glow).toFixed(2)})` : ''; }
      { const turn = 180 * ease(ip / 0.28); card.style.transform = `rotateY(${turn}deg)`;
        // (its hole is 111px right of the middle on the back; turned about the upright axis it comes round to the left)
        if (phoneCharm) phoneCharm.style.translate = `${(Math.cos((turn * Math.PI) / 180) - 1) * 111}px 0`; }
      phone.style.visibility = ip >= 1 ? 'hidden' : 'visible';
      phone.tabIndex = ip > 0.3 ? -1 : 0;
      screen.style.background = ip > 0.86 ? `rgb(${Math.round(lerp(20, 254, ease((ip - 0.86) / 0.1)))},${Math.round(lerp(28, 254, ease((ip - 0.86) / 0.1)))},${Math.round(lerp(48, 254, ease((ip - 0.86) / 0.1)))})` : '';
      lead.style.opacity = String(1 - ease(ip * 3)); lead.style.visibility = ip > 0.34 ? 'hidden' : 'visible';
      // (the film fades as the screen turns to paper, and rests once the phone is gone)
      if (lockVid && document.readyState === 'complete' && !document.hidden) lockVidPlay(ip < 0.43);
      drawEnter(ip);
      // Tale to Music: the pen moves forward through the world; the camera follows a few steps behind
      const lt = local(u, 'tale'), lc = local(u, 'case'), lm = local(u, 'music');
      penZ = penAt(u);
      // the camera rides the line behind the pen, turning up and down with it (see rig)
      { const cam = rig(penZ, worldOf(penZ)); if (ip < 1) cam.z = lerp(-2.6, cam.z, ease(ip)); setCam(cam); }
      // while a phone between worlds is on screen, the conversation steps aside for it
      { const pp = Math.max(clamp((penZ - (ZS - PH.land * 0.8)) / 0.3) * (penZ < ZS + 0.6 ? 1 : 0), clamp((penZ - (S0 - PH.sea * 0.8)) / 0.3) * (penZ < S0 + 0.8 ? 1 : 0));
        if ((pp > 0.5) !== passing) { passing = pp > 0.5; html.classList.toggle('jy-passing', passing); } }
      placeAnchors();
      // how dark the scene is: the deep sea, then the night sky, until the record
      spaceDark = Math.max(spaceIn(), penZ >= ZS ? clamp((depthK() - 0.4) / 0.3) : 0) * spaceFade();
      { const m = (c0, c1) => Math.round(lerp(c0, c1, spaceDark)); lineRGB = `${m(20, 244)},${m(28, 244)},${m(48, 252)}`; }
      const caseWork = CASE && bySlug[CASE];
      if (caseWork) { if (lc > 0.04 && lc < 1) { setOffer(caseWork); caseOffer = true; } else if (caseOffer) { caseOffer = false; setOffer(null); } }
      // Record: the dive into the current
      const lr = local(u, 'record'), ld = local(u, 'done'), le = local(u, 'epi');
      const inRecord = lr > 0 && lr < 1;
      on(recordEl, inRecord); on($('#jy-filters'), lr > 0.1 && lr < 0.93); on(fbtn, lr > 0.1 && lr < 0.93); on($('#jy-tabs'), lr > 0.1 && lr < 0.93); on(readout, lr > (NARROW ? 0.06 : 0.004) && lr < 0.93); // (on a phone it shares the bottom with the words on arriving, so it waits for them)
      on($('#jy-found'), (lm > 0.88 && lm < 1.1 && lr <= 0) || (lr > 0 && lr < 0.06)); on($('#jy-hint'), lr > 0.05 && lr < 0.18);
      if (inRecord) { recK = clamp((lr - 0.1) / 0.82) * (N - 1); placeCurrent(lr); }
      else if (spiral.style.opacity !== '0') { spiral.style.opacity = '0'; Object.values(trackEls).forEach((box) => box.classList.remove('on')); albumOpen = -1; }
      // Done: out of the current, the phone is seen from outside, the record in it
      const ink = le > 0 || spaceDark > 0.5;
      stageEl.classList.toggle('ink', ink); html.classList.toggle('jy-ink', ink);
      markImg.src = ink ? markImg.dataset.paper : markImg.dataset.ink;
      // the letter stays while the empty seat is said under it, as one thread; both give way to the inquiry
      const letterEl = $('#jy-letter'), emptyEl = $('#jy-empty'), both = le > 0.05 && le < 0.3;
      on(letterEl, (ld > 0.1 && le <= 0) || (le > 0 && le < 0.3)); on(emptyEl, both);
      letterEl.classList.toggle('up', both); if (both) letterEl.style.setProperty('--up', `${-(emptyEl.offsetHeight + 10)}px`);
      if (lr > 0.8 && !recBuilt) buildRecordWash();
      // the phone (416px with its charm below) keeps inside short screens
      // (on a phone smaller and higher, so the letter and the empty seat fit under it)
      const RR = Math.min(W, H) * 0.34, FS = NARROW ? Math.min(1, (H * 0.48) / 486) : Math.min(1, (H - 110) / 486);
      if (ld > 0 && le <= 0) {
        const s0 = (2 * RR) / 192, s = lerp(s0, FS, ease(ld / 0.7));
        frame.style.opacity = String(ease(ld / 0.25)); frame.style.transform = `scale(${s})`; frame.style.left = '50%'; frame.style.top = NARROW ? lerp(50, 40, ease(ld / 0.7)) + '%' : '50%';
        const chrome = ld >= 0.35; frame.style.background = chrome ? '' : 'transparent'; frame.style.boxShadow = chrome ? '' : 'none'; frameScr.style.background = chrome ? '' : 'transparent';
      } else if (le > 0) {
        frame.style.opacity = NARROW ? String(1 - ease((le - 0.22) / 0.12)) : '1'; frame.style.transform = `scale(${NARROW ? FS : lerp(FS, Math.min(1.25, (H - 70) / 486), ease(le / 0.3))})`; frame.style.left = NARROW ? '50%' : '72%'; frame.style.top = NARROW ? '40%' : '50%';
        frame.style.background = ''; frame.style.boxShadow = ''; frameScr.style.background = '';
      } else frame.style.opacity = '0';
      // Epilogue
      on($('#jy-contact'), le > 0.32);

      // ---- canvas ----
      ctx.clearRect(0, 0, W, H);
      if (inRecord) drawCurrent(lr);
      else if (ld > 0 && ld < 0.4) { const fr = frame.getBoundingClientRect(); drawGroove(ld, fr.width / 234 / ((2 * RR) / 192), fr.left + fr.width / 2, fr.top + fr.height / 2); }
      grooveSpin = ld > 0 && ld < 1 ? grooveSpin + dt * 0.9 : 0;
      if (le > 0.15) drawTrail(le, 1);
      const worldA = (ip > 0.8 ? ease((ip - 0.8) / 0.2) : 0) * (1 - ease(lr / 0.06));
      if (worldA > 0) drawWorld(worldA);
    }
    function resize() {
      W = innerWidth; H = innerHeight; NARROW = W < 761 || H > W * 1.05; HZ = NARROW ? 0.38 : 0.46;
      html.classList.toggle('jy-narrow', NARROW);
      DPR = Math.min(NARROW ? 1.75 : 2, devicePixelRatio || 1);
      cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildWorld(); buildCurrent(); ANCHORS.forEach((a) => { a.w = 0; }); recShown = -1; cloud = null;
    }
    addEventListener('resize', resize);
    // the phone (its 접속) plays the entering scene from wherever the visitor is in the prologue (turning it over first)
    phone.addEventListener('click', () => { const u = U(); if (u > ENTER[1] - 0.01) return; if (u < 0.3) playScene([0, ENTER[1], 0, 0, [[0.33, 700, 150], ...ENTER[4]]], u); else playScene(ENTER, u); });

    // sample every cover once the record is near, so its wash can mix them
    let sampledAll = false;
    addEventListener('scroll', () => { if (!sampledAll && U() > CH.music[0]) { sampledAll = true; paintRecord(); } }, { passive: true });

    function reset() { recBuilt = false; $('#jy-charm-cd').style.background = ''; }
    const at = (c, f) => CH[c][0] + (CH[c][1] - CH[c][0]) * f;
    // each chapter opens where its first words are
    const target = { pro: 0, tale: uOfPen(SET.land[0] + 0.01), tone: uOfPen(SET.sea[0] + 0.1), record: recordU(0), epi: CH.epi[0] + 0.55 };
    // a jump to the next chapter glides; across two or more it goes at once, without drawing everything between
    const RAIL = ['pro', 'tale', 'tone', 'record', 'epi'];
    function goStage(where, smooth = true) {
      const to = target[where] != null ? target[where] : 0;
      const far = Math.abs(RAIL.indexOf(railOf[chapterOf(U())]) - RAIL.indexOf(railOf[chapterOf(to)])) >= 2;
      goU(to, smooth && !far);
    }
    resize();
    requestAnimationFrame(frameLoop);
    // pick a record: bring it to the front of the staff (a glide when near, at once when far) and show its card
    function pick(slug) {
      const i = items.findIndex((li) => li.dataset.slug === slug); if (i < 0) return;
      goU(recordU(i), !recordEl.classList.contains('list') && Math.abs(i - recK) < 6);
    }
    return { paintRecord, reset, syncInert, go: goStage, recordU, goU, items, hold: holdStory, pick };
  })();

  /* ---------------- where the visitor came in ---------------- */
  applyFilter();
  const route = body.dataset.route || '/';
  const params = new URLSearchParams(location.search);
  const want = params.get('work');
  const first = { '/about/': 'tale', '/approach/': 'tone', '/discography/': 'record', '/contact/': 'epi' }[route];
  requestAnimationFrame(() => {
    if (first && STAGE) stage.go(first, false);
    else if (first) go(first);
    if (want && bySlug[want]) {
      if (STAGE) { const i = stage.items.findIndex((li) => li.dataset.slug === want); if (i >= 0) stage.goU(stage.recordU(i), false); }
      else { const el = document.querySelector(`.jy-sw[data-slug="${want}"]`); if (el) el.scrollIntoView(); }
      setTimeout(() => openStory(want), 300);
    }
  });
})();
