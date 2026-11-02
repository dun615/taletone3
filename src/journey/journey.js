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
  const COPY = DATA.copy, WORKS = DATA.works;
  const DOTS = { wide: 900, narrow: 420 };          // Tale: the dot field
  const TURN_POINTS = { wide: 2600, narrow: 1500 }; // Music: points that become the groove
  const CH = { pro: [0, 1], tale: [1, 2.4], tone: [2.4, 4.8], case: [4.8, 6.2], music: [6.2, 8.6], record: [8.6, 12.6], done: [12.6, 13.5], epi: [13.5, 14.5] };
  const TOTAL = 14.5;
  const FLOW_DOTS = { wide: 260, narrow: 120 };    // Record: specks drifting along the current
  const INK = '20,28,48';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement, body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wideQuery = matchMedia('(min-width: 761px)');
  const STAGE = wideQuery.matches;
  const LANG = body.dataset.lang || 'kr';
  const BASE = body.dataset.base || '/preview';
  const ASSET = body.dataset.assets || '/';
  const bySlug = Object.fromEntries(WORKS.map((w) => [w.slug, w]));
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const local = (u, c) => (u - CH[c][0]) / (CH[c][1] - CH[c][0]);
  const on = (el, v) => el && el.classList.toggle('on', !!v);

  if (STAGE) html.classList.add('jy-stage-mode');
  // crossing the breakpoint changes the whole layout; start again in the right one
  wideQuery.addEventListener('change', () => location.reload());

  /* ---------------- audio ---------------- */
  const audio = new Audio();
  audio.preload = 'none';
  let nowSlug = null, nowTrack = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  const versionLang = { kr: 'KR', en: 'EN', jp: 'JP' }[LANG];
  function sourceOf(w, track) {
    if (track != null && w.tracks[track] && w.tracks[track].audio) return w.tracks[track];
    const v = (w.versions || []).find((x) => x.language === versionLang);
    if (v) return v;
    if (w.tracks && w.tracks.length > 1) { const t = w.tracks[w.titleTrack] && w.tracks[w.titleTrack].audio ? w.tracks[w.titleTrack] : w.tracks.find((x) => x.audio); if (t && !w.audio) return t; }
    return w.audio ? { audio: w.audio, gain: w.gain } : null;
  }
  function play(w, track) {
    const src = sourceOf(w, track);
    if (!src) return;
    const url = ASSET + src.audio;
    if (!audio.src.endsWith(url)) { audio.src = url; }
    audio.volume = Math.min(1, Math.pow(10, (src.gain || 0) / 20));
    nowSlug = w.slug; nowTrack = track == null ? null : track;
    audio.play().catch(() => {});
    emit();
  }
  function pause() { audio.pause(); emit(); }
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
  function openStory(slug, from) {
    const w = bySlug[slug];
    if (!w) return;
    storyWork = w; storyReturn = from || document.activeElement;
    ['jy-s-bg', 'jy-s-v'].forEach((id) => { $('#' + id).src = ASSET + w.thumb; });
    const art = $('#jy-s-a'); art.src = ASSET + w.image; art.alt = w.title;
    $('#jy-s-title').textContent = w.title;
    $('#jy-s-meta').textContent = [w.artist, w.type, w.date].filter(Boolean).join(' · ');
    $('#jy-s-desc').textContent = w.description || '';
    $('#jy-s-roles').textContent = roleLine(w.roles);
    const tracks = $('#jy-s-tracks'); tracks.innerHTML = '';
    if (w.tracks && w.tracks.length > 1) {
      w.tracks.forEach((t, i) => {
        const li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.disabled = !t.audio; b.dataset.track = i; b.setAttribute('aria-pressed', 'false');
        b.innerHTML = '<i></i><span></span>'; b.firstChild.textContent = String(i + 1).padStart(2, '0'); b.lastChild.textContent = t.title;
        b.addEventListener('click', () => (isPlaying(w.slug, i) ? pause() : play(w, i)));
        li.appendChild(b); tracks.appendChild(li);
      });
    }
    tracks.hidden = !tracks.children.length;
    $('#jy-s-credits').textContent = w.credits || '';
    $('#jy-s-cr').hidden = !w.credits; $('#jy-s-cr').open = false;
    const yt = $('#jy-s-yt'); yt.href = w.youtube || '#'; yt.parentNode.hidden = !w.youtube;
    playBtn.hidden = !sourceOf(w);
    story.hidden = false;
    outside().forEach((el) => { el.inert = true; });
    requestAnimationFrame(() => story.classList.add('open'));
    untrapStory = trap(storyBox, closeStory);
    $('#jy-s-close').focus();
    syncStory();
  }
  function closeStory() {
    if (story.hidden) return;
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
    if (b && !story.contains(b)) openStory(b.dataset.open, b);
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

  /* ---------------- menu ---------------- */
  const menuBtn = $('.jy-menu-btn'), menu = $('#jy-menu');
  function setMenu(open) { menuBtn.setAttribute('aria-expanded', String(open)); menu.classList.toggle('open', open); }
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('click', (e) => { if (!menu.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });
  $$('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); setMenu(false);
    try { history.replaceState(null, '', a.getAttribute('href')); } catch (_) {}
    go(a.dataset.go, a);
  }));
  $('.jy-mark').addEventListener('click', (e) => { e.preventDefault(); try { history.replaceState(null, '', BASE + '/'); } catch (_) {} go('pro'); });

  $$('[data-profile]').forEach((b) => b.addEventListener('click', () => openProfile(b)));
  /* ---------------- discography filters: they light works, they never hide them ---------------- */
  const filter = { field: 'all', role: 'all' };
  const lit = (w) => (filter.field === 'all' || w.field === filter.field) && (filter.role === 'all' || (w.roles || []).includes(filter.role));
  function applyFilter() {
    $$('.jy-fchip[data-field]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.field === filter.field)));
    $$('.jy-fchip[data-role]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === filter.role)));
    $$('.jy-sw').forEach((li) => li.classList.toggle('dim', !lit(bySlug[li.dataset.slug])));
    if (STAGE) stage.paintRecord();
  }
  $$('.jy-fchip').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.field) filter.field = b.dataset.field; else filter.role = b.dataset.role;
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
      rec.classList.add('lit'); on(banner, true); say(STAGE ? '' : COPY.received);
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
  function go(where, from) {
    if (where === 'profile') { openProfile(from); return; }
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
    track.style.setProperty('--track', (TOTAL * 100 + 100) + 'vh');
    const sections = $$('.jy-ch');
    const phone = $('#jy-phone'), card = $('#jy-card'), screen = $('#jy-screen'), lead = $('#jy-lead'), lock = $('#jy-lock');
    const frame = $('#jy-frame'), frameScr = $('.jy-scr', frame);
    const markImg = $('.jy-mark img');
    const recordEl = $('#jy-record'), spiral = $('#jy-spiral'), readout = $('#jy-readout');
    const items = $$('.jy-sw', spiral);
    const N = items.length;
    let W = 0, H = 0, DPR = 1, T = 0, last = 0;
    let palette = [];
    let chapter = '', caseOffer = false, recBuilt = false;
    const CASE = ($('.jy-case-btn') || {}).dataset ? $('.jy-case-btn').dataset.open : null;
    const rail = $$('.jy-rail a'), railOf = { pro: 'pro', tale: 'tale', tone: 'tone', case: 'tone', music: 'tone', record: 'record', done: 'record', epi: 'epi' };

    const U = () => { const m = document.documentElement.scrollHeight - innerHeight; return m > 0 ? (scrollY / m) * TOTAL : 0; };
    const topFor = (u) => (u / TOTAL) * (document.documentElement.scrollHeight - innerHeight);
    const goU = (u, smooth = true) => scrollTo({ top: topFor(u), behavior: smooth && !reduce ? 'smooth' : 'auto' });

    // clock on the lock screen
    { const d = new Date(), loc = { kr: 'ko-KR', en: 'en-US', jp: 'ja-JP' }[LANG];
      $('#jy-clock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      try { $('#jy-date').textContent = d.toLocaleDateString(loc, { month: 'long', day: 'numeric', weekday: 'long' }); } catch (_) {} }

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
    const PEN = { tale: [2, 10], tone: [10, 26.5], case: [26.5, 37], music: [37, 49] };
    const GATES = [PEN.tone[0], PEN.case[0]];
    const WIRE = [2.8, 10.4], POLE = 3, GROUND = 1.35, SURF = 0.95, DEEP = 2.7, BED = 4.4, AHEAD = 4.2, FAR3 = 26, TAIL = 46.5;
    const PASTEL = { land: { sky: [214, 233, 246], hill: [[190, 222, 199], [214, 230, 186], [200, 214, 236]], grass: [140, 190, 150], pole: [196, 170, 150], cloud: [250, 226, 236] },
      sea: { water: [204, 236, 238], kelp: [150, 206, 182], bubble: [168, 214, 236], surf: [150, 200, 214] },
      space: { sky: [226, 220, 245], star: [[252, 232, 170], [246, 196, 222], [196, 214, 250]] } };
    const tint = (c, k, a) => `rgba(${Math.round(lerp(150, c[0], k))},${Math.round(lerp(152, c[1], k))},${Math.round(lerp(160, c[2], k))},${a})`;
    const passed = (z, lag = 0.4) => ease(clamp((penZ - z - lag) / 2.6)); // 0 pale, 1 fully coloured
    const penAt = (u) => { for (const k of ['music', 'case', 'tone', 'tale']) { const l = local(u, k); if (l > 0) return lerp(PEN[k][0], PEN[k][1], clamp(k === 'tale' ? (l - 0.08) / 0.92 : l)); } return PEN.tale[0]; };
    const wireW = (z) => clamp((z - WIRE[0] + 0.8) / 0.8) * clamp((WIRE[1] + 0.8 - z) / 0.8);
    // the end of the constellation: the line leaves the last star for the head of the staff (set in buildCurrent),
    // where it splits in five and draws the record's staff
    const tailK = (z) => ease((z - TAIL) / (PEN.music[1] - TAIL));
    // tail.T: the staff's head on screen, tail.tg: the way the staff leaves it (both from the final camera)
    let tail = { T: [0, 0], tg: [1, 0], L: 0 };
    function tailAt(z) {
      const cz = PEN.music[1] - AHEAD, s = clamp((z - TAIL) / (PEN.music[1] - TAIL)), d = Math.max(0.2, z - cz) / F3;
      return [(tail.T[0] - tail.tg[0] * tail.L * (1 - s) - W / 2) * d, (tail.T[1] - tail.tg[1] * tail.L * (1 - s) - H * 0.46) * d];
    }
    // the constellation: stars at fixed points, the line runs straight from one to the next
    const STARS = (() => { let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); const out = []; for (let z = GATES[1] + 1.2; z < 50; z += 1.5 + r() * 0.5) out.push([-0.4 + (r() - 0.5) * 1.6, -0.55 + (r() - 0.5) * 1.1, z]); return out; })();
    function constAt(z) {
      if (z <= STARS[0][2]) return STARS[0];
      for (let i = 1; i < STARS.length; i++) if (z <= STARS[i][2]) { const a = STARS[i - 1], b = STARS[i], f = (z - a[2]) / (b[2] - a[2]); return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), z]; }
      return STARS[STARS.length - 1];
    }
    function pathAt(z) {
      let x = -0.35 + 0.5 * Math.sin(z * 0.33) + 0.15 * Math.sin(z * 0.91 + 1.2), y = 0.35 + 0.16 * Math.sin(z * 0.47);
      const ww = wireW(z);
      if (ww > 0) { let f = ((z - WIRE[0]) / POLE) % 1; if (f < 0) f += 1; y = lerp(y, -0.55 + 0.32 * 4 * f * (1 - f), ww); }
      // the sea: the line dives in like a fishing line, then swims along under the surface
      const sk = ease((z - GATES[0]) / 2.4) * (1 - ease((z - GATES[1] + 0.4) / 2.2));
      if (sk > 0) y = lerp(y, DEEP + 0.2 * Math.sin(z * 0.6), sk);
      // space: from star to star
      const ck2 = ease((z - GATES[1] + 0.4) / 2.2);
      if (ck2 > 0) { const c = constAt(z); x = lerp(x, c[0], ck2); y = lerp(y, c[1], ck2); }
      // aimed in screen terms: from the last star the line swings onto the way the staff leaves, and comes in along it
      const tk = ease((z - TAIL) / 2.1);
      if (tk > 0) { const t2 = tailAt(z); x = lerp(x, t2[0], tk); y = lerp(y, t2[1], tk); }
      return [x, y, z];
    }
    let penZ = PEN.tale[0], camX = 0, camY = 0, camZ = -1, F3 = 800;
    const V = (p) => { const dz = p[2] - camZ; if (dz < 0.12) return null; const s3 = F3 / dz; return [W / 2 + (p[0] - camX) * s3, H * 0.46 + (p[1] - camY) * s3, dz]; };
    const fogA = (dz) => clamp((FAR3 - dz) / 8) * clamp((dz - 0.15) / 0.5);

    let ridges = [], clouds = [], grass = [], poles = [], kelp = [], bubbles = [], stars = [], surf = [], nebulae = [], milky = [], bodies = [];
    let spaceDark = 0, lineRGB = INK;
    const dots = [];
    function buildWorld() {
      F3 = Math.min(W, H * 1.6) * 0.62;
      let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const [G1, G2] = GATES;
      ridges = [];
      for (let k = 0, z = 2.2; z < G1 + 3; k++, z += 1.8 + rnd() * 1.2) {
        const amp = 0.35 + rnd() * 0.55 + (k % 4 === 3 ? 0.45 : 0), f1 = 0.5 + rnd() * 0.7, f2 = 1.4 + rnd(), p1 = rnd() * 6, p2 = rnd() * 6, pts = [];
        for (let x = -8; x <= 8.001; x += 0.2) pts.push([x, GROUND - amp * (0.55 + 0.45 * Math.sin(x * f1 + p1)) * (0.7 + 0.3 * Math.sin(x * f2 + p2)), z]);
        ridges.push({ z, k, pts });
      }
      ridges.sort((a, b) => b.z - a.z);
      grass = [];
      for (let z = 1.2; z < G1 - 0.3; z += 0.14 + rnd() * 0.18) { const cx = pathAt(z)[0] + (rnd() - 0.5) * 4.2; for (let q = 0; q < 3; q++) grass.push({ x: cx + q * 0.03, z, h: (q === 1 ? 0.09 : 0.05) + rnd() * 0.06, lean: (q - 1) * 0.02 + (rnd() - 0.5) * 0.015 }); }
      poles = [];
      for (let z = WIRE[0]; z <= WIRE[1] - 1.2; z += POLE) poles.push(z);
      clouds = [];
      for (let z = 3; z < G1 + 3; z += 3 + rnd() * 3) {
        const X = (rnd() - 0.5) * 7, Y = -2.1 + rnd() * 0.6, wd = 0.9 + rnd() * 0.9, pts = [], bx = [[-0.36, 0.13], [-0.18, 0.22], [0.04, 0.3], [0.25, 0.22], [0.4, 0.12]];
        for (let j = 0; j <= 40; j++) { const x = -0.5 + j / 40; let top = 0; for (const [b2, r] of bx) { const d = x - b2; if (Math.abs(d) < r) top = Math.max(top, Math.sqrt(r * r - d * d)); } pts.push([X + x * wd, Y - top * wd * 1.05, z]); }
        for (let j = 1; j <= 10; j++) pts.push([X + (0.5 - j / 10) * wd, Y + Math.sin((j / 10) * Math.PI) * 0.03, z]);
        clouds.push({ z, pts, ci: clouds.length });
      }
      surf = [];
      for (let z = G1 + 0.4; z < G2 - 0.5; z += 1.3) surf.push({ z, ph: rnd() * 6 });
      kelp = [];
      for (let z = G1 + 1; z < G2 - 1; z += 0.5 + rnd() * 0.6) kelp.push({ x: pathAt(z)[0] + (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 2.6), z, h: 1.2 + rnd() * 1.4, ph: rnd() * 6 });
      bubbles = [];
      for (let i = 0; i < 90; i++) { const z = G1 + 1 + rnd() * (G2 - G1 - 2); bubbles.push({ x: pathAt(z)[0] + (rnd() - 0.5) * 3.5, z, r: 0.02 + rnd() * 0.045, off: rnd() }); }
      nebulae = [[G2 + 6, -2.2, -1.2, 2.6, [246, 196, 222]], [G2 + 10, 2.4, -0.4, 3.0, [200, 190, 246]], [G2 + 15, -1.0, 0.9, 3.4, [180, 226, 236]], [G2 + 19, 2.0, -1.6, 2.8, [252, 224, 200]]].map(([z, x, y, r, c]) => ({ z, x, y, r, c }));
      milky = [];
      for (let i = 0; i < 520; i++) { const t = rnd(), sp = (rnd() + rnd() + rnd() - 1.5) * 0.9; milky.push({ x: -9 + t * 18, y: -3.2 + t * 2.6 + sp, z: G2 + 22 + rnd() * 6, s: rnd() }); }
      bodies = [{ kind: 'ring', z: G2 + 7.5, x: 2.3, y: -1.5, r: 0.55, c: [214, 200, 246], c2: [246, 206, 226] }, { kind: 'moon', z: G2 + 12, x: -2.6, y: -1.9, r: 0.42, c: [252, 238, 196] }, { kind: 'ring', z: G2 + 16.5, x: -2.0, y: 0.9, r: 0.32, c: [186, 226, 236], c2: [252, 232, 170] }];
      stars = [];
      for (let i = 0; i < 300; i++) stars.push({ x: (rnd() - 0.5) * 12, y: -3.4 + rnd() * 5.2, z: G2 - 1 + rnd() * 26, s: rnd(), sparkle: rnd() < 0.14, c: (rnd() * 3) | 0 });
    }

    // messages written along the line: [selector, z on the line, side (1 right, -1 left, 0 hanging, 0.5 a note on the line)]
    const ANCHORS = [
      ['#jy-hello', 3.6, 1], ['#jy-pcard', 5.4, -1], ['#jy-types', 7.2, 1], ['#jy-clients', 9.0, -1],
      ['#jy-creed', 14.6, 1], ['#jy-step-0', 16.5, 0], ['#jy-step-1', 19.5, 0], ['#jy-step-2', 22.5, 0],
      ['#jy-case-req', 31, 1], ['#jy-case-m0', 32.6, 0.5], ['#jy-case-m1', 34.2, -0.5], ['#jy-case-ans', 35.8, -1],
    ].map(([sel, z, side]) => ({ el: $(sel), z, side, w: 0, h: 0 })).filter((a) => a.el);
    ANCHORS.forEach((a) => a.el.setAttribute('data-anchor', ''));
    const swellZ = ANCHORS.filter((a) => a.side === 0 || Math.abs(a.side) === 0.5).map((a) => a.z);
    ANCHORS.sort((a, b) => a.z - b.z);
    // the messages of one chapter make one thread: each stays once written, the newest at the bottom of the
    // reading spot and the older ones above it, quieter; a new chapter starts a new thread. What shows depends
    // only on where the pen is, and the arrival itself is a short timed animation, so a quick scroll loses nothing.
    const groupOf = (z) => (z < PEN.tone[0] ? 0 : z < PEN.case[0] ? 1 : z < PEN.music[0] ? 2 : 3);
    let leadOf = null;
    function placeAnchors() {
      const slotX = W * 0.58, bottom = H * 0.64;

      let latest = -1;
      ANCHORS.forEach((a, i) => { if (penZ >= a.z) latest = i; });
      const g = latest >= 0 ? groupOf(ANCHORS[latest].z) : -1, gone = latest >= 0 && penZ > ANCHORS[latest].z + 4.5;
      // a tall thread sits lower so its first message stays on screen
      const stack = ANCHORS.reduce((t, a, i) => t + (!gone && i <= latest && groupOf(a.z) === g ? (a.h || a.el.offsetHeight) + 10 : 0), 0);
      let y = Math.min(H - 28, Math.max(bottom, stack + 84));
      leadOf = null;
      for (let i = ANCHORS.length - 1; i >= 0; i--) {
        const a = ANCHORS[i], shown = !gone && i <= latest && groupOf(a.z) === g;
        if (!a.w) { a.w = a.el.offsetWidth; a.h = a.el.offsetHeight; }
        a.el.classList.toggle('on', shown);
        a.el.classList.toggle('older', shown && i !== latest);
        // a hidden message waits just under the spot it will take, so it rises a short way when it arrives
        if (!shown) { a.el.style.setProperty('--aa', '0'); a.el.style.setProperty('--ax', slotX.toFixed(1) + 'px'); a.el.style.setProperty('--ay', (bottom - a.h + 18).toFixed(1) + 'px'); a.el.style.setProperty('--as', '1'); continue; }
        y -= a.h;
        a.el.style.setProperty('--aa', i === latest ? '1' : spaceDark > 0.5 ? '0.88' : '0.62');
        a.el.style.setProperty('--ax', slotX.toFixed(1) + 'px'); a.el.style.setProperty('--ay', y.toFixed(1) + 'px'); a.el.style.setProperty('--as', '1');
        if (i === latest) leadOf = { a, A: 1, x: slotX, y: y + Math.min(a.h / 2, 40) };
        y -= 10;
      }
    }
    // resting points: scrolling stops on a message rather than between two
    const zToU = (z) => { for (const k of ['tale', 'tone', 'case', 'music']) { const [z0, z1] = PEN[k]; if (z >= z0 && z <= z1) { let l = (z - z0) / (z1 - z0); if (k === 'tale') l = 0.08 + 0.92 * l; return CH[k][0] + l * (CH[k][1] - CH[k][0]); } } return 0; };
    const snaps = [...ANCHORS.map((a) => a.z + 0.45), ...GATES.map((g) => g + 0.8)].map((z) => { const d = document.createElement('div'); d.className = 'jy-snap'; track.appendChild(d); return { d, u: zToU(z) }; });
    function placeSnaps() { const m = document.documentElement.scrollHeight - innerHeight; snaps.forEach((sp) => { sp.d.style.top = ((sp.u / TOTAL) * m).toFixed(0) + 'px'; }); }
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
    // through a gate's screen, the next world is already there: the sea under its surface, or the night sky
    function previewWorld(gi, cx, cy, w, h, r, a) {
      if (a <= 0.02 || w < 8) return;
      const x0 = cx - w / 2, y0 = cy - h / 2;
      ctx.save(); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y0, w, h, r); else ctx.rect(x0, y0, w, h); ctx.clip();
      const t = reduce ? 0 : T, U2 = (fx, fy) => [x0 + fx * w, y0 + fy * h];
      if (gi === 0) {
        const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, `rgba(214,240,242,${a})`); g.addColorStop(1, `rgba(178,224,230,${a})`); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
        ctx.strokeStyle = `rgba(120,186,200,${0.8 * a})`; ctx.lineWidth = Math.max(1, w * 0.012);
        for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i <= 24; i++) { const [px, py] = U2(i / 24, 0.08 + k * 0.05 + 0.012 * Math.sin(i * 0.9 + t * 1.2 + k)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
        ctx.strokeStyle = `rgba(120,190,160,${0.85 * a})`; ctx.lineWidth = Math.max(1.5, w * 0.03);
        for (const [fx, fh, ph] of [[0.18, 0.5, 0], [0.32, 0.34, 1.3], [0.7, 0.58, 2.1], [0.84, 0.4, 0.7]]) { ctx.beginPath(); for (let i = 0; i <= 14; i++) { const tt = i / 14, [px, py] = U2(fx + Math.sin(tt * 5 + ph + t * 1.1) * 0.03 * tt, 1 - fh * tt); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
        ctx.strokeStyle = `rgba(140,196,224,${0.9 * a})`; ctx.lineWidth = 1;
        for (let i = 0; i < 9; i++) { const rise = ((i * 0.37 + t * 0.07) % 1), [px, py] = U2(0.2 + ((i * 0.53) % 0.6), 0.95 - rise * 0.8); ctx.beginPath(); ctx.arc(px, py, w * (0.015 + (i % 3) * 0.008), 0, Math.PI * 2); ctx.stroke(); }
      } else {
        const g = ctx.createLinearGradient(x0, y0, x0 + w * 0.4, y0 + h); g.addColorStop(0, `rgba(18,22,44,${a})`); g.addColorStop(1, `rgba(44,36,80,${a})`); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
        for (const [fx, fy, fr, c] of [[0.3, 0.35, 0.45, '246,196,222'], [0.72, 0.62, 0.5, '200,190,246'], [0.4, 0.82, 0.4, '180,226,236']]) { const [px, py] = U2(fx, fy), R = fr * w, gr = ctx.createRadialGradient(px, py, 0, px, py, R); gr.addColorStop(0, `rgba(${c},${0.35 * a})`); gr.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gr; ctx.fillRect(px - R, py - R, 2 * R, 2 * R); }
        for (let i = 0; i < 46; i++) { const [px, py] = U2(((i * 0.618) % 1), ((i * 0.377 + 0.05) % 1)); ctx.fillStyle = `rgba(236,238,252,${a * (0.45 + 0.4 * Math.sin(t * 2 + i))})`; const rr = i % 7 === 0 ? 2.2 : 1.2; ctx.fillRect(px, py, rr, rr); }
        const [mx, my] = U2(0.68, 0.2), mr = w * 0.12; ctx.fillStyle = `rgba(252,238,196,${a})`; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(22,25,50,${a})`; ctx.beginPath(); ctx.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.92, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    function drawWorld(A, lm, now) {
      const land = A;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const near = (z, far = FAR3) => { const dz = z - camZ; return dz > 0.3 && dz < far; };
      const [G1, G2] = GATES;
      // the backdrop of the world the visitor is in, coloured as far as the pen has gone
      const wIn = (a, b) => clamp((camZ + 2 - a) / 2) * (1 - clamp((camZ + 2 - b) / 2));
      const wl = wIn(-10, G1), ws = wIn(G1, G2), wp = wIn(G2, 80);
      if (wl > 0) { const k = passed(2, 0) * wl, g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, tint(PASTEL.land.sky, 1, 0.75 * k * land)); g.addColorStop(0.6, tint(PASTEL.land.sky, 1, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      if (ws > 0) { const k = passed(G1, 0.5) * ws; ctx.fillStyle = tint(PASTEL.sea.water, 1, 0.8 * k * land); ctx.fillRect(0, 0, W, H); }
      if (spaceDark > 0) {
        // night: deep indigo, nebulae of pastel light, the milky way far behind
        const d = spaceDark * land, g = ctx.createLinearGradient(0, 0, W * 0.3, H);
        g.addColorStop(0, `rgba(18,22,44,${d})`); g.addColorStop(1, `rgba(40,34,74,${d})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (const nb of nebulae) {
          const q = V([nb.x, nb.y, nb.z]); if (!q || q[2] > FAR3 + 8) continue;
          const R = nb.r * F3 / q[2], k = 0.25 + 0.75 * passed(nb.z - 6), gr = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R);
          gr.addColorStop(0, `rgba(${nb.c},${0.32 * k * d})`); gr.addColorStop(0.5, `rgba(${nb.c},${0.12 * k * d})`); gr.addColorStop(1, `rgba(${nb.c},0)`);
          ctx.fillStyle = gr; ctx.fillRect(q[0] - R, q[1] - R, 2 * R, 2 * R);
        }
        for (const m of milky) { const q = V([m.x, m.y, m.z]); if (!q) continue; ctx.fillStyle = `rgba(230,232,250,${(0.25 + 0.5 * m.s) * d * (reduce ? 0.8 : 0.75 + 0.25 * Math.sin(T * 2 + m.s * 40))})`; ctx.fillRect(q[0], q[1], 1.2, 1.2); }
        for (const b of bodies) {
          const q = V([b.x, b.y, b.z]); if (!q || q[2] < 0.6 || q[2] > FAR3) continue;
          const R = b.r * F3 / q[2], k = passed(b.z - 4), a = d * fogA(q[2]) * clamp((penZ - (b.z - 12)) / 2);
          ctx.fillStyle = tint(b.c, k, 0.95 * a); ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, Math.PI * 2); ctx.fill();
          if (b.kind === 'moon') { ctx.fillStyle = `rgba(22,25,50,${a})`; ctx.beginPath(); ctx.arc(q[0] + R * 0.42, q[1] - R * 0.18, R * 0.92, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(-0.38); ctx.strokeStyle = tint(b.c2, k, 0.9 * a); ctx.lineWidth = Math.max(1.5, R * 0.12); ctx.beginPath(); ctx.ellipse(0, 0, R * 1.9, R * 0.5, 0, Math.PI * 1.02, Math.PI * 1.98, true); ctx.stroke(); ctx.restore(); }
        }
        // now and then a shooting star
        if (!reduce) { const cyc = (T % 5.5) / 5.5, sx = W * (0.15 + ((Math.floor(T / 5.5) * 0.37) % 0.7)), sy = H * 0.12; if (cyc < 0.16) { const t2 = cyc / 0.16, x2 = sx + t2 * W * 0.22, y2 = sy + t2 * H * 0.12; const gl = ctx.createLinearGradient(x2 - W * 0.08, y2 - H * 0.045, x2, y2); gl.addColorStop(0, 'rgba(254,254,254,0)'); gl.addColorStop(1, `rgba(254,254,254,${0.85 * d * (1 - t2)})`); ctx.strokeStyle = gl; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x2 - W * 0.08, y2 - H * 0.045); ctx.lineTo(x2, y2); ctx.stroke(); } }
      }
      // land
      for (const cl of clouds) {
        if (!near(cl.z) || penZ < cl.z - 10) continue;
        const dz = cl.z - camZ, reveal = clamp((penZ - (cl.z - 10)) / 2), k = passed(cl.z - 3), Q = cl.pts.map((p) => V([p[0] + (reduce ? 0 : Math.sin(T * 0.08 + cl.ci) * 0.15), p[1], p[2]]));
        if (k > 0 && reveal >= 1) { polyline(Q, Q.length); ctx.closePath(); ctx.fillStyle = tint(PASTEL.land.cloud, 1, 0.8 * k * fogA(dz) * land); ctx.fill(); }
        ctx.strokeStyle = tint(PASTEL.land.cloud, k * 0.4, 0.5 * fogA(dz) * land); ctx.lineWidth = clamp(1.2 * AHEAD / dz, 0.5, 1.8); polyline(Q, Math.max(2, Math.round(reveal * Q.length))); ctx.stroke();
      }
      for (const r of ridges) {
        if (!near(r.z)) continue;
        const dz = r.z - camZ, reveal = clamp((penZ - (r.z - 7)) / 2.5); if (reveal <= 0) continue;
        const Q = r.pts.map(V), k = passed(r.z - 4), c = PASTEL.land.hill[r.k % 3], a = fogA(dz) * land;
        if (k > 0 && reveal >= 1) { const first = Q[0], lastQ = Q[Q.length - 1]; polyline(Q, Q.length); ctx.lineTo(lastQ[0], H * 2); ctx.lineTo(first[0], H * 2); ctx.closePath(); ctx.fillStyle = tint(c, 1, 0.55 * k * a); ctx.fill(); }
        ctx.strokeStyle = tint([110, 140, 120], k, 0.5 * a); ctx.lineWidth = clamp(1.4 * AHEAD / dz, 0.5, 2); polyline(Q, Math.max(2, Math.round(reveal * Q.length))); ctx.stroke();
      }
      ctx.lineWidth = 1.2;
      for (const g of grass) {
        if (!near(g.z, 10) || penZ < g.z) continue;
        const a = V([g.x, GROUND, g.z]); if (!a) continue;
        const b = V([g.x + g.lean + (reduce ? 0 : Math.sin(T * 1.8 + g.z * 3) * 0.01), GROUND - g.h, g.z]);
        ctx.strokeStyle = tint(PASTEL.land.grass, passed(g.z), 0.5 * land); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      for (const z of poles) {
        if (penZ < z || !near(z)) continue; const dz = z - camZ;
        const top = pathAt(z), a = V(top), b = V([top[0], GROUND + 0.05, z]), c1 = V([top[0] - 0.14, top[1] + 0.08, z]), c2 = V([top[0] + 0.14, top[1] + 0.08, z]);
        if (!a || !b) continue;
        ctx.strokeStyle = tint(PASTEL.land.pole, passed(z), 0.75 * fogA(dz) * land); ctx.lineWidth = clamp(1.8 * AHEAD / dz, 0.6, 3);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.stroke();
      }
      // sea: the surface overhead, kelp from the bed, bubbles rising
      for (let i = surf.length - 1; i >= 0; i--) {
        const sv = surf[i]; if (!near(sv.z, 12) || camZ < GATES[0] - 3) continue;
        const dz = sv.z - camZ, reveal = clamp((penZ - (sv.z - 8)) / 2); if (reveal <= 0) continue;
        const Q = []; for (let x = -8; x <= 8.001; x += 0.25) Q.push(V([x, SURF + 0.05 * Math.sin(x * 2.1 + sv.ph + (reduce ? 0 : T * 0.9)), sv.z]));
        ctx.strokeStyle = tint(PASTEL.sea.surf, passed(sv.z), 0.35 * fogA(dz) * land); ctx.lineWidth = clamp(1.2 * AHEAD / dz, 0.4, 1.8); polyline(Q, Math.max(2, Math.round(reveal * Q.length))); ctx.stroke();
      }
      for (const kp of kelp) {
        if (!near(kp.z, 16) || penZ < kp.z - 9 || camZ < GATES[0] - 3) continue;
        const dz = kp.z - camZ, k = passed(kp.z), Q = [];
        for (let t = 0; t <= 1.001; t += 0.08) Q.push(V([kp.x + Math.sin(t * 5 + kp.ph + (reduce ? 0 : T * 1.1)) * 0.08 * t, BED - kp.h * t, kp.z]));
        ctx.strokeStyle = tint(PASTEL.sea.kelp, k, 0.6 * fogA(dz) * land); ctx.lineWidth = clamp(2.2 * AHEAD / dz, 0.6, 4); polyline(Q, Q.length); ctx.stroke();
      }
      for (const bb of bubbles) {
        if (!near(bb.z, 12) || penZ < bb.z - 6 || camZ < GATES[0] - 3) continue;
        const rise = reduce ? bb.off : (bb.off + T * 0.08) % 1, y = DEEP + 0.8 - rise * (DEEP + 0.8 - SURF - 0.1);
        const q = V([bb.x + Math.sin(T + bb.off * 9) * 0.03, y, bb.z]); if (!q) continue;
        ctx.strokeStyle = tint(PASTEL.sea.bubble, passed(bb.z), 0.6 * fogA(q[2]) * land); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q[0], q[1], bb.r * F3 / q[2], 0, Math.PI * 2); ctx.stroke();
      }
      // space: stars all around; the stars of the constellation are where the line turns
      for (const st of stars) {
        if (!near(st.z, 20) || penZ < st.z - 12) continue;
        const q = V([st.x, st.y, st.z]); if (!q) continue;
        const k = passed(st.z - 2), a = land * fogA(q[2]) * clamp((penZ - (st.z - 12)) / 2) * (reduce ? 0.7 : 0.6 + 0.3 * Math.sin(T * 1.4 + st.s * 30));
        const r = clamp(2.2 * AHEAD / q[2], 0.7, 3.2), col = k > 0.05 ? tint(PASTEL.space.star[st.c], k, a) : `rgba(200,204,222,${0.6 * a})`;
        if (st.sparkle) { const L = r * 3; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q[0] - L, q[1]); ctx.lineTo(q[0] + L, q[1]); ctx.moveTo(q[0], q[1] - L); ctx.lineTo(q[0], q[1] + L); ctx.stroke(); }
        else { ctx.fillStyle = col; ctx.fillRect(q[0] - r / 2, q[1] - r / 2, r, r); }
      }
      for (let i = 0; i < STARS.length; i++) {
        const sp = STARS[i]; if (sp[2] > TAIL || !near(sp[2]) || penZ < sp[2] - 10) continue;
        const q = V(sp); if (!q) continue;
        const k = passed(sp[2], 0), lit = penZ >= sp[2], a = land * fogA(q[2]), R = clamp(0.07 * F3 / q[2], 3, 14) * (lit ? 1.3 : 1);
        const col = lit ? tint(PASTEL.space.star[i % 3], Math.max(0.6, k), a) : `rgba(200,204,222,${0.45 * a})`;
        ctx.fillStyle = col; ctx.beginPath();
        for (let j = 0; j < 8; j++) { const an = (j / 8) * Math.PI * 2 - Math.PI / 2, rr = j % 2 ? R * 0.38 : R; ctx.lineTo(q[0] + Math.cos(an) * rr, q[1] + Math.sin(an) * rr); }
        ctx.closePath(); ctx.fill();
        if (lit) { const gl = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R * 3); gl.addColorStop(0, tint(PASTEL.space.star[i % 3], 1, 0.35 * a)); gl.addColorStop(1, tint(PASTEL.space.star[i % 3], 1, 0)); ctx.fillStyle = gl; ctx.fillRect(q[0] - R * 3, q[1] - R * 3, R * 6, R * 6); }
      }
      // gates: a phone's screen standing on the line, the next world's name above it; passing through starts it
      for (let gi = 0; gi < GATES.length; gi++) {
        const G = GATES[gi], dz = G - camZ; if (dz < 0.25 || dz > FAR3) continue;
        if (gi > 0 && camZ < GATES[gi - 1]) continue;
        const c = pathAt(G), q = V([c[0], c[1] - 0.3, G]); if (!q) continue;
        const s3 = F3 / dz, w = 0.95 * s3, h = 2.05 * s3, a = land * clamp((dz - 0.25) / 0.7) * clamp((FAR3 - dz) / 8);
        ctx.strokeStyle = `rgba(${INK},${a})`; ctx.lineWidth = clamp(2.2 * AHEAD / dz, 1, 4.5);
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(q[0] - w / 2, q[1] - h / 2, w, h, 0.17 * s3); else ctx.rect(q[0] - w / 2, q[1] - h / 2, w, h); ctx.stroke();
        ctx.lineWidth = clamp(1 * AHEAD / dz, 0.5, 2); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(q[0] - w / 2 + 0.06 * s3, q[1] - h / 2 + 0.06 * s3, w - 0.12 * s3, h - 0.12 * s3, 0.11 * s3); ctx.stroke();
        previewWorld(gi, q[0], q[1], w - 0.12 * s3, h - 0.12 * s3, 0.11 * s3, a);
      }
      ctx.textAlign = 'start';
      // the fishing line's float, where the line enters the water
      { const z = GATES[0] + 0.9, p = V([pathAt(z)[0], SURF, z]); if (p && penZ > z) { const s3 = F3 / p[2], r = 0.07 * s3, a = land * fogA(p[2]); ctx.fillStyle = tint([246, 170, 186], passed(z), a); ctx.beginPath(); ctx.arc(p[0], p[1], r, Math.PI, 0); ctx.fill(); ctx.fillStyle = `rgba(254,254,254,${a})`; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI); ctx.fill(); ctx.strokeStyle = `rgba(${INK},${a})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.stroke(); } }
      // the line: thick close by, a hair far away, swelling where something is written on it
      let run = [], wPrev = -1, aPrev = -1;
      const flush = () => { if (run.length > 1) { ctx.lineWidth = wPrev; ctx.strokeStyle = `rgba(${lineRGB},${aPrev})`; ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); for (let n2 = 1; n2 < run.length; n2++) ctx.lineTo(run[n2][0], run[n2][1]); ctx.stroke(); } };
      for (let z = Math.max(PEN.tale[0], camZ + 0.15); z <= penZ + 1e-6; z += 0.03) {
        const p = V(pathAt(Math.min(z, penZ))); if (!p) continue;
        let sw = 1; for (const az of swellZ) sw += 0.8 * Math.exp(-Math.pow((z - az) / 0.35, 2));
        const wd = Math.round(clamp(2.3 * AHEAD / p[2], 0.5, 5) * sw * 4) / 4, al = Math.round(A * fogA(p[2]) * 20) / 20;
        if (wd !== wPrev || al !== aPrev) { const lastP = run[run.length - 1]; flush(); run = lastP ? [lastP] : []; wPrev = wd; aPrev = al; }
        run.push(p);
      }
      flush();
      drawLead(A);
      const tip = V(pathAt(penZ)); if (tip && penZ > PEN.tale[0] + 0.05) { ctx.fillStyle = `rgba(${lineRGB},${A})`; ctx.beginPath(); ctx.arc(tip[0], tip[1], clamp(4 * AHEAD / tip[2], 2, 6), 0, Math.PI * 2); ctx.fill(); }
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
    // the five lines open out of one over the first stretch of the staff
    const splitAt = (z) => ease((z - HEAD) / 1.1), lineRad = (l, z) => 1 + (l * 2 - 4) * GAP * 0.5 * splitAt(z);
    // depth shrinks the swirl gently (a power below 1), so the far turns open out instead of knotting at the centre
    const OPEN = 0.55, shrink = (dz) => Math.pow(VIEW / dz, OPEN);
    const pitchOf = (i) => Math.round(4 + 3 * Math.sin(i * 0.83 + 0.4)); // 0..8: lines and spaces, bottom to top
    const radiusOf = (p) => 1 + (p - 4) * GAP * 0.5;
    const trackLayer = $('#jy-tracks');
    let cur = null, recK = 0, recShown = -1, flow = [], trackEls = {}, albumOpen = -1;
    function buildCurrent() {
      const Rf = Math.min(W * 0.26, H * 0.37), size = clamp(H * 0.14, 92, 128);
      cur = { cx: W * 0.36, cy: H * 0.5, F: Rf * VIEW, size, Rf };
      // where the staff begins on screen when the record opens: the world's line comes in there along the way the
      // staff leaves it. The staff is turned so its head sits upper right, and turns back as the camera dives in.
      { const c0 = -VIEW - 2.2, r0 = FOCUS - ((c0 + VIEW) / DZ) * TURN, at = (z) => { const a = (z / DZ) * TURN + r0 + cur.off, r = Rf * shrink(z - c0); return [W / 2 + Math.cos(a) * r, H * 0.5 + Math.sin(a) * r]; };
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
        b.querySelector('img').src = ASSET + (t.thumb || w.thumb); b.querySelector('i').textContent = String(j + 1).padStart(2, '0'); b.querySelector('.jy-trk-t').textContent = t.title;
        b.addEventListener('click', () => (isPlaying(w.slug, j) ? pause() : play(w, j)));
        box.appendChild(b);
      });
      trackLayer.appendChild(box); trackEls[i] = box;
    });
    listeners.add(() => Object.entries(trackEls).forEach(([i, box]) => { const w = bySlug[items[i].dataset.slug]; $$('.jy-trk', box).forEach((b, j) => b.setAttribute('aria-pressed', String(isPlaying(w.slug, j)))); }));
    const recordU = (k) => CH.record[0] + (CH.record[1] - CH.record[0]) * (0.1 + 0.82 * (N > 1 ? k / (N - 1) : 0));
    // whatever has passed the note in focus fades out, so nothing covers the words on the right
    const behind = (dz) => clamp((dz - VIEW * 0.45) / (VIEW * 0.4));
    const proj = (theta, z, camZ, roll, rad = 1) => { const dz = z - camZ; if (dz < NEAR) return null; const r = cur.Rf * rad * shrink(dz); return [cur.cx + Math.cos(theta + roll) * r, cur.cy + Math.sin(theta + roll) * r, dz]; };
    // an album's tracks hang on an earphone cord that runs out of the album along the bottom, with a little coil
    const cord = (n, fx) => { const y = H * 0.905, x0 = fx - 70, sp = Math.min(78, (x0 - 72) / Math.max(1, n)); return Array.from({ length: n }, (_, j) => [x0 - (j + 0.5) * sp, y + Math.sin(j * 1.35 + 0.6) * 16]); };
    function placeCurrent(lr) {
      const k = recK, focusZ = k * DZ;
      const dive = ease((lr - 0.02) / 0.1), out = ease((lr - 0.92) / 0.08);
      // diving: from above the groove (a flat spiral) down into it; leaving: past the last note into the label
      const camZ = lerp(-VIEW - 2.2, focusZ - VIEW, dive) + out * 3.5;
      cur.cx = lerp(W / 2, W * 0.36, dive); cur.cy = H * 0.5;
      const roll = FOCUS - ((camZ + VIEW) / DZ) * TURN + (cur.off || 0) * (1 - dive);
      cur.camZ = camZ; cur.roll = roll;
      // the pen draws the staff forward from its head; works appear once their part of the staff is drawn
      cur.zMax = HEAD + (camZ + FAR - HEAD) * ease(lr / 0.15);
      const list = recordEl.classList.contains('list');
      spiral.style.opacity = list ? '1' : String(ease((lr - 0.02) / 0.06) * (1 - out));
      if (!list) items.forEach((li, i) => {
        const p = proj(i * TURN, i * DZ, camZ, roll, radiusOf(pitchOf(i)));
        if (!p || p[2] > FAR) { li.style.visibility = 'hidden'; return; }
        // a note fades as soon as it has passed the focus, so it never covers the words on the right
        const sc2 = Math.pow(VIEW / p[2], 0.8), a = clamp((p[2] - VIEW * 0.72) / (VIEW * 0.22)) * clamp((FAR - p[2]) / 5) * clamp((cur.zMax - i * DZ) / 0.5);
        li.style.visibility = a > 0.02 ? 'visible' : 'hidden';
        li.style.transform = `translate(${p[0]}px,${p[1]}px) scale(${sc2})`;
        li.style.opacity = String(a); li.style.zIndex = String(Math.round(1000 - p[2] * 40));
      });
      const i = Math.round(k);
      if (i !== recShown) { recShown = i; showReadout(i); }
      const near = Math.abs(k - i) < 0.32 && lr > 0.1 && lr < 0.92 && !list ? i : -1;
      Object.entries(trackEls).forEach(([j, box]) => {
        const show = Number(j) === near;
        box.classList.toggle('on', show);
        $$('.jy-trk', box).forEach((b) => { b.tabIndex = show ? 0 : -1; });
        if (!show) return;
        const btns = $$('.jy-trk', box), fp = proj(near * TURN, near * DZ, camZ, roll, radiusOf(pitchOf(near))), pts2 = cord(btns.length, fp ? fp[0] : W * 0.5);
        btns.forEach((b, n) => { b.style.transform = `translate(${pts2[n][0]}px,${pts2[n][1]}px)`; b.style.transitionDelay = (n * 30) + 'ms'; });
      });
      albumOpen = near;
    }
    // one helix of the staff, stroked in short runs so the width can follow the depth
    function staffLine(l, z0, z1, camZ, roll, alpha, width) {
      let run = [], wPrev = -1, aPrev = -1;
      const flush = () => { if (run.length > 1) { ctx.lineWidth = wPrev; ctx.strokeStyle = `rgba(${lineRGB},${aPrev})`; ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); for (let n = 1; n < run.length; n++) ctx.lineTo(run[n][0], run[n][1]); ctx.stroke(); } };
      for (let z = z0; z <= z1; z += 0.04) {
        const p = proj((z / DZ) * TURN, z, camZ, roll, lineRad(l, z)); if (!p) continue;
        // still one line before it splits: as thick as the pen line it continues
        const wd = Math.round(clamp(width * VIEW / p[2] * (1 + 1.4 * (1 - splitAt(z))), 0.4, 3.2) * 4) / 4, al = Math.round(0.85 * alpha * behind(p[2]) * clamp((FAR - p[2]) / 6) * 20) / 20;
        if (wd !== wPrev || al !== aPrev) { const last = run[run.length - 1]; flush(); run = last ? [last] : []; wPrev = wd; aPrev = al; }
        run.push(p);
      }
      flush();
    }
    function drawCurrent(lr) {
      if (!cur || cur.camZ == null) return;
      const { camZ, roll, zMax } = cur, alpha = 1 - ease((lr - 0.94) / 0.06);
      if (alpha <= 0) return;
      // the colour of the note in focus, faint, around the swirl
      const w = recShown >= 0 && bySlug[items[recShown].dataset.slug], c = w && colorOf[w.slug];
      if (c) { const g = ctx.createRadialGradient(cur.cx, cur.cy, 0, cur.cx, cur.cy, Math.max(W, H) * 0.6); g.addColorStop(0, `rgba(${c},${0.16 * alpha * ease(lr / 0.12)})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      // the staff: five ink lines swirling in, thick close by, a hair far away
      const z0 = Math.max(HEAD, camZ + NEAR + 0.02), z1 = Math.min((N - 1) * DZ + 2.5, camZ + FAR, zMax);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let l = 0; l < 5; l++) staffLine(l, z0, z1, camZ, roll, alpha, 1.3);
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
      // the album's earphone cord: out of the album, one coil, then along its tracks
      if (albumOpen >= 0 && trackEls[albumOpen]) {
        const p = proj(albumOpen * TURN, albumOpen * DZ, camZ, roll, radiusOf(pitchOf(albumOpen))), n = $$('.jy-trk', trackEls[albumOpen]).length;
        if (p) {
          const pts2 = cord(n, p[0]), c0 = [p[0] - 20, (p[1] + pts2[0][1]) / 2 + 10], rr = 13;
          ctx.strokeStyle = `rgba(${INK},${0.85 * alpha})`; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p[0], p[1] + (cur.size / 2) * Math.pow(VIEW / p[2], 0.8));
          ctx.quadraticCurveTo(p[0] + 10, c0[1] - 30, c0[0], c0[1] - rr);
          for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.2) ctx.lineTo(c0[0] - Math.sin(t) * rr, c0[1] - Math.cos(t) * rr); // the coil
          let prev = [c0[0], c0[1] - rr];
          for (const q of pts2) { const mx = (prev[0] + q[0]) / 2; ctx.bezierCurveTo(mx, prev[1] + 26, mx, q[1] + 26, q[0], q[1]); prev = q; }
          ctx.stroke();
          // the winder that keeps the cord, as on the wire before
          ctx.save(); ctx.translate(c0[0], c0[1] + rr + 2); ctx.fillStyle = 'rgba(254,254,254,1)'; ctx.lineWidth = 1.4; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-12, -7, 24, 14, 7); else ctx.rect(-12, -7, 24, 14); ctx.fill(); ctx.stroke(); ctx.fillStyle = `rgba(${INK},${alpha})`; for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.arc(dx, 0, 1.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
        }
      }
    }
    function showReadout(i) {
      const w = bySlug[items[i].dataset.slug];
      items.forEach((li, j) => li.classList.toggle('cur', j === i));
      $('#jy-ro-i').textContent = String(i + 1).padStart(2, '0');
      $('#jy-ro-t').textContent = w.title; $('#jy-ro-a').textContent = w.artist;
      $('#jy-ro-m').textContent = [w.type, w.date].filter(Boolean).join(' · ');
      $('#jy-ro-r').textContent = roleLine(w.roles);
      $('#jy-ro-play').hidden = !sourceOf(w);
      sample(w);
      syncReadout();
    }
    function syncReadout() {
      if (recShown < 0) return;
      const w = bySlug[items[recShown].dataset.slug], p = isPlaying(w.slug);
      $('#jy-ro-play').textContent = p ? COPY.pause : COPY.listen;
      $('#jy-ro-play').setAttribute('aria-pressed', String(p));
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
    function setNowPlaying(i) { const w = pinned[i]; if (!w || i === npShown) return; npShown = i; setOffer(w); return; $('#jy-npd').style.backgroundImage = `url(${ASSET}${w.thumb})`; $('#jy-npt').textContent = w.title; $('#jy-npa').textContent = w.artist; }
    function chapterOf(u) { for (const k of Object.keys(CH)) if (u < CH[k][1]) return k; return 'epi'; }
    function syncInert() {
      if (story && !story.hidden) return;
      if (profile.classList.contains('open')) return;
      sections.forEach((s) => { s.inert = s.dataset.ch !== chapter; });
    }
    function frameLoop(now) {
      requestAnimationFrame(frameLoop);
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; if (!reduce) T += dt;
      const u = U();
      const ch = chapterOf(u);
      if (ch !== chapter) { chapter = ch; syncInert(); rail.forEach((a) => { if (a.dataset.go === railOf[ch]) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); }); }
      // Prologue: fall into the phone
      const ip = clamp(local(u, 'pro')), cover = Math.max(W / 224, H / 504) * 1.08;
      phone.style.transform = `translateX(${-W * 0.14 * (1 - ease(ip / 0.35))}px) scale(${Math.pow(cover, ease((ip - 0.3) / 0.7))})`;
      card.style.transform = `rotateY(${180 * ease(ip / 0.28)}deg)`;
      phone.style.visibility = ip >= 1 ? 'hidden' : 'visible';
      phone.tabIndex = ip > 0.3 ? -1 : 0;
      screen.style.background = ip > 0.8 ? `rgb(${Math.round(lerp(20, 254, ease((ip - 0.8) / 0.2)))},${Math.round(lerp(28, 254, ease((ip - 0.8) / 0.2)))},${Math.round(lerp(48, 254, ease((ip - 0.8) / 0.2)))})` : '';
      lead.style.opacity = String(1 - ease(ip * 3)); lead.style.visibility = ip > 0.34 ? 'hidden' : 'visible';
      lock.style.opacity = String(1 - ease((ip - 0.55) / 0.25));
      // Tale to Music: the pen moves forward through the world; the camera follows a few steps behind
      const lt = local(u, 'tale'), lc = local(u, 'case'), lm = local(u, 'music');
      penZ = penAt(u);
      camZ = ip < 1 ? lerp(-2.6, penZ - AHEAD, ease(ip)) : penZ - AHEAD;
      const ck = tailK(penZ);
      // follow the pen sideways and up and down, from a little above, so the line ahead and the land stay in view
      const pc = pathAt(penZ - 1.2);
      camX = lerp(pc[0] * 0.35, 0, ck); camY = lerp(pc[1] * 0.7 - 0.45, 0, ck);
      placeAnchors();
      spaceDark = ease(clamp((camZ - (GATES[1] - 1.2)) / 2.5)) * (1 - ease(clamp((penZ - 47.8) / 1.1)));
      { const m = (c0, c1) => Math.round(lerp(c0, c1, spaceDark)); lineRGB = `${m(20, 244)},${m(28, 244)},${m(48, 252)}`; }
      const caseWork = CASE && bySlug[CASE];
      if (caseWork) { if (lc > 0.04 && lc < 1) { setOffer(caseWork); caseOffer = true; } else if (caseOffer) { caseOffer = false; setOffer(null); } }
      // Record: the dive into the current
      const lr = local(u, 'record'), ld = local(u, 'done'), le = local(u, 'epi');
      const inRecord = lr > 0 && lr < 1;
      on(recordEl, inRecord); on($('#jy-filters'), lr > 0.1 && lr < 0.93); on(readout, lr > 0.1 && lr < 0.93);
      on($('#jy-found'), (lm > 0.88 && lm < 1.1 && lr <= 0) || (lr > 0 && lr < 0.06)); on($('#jy-hint'), lr > 0.05 && lr < 0.18);
      if (inRecord) { recK = clamp((lr - 0.1) / 0.82) * (N - 1); placeCurrent(lr); }
      else if (spiral.style.opacity !== '0') { spiral.style.opacity = '0'; Object.values(trackEls).forEach((box) => box.classList.remove('on')); albumOpen = -1; }
      // Done: out of the current, the phone is seen from outside, the record in it
      const ink = le > 0 || spaceDark > 0.5;
      stageEl.classList.toggle('ink', ink); html.classList.toggle('jy-ink', ink);
      markImg.src = ink ? markImg.dataset.paper : markImg.dataset.ink;
      on($('#jy-letter'), ld > 0.1 && ld < 0.92);
      if (lr > 0.8 && !recBuilt) buildRecordWash();
      const RR = Math.min(W, H) * 0.34;
      if (ld > 0 && le <= 0) {
        const s0 = (2 * RR) / 192, s = lerp(s0, 1, ease(ld / 0.7));
        frame.style.opacity = String(ease(ld / 0.25)); frame.style.transform = `scale(${s})`; frame.style.left = '50%'; frame.style.top = '50%';
        const chrome = ld >= 0.35; frame.style.background = chrome ? '' : 'transparent'; frame.style.boxShadow = chrome ? '' : 'none'; frameScr.style.background = chrome ? '' : 'transparent';
      } else if (le > 0) {
        frame.style.opacity = '1'; frame.style.transform = `scale(${lerp(1, 1.25, ease(le / 0.3))})`; frame.style.left = '72%'; frame.style.top = '50%';
        frame.style.background = ''; frame.style.boxShadow = ''; frameScr.style.background = '';
      } else frame.style.opacity = '0';
      // Epilogue
      on($('#jy-empty'), le > 0.05 && le < 0.4);
      on($('#jy-contact'), le > 0.2);

      // ---- canvas ----
      ctx.clearRect(0, 0, W, H);
      if (inRecord) drawCurrent(lr);
      const worldA = (ip > 0.8 ? ease((ip - 0.8) / 0.2) : 0) * (1 - ease(lr / 0.06));
      if (worldA > 0) drawWorld(worldA, lm, now);
    }
    function resize() {
      DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildWorld(); buildCurrent(); ANCHORS.forEach((a) => { a.w = 0; }); placeSnaps(); recShown = -1;
    }
    addEventListener('resize', resize);
    phone.addEventListener('click', () => goU(CH.tale[0] + 0.5));

    // sample every cover once the record is near, so its wash can mix them
    let sampledAll = false;
    addEventListener('scroll', () => { if (!sampledAll && U() > CH.music[0]) { sampledAll = true; paintRecord(); } }, { passive: true });

    function reset() { recBuilt = false; $('#jy-charm-cd').style.background = ''; }
    const at = (c, f) => CH[c][0] + (CH[c][1] - CH[c][0]) * f;
    const target = { pro: 0, tale: at('tale', 0.7), tone: at('tone', 0.9), record: recordU(0), epi: CH.epi[0] + 0.5 };
    function goStage(where, smooth = true) {
      goU(target[where] != null ? target[where] : 0, smooth);
    }
    resize();
    requestAnimationFrame(frameLoop);
    return { paintRecord, reset, syncInert, go: goStage, recordU, goU, items };
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
