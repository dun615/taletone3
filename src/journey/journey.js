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
  const CH = { pro: [0, 1], tale: [1, 2.4], tone: [2.4, 4.8], case: [4.8, 6.2], music: [6.2, 7.8], record: [7.8, 11.8], done: [11.8, 12.7], epi: [12.7, 13.7] };
  const TOTAL = 13.7;
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
  const on = (el, v) => el && el.classList.toggle('on', !!v);

  if (STAGE) html.classList.add('jy-stage-mode');

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
    const chosen = $$('.jy-fchip[aria-pressed="true"]').filter((b) => (b.dataset.field || b.dataset.role) !== 'all').map((b) => b.textContent.trim());
    $('#jy-fbtn').textContent = [COPY.filter, ...chosen].join(' · ');
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
    mchap.addEventListener('click', (e) => { e.stopPropagation(); setMenu(true); });
    let sheet = null, sheetY = 0;
    // one sheet at a time: the filters, or the inquiry (which also holds the page still, so typing never scrolls the story)
    function setSheet(which, opener) {
      if (sheet === which) return;
      if (sheet === 'form') { html.classList.remove('jy-held'); frozenU = null; scrollTo(0, sheetY); }
      sheet = which;
      filtersEl.classList.toggle('open', which === 'filters'); fbtn.setAttribute('aria-expanded', String(which === 'filters'));
      contactEl.classList.toggle('open', which === 'form'); fopen.setAttribute('aria-expanded', String(which === 'form'));
      scrim.hidden = which !== 'filters';
      if (which === 'form') { sheetY = scrollY; frozenU = U(); html.classList.add('jy-held'); setTimeout(() => $('#jy-f-project').focus({ preventScroll: true }), 60); }
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
    // the land ends where the line lifts off the last pole and climbs into the sky. High up the sky has the colour of
    // the sea just under its surface, and at ZS, when the screen is all that one colour, the world quietly becomes the
    // sea: the line runs level a while, then sinks from SINK into the deep, which opens onto space at S0.
    const S0 = PEN.case[0], ZS = 12, SINK = 16, LIFT = [8.8, 11.6], YT = -5;
    const WIRE = [2.8, 9], POLE = 3, GROUND = 1.35, AHEAD = 4.2, FAR3 = 26, TAIL = 46.5;
    const PASTEL = { land: { sky: [214, 233, 246], hill: [[190, 222, 199], [214, 230, 186], [200, 214, 236]], grass: [140, 190, 150], pole: [196, 170, 150], cloud: [250, 226, 236] },
      space: { sky: [226, 220, 245], star: [[252, 232, 170], [246, 196, 222], [196, 214, 250]] } };
    const tint = (c, k, a) => `rgba(${Math.round(lerp(150, c[0], k))},${Math.round(lerp(152, c[1], k))},${Math.round(lerp(160, c[2], k))},${a})`;
    const passed = (z, lag = 0.4) => ease(clamp((penZ - z - lag) / 2.6)); // 0 pale, 1 fully coloured
    const penAt = (u) => { for (const k of ['music', 'case', 'tone', 'tale']) { const l = local(u, k); if (l > 0) return lerp(PEN[k][0], PEN[k][1], clamp(k === 'tale' ? (l - 0.08) / 0.92 : l)); } return PEN.tale[0]; };
    const wireW = (z) => clamp((z - WIRE[0] + 0.8) / 0.8) * clamp((WIRE[1] + 0.8 - z) / 0.8);
    // the end of the constellation: the line leaves the last star for the head of the staff (set in buildCurrent),
    // where it splits in five and draws the record's staff
    // the sea: DEPTH deep between SINK and S0, slowly at first, steeply, then slowly into the dark. A shelf of sand
    // carries kelp and rocks from SHELF0 until SHELF, where it drops away. Space sits YS below the sky the line rose to.
    const DEPTH = 12, SHELF0 = 18, SHELF = 21.5, YS = YT + DEPTH + 0.25, SURF = YT - 1.7;
    const seaD = (z) => { const u = clamp((z - SINK) / (S0 - SINK)); return DEPTH * u * u * (3 - 2 * u); };
    const liftK = (z) => ease((z - LIFT[0]) / (LIFT[1] - LIFT[0]));
    const baseAt = (z) => YT * liftK(z) + seaD(z); // how high the line runs here, roughly
    const bedAt = (z) => YT + seaD(z) + 2.6 + (z > SHELF ? Math.pow(z - SHELF, 2) * 2.5 : 0);
    const dkAt = (z) => seaD(z) / DEPTH; // 0 the bright shallows, 1 the dark deep
    // the camera position where the deep becomes space (inside the phone that comes to meet it)
    const X2 = S0 - 0.4, spaceIn = () => (camZ >= X2 ? 1 : 0);
    const tailK = (z) => ease((z - TAIL) / (PEN.music[1] - TAIL));
    // tail.T: the staff's head on screen, tail.tg: the way the staff leaves it (both from the final camera)
    let tail = { T: [0, 0], tg: [1, 0], L: 0 };
    function tailAt(z) {
      const cz = PEN.music[1] - AHEAD, s = clamp((z - TAIL) / (PEN.music[1] - TAIL)), d = Math.max(0.2, z - cz) / F3;
      return [(tail.T[0] - tail.tg[0] * tail.L * (1 - s) - W / 2) * d, (tail.T[1] - tail.tg[1] * tail.L * (1 - s) - H * HZ) * d + YS];
    }
    // the constellation: stars at fixed points, the line runs straight from one to the next
    const STARS = (() => { let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); const out = []; for (let z = S0 + 1.2; z < 50; z += 1.5 + r() * 0.5) out.push([-0.4 + (r() - 0.5) * 1.6, YS - 0.55 + (r() - 0.5) * 1.1, z]); return out; })();
    function constAt(z) {
      if (z <= STARS[0][2]) return STARS[0];
      for (let i = 1; i < STARS.length; i++) if (z <= STARS[i][2]) { const a = STARS[i - 1], b = STARS[i], f = (z - a[2]) / (b[2] - a[2]); return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), z]; }
      return STARS[STARS.length - 1];
    }
    function pathAt(z) {
      let x = -0.35 + 0.5 * Math.sin(z * 0.33) + 0.15 * Math.sin(z * 0.91 + 1.2), y = 0.35 + 0.16 * Math.sin(z * 0.47);
      const ww = wireW(z);
      if (ww > 0) { let f = ((z - WIRE[0]) / POLE) % 1; if (f < 0) f += 1; y = lerp(y, -0.55 + 0.32 * 4 * f * (1 - f), ww); }
      // off the last pole up into the sky, level a while, then down into the deep like a fishing line
      const lk = liftK(z);
      if (lk > 0) y = lerp(y, YT + seaD(z) + 0.15 * Math.sin(z * 0.6), lk);
      // space: from star to star
      const ck2 = ease((z - S0) / 2.6);
      if (ck2 > 0) { const c = constAt(z); x = lerp(x, c[0], ck2); y = lerp(y, c[1], ck2); }
      // aimed in screen terms: from the last star the line swings onto the way the staff leaves, and comes in along it
      const tk = ease((z - TAIL) / 2.1);
      if (tk > 0) { const t2 = tailAt(z); x = lerp(x, t2[0], tk); y = lerp(y, t2[1], tk); }
      return [x, y, z];
    }
    let penZ = PEN.tale[0], camX = 0, camY = 0, camZ = -1, F3 = 800;
    const V = (p) => { const dz = p[2] - camZ; if (dz < 0.12) return null; const s3 = F3 / dz; return [W / 2 + (p[0] - camX) * s3, H * HZ + (p[1] - camY) * s3, dz]; };
    const fogA = (dz) => clamp((FAR3 - dz) / 8) * clamp((dz - 0.15) / 0.5);

    let mounts = [], birds = [], rocks = [], fish = [], snow = [], jellies = [], glows = [], ridges = [], clouds = [], grass = [], poles = [], kelp = [], bubbles = [], stars = [], surf = [], nebulae = [], milky = [], bodies = [];
    let spaceDark = 0, lineRGB = INK;
    const dots = [];
    function buildWorld() {
      F3 = Math.min(NARROW ? Math.max(W, H * 0.75) : W, H * 1.6) * 0.62;
      const dens = NARROW ? 0.55 : 1;
      let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const G1 = ZS, G2 = S0;
      // far ranges: triangular peaks, snow where they are highest
      mounts = [[23, 3.4, [184, 198, 232]], [17, 2.4, [168, 206, 200]]].map(([z, hMax, c]) => {
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
      for (let z = 1.2; z < 9.6; z += 0.08 + rnd() * 0.1) {
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
      for (let z = 3; z < 9; z += 3 + rnd() * 3) cloudAt(z, (rnd() - 0.5) * 7, -2.1 + rnd() * 0.6, 0.9 + rnd() * 0.9);
      for (let z = 7.4; z < ZS - 1.4; z += 0.9 + rnd() * 0.6) cloudAt(z, (rnd() < 0.5 ? -1 : 1) * (0.9 + rnd() * 2.6), -2.6 - rnd() * 2.6, 1.2 + rnd() * 1.1);
      // the sea, by depth: the surface and the shelf near the top, fish and jellyfish further down, glowing plankton in the dark
      const deepY = (z) => YT + seaD(z);
      surf = [];
      for (let z = G1 + 0.4; z < G1 + 9; z += 1.1) surf.push({ z, ph: rnd() * 6 });
      kelp = [];
      for (let z = SHELF0 + 0.6; z < SHELF; z += 0.35 + rnd() * 0.45) kelp.push({ x: pathAt(z)[0] + (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 2.8), z, h: 1 + rnd() * 1.4, ph: rnd() * 6 });
      rocks = [];
      for (let z = SHELF0 + 0.3; z < SHELF + 0.4; z += 0.6 + rnd() * 0.8) rocks.push({ x: pathAt(z)[0] + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 3), z, r: 0.18 + rnd() * 0.4, c: (rnd() * 2) | 0, coral: rnd() < 0.45 });
      bubbles = [];
      for (let i = 0; i < Math.round(70 * dens); i++) { const z = SHELF0 + 0.5 + rnd() * (SHELF - SHELF0 - 0.5); bubbles.push({ x: pathAt(z)[0] + (rnd() - 0.5) * 3.5, z, r: 0.02 + rnd() * 0.045, off: rnd() }); }
      fish = [];
      for (let k = 0; k < 9; k++) { const z = SINK + 3 + k * ((G2 - SINK - 6) / 9) + rnd(), y = deepY(z) + (rnd() - 0.5) * 3.4, x0 = (rnd() - 0.5) * 8, dir = rnd() < 0.5 ? -1 : 1, n = 4 + ((rnd() * 6) | 0), c = (rnd() * 3) | 0; for (let j = 0; j < n; j++) fish.push({ z: z + (rnd() - 0.5) * 0.9, y: y + (rnd() - 0.5) * 0.5, x0: x0 + (rnd() - 0.5) * 1.1, dir, c, ph: rnd() * 6, sz: 0.05 + rnd() * 0.035 }); }
      jellies = [];
      for (let z = 20; z < G2 - 1.5; z += 0.9 + rnd()) jellies.push({ x: pathAt(z)[0] + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 2.2), y: deepY(z) + (rnd() - 0.5) * 2.6, z, r: 0.13 + rnd() * 0.15, c: (rnd() * 3) | 0, ph: rnd() * 6 });
      glows = [];
      for (let i = 0; i < Math.round(170 * dens); i++) { const z = 21 + rnd() * (G2 + 1 - 21); glows.push({ x: pathAt(z)[0] + (rnd() - 0.5) * 7, y: deepY(z) + (rnd() - 0.5) * 5, z, c: (rnd() * 3) | 0, s: rnd() }); }
      snow = [];
      for (let i = 0; i < Math.round(220 * dens); i++) { const z = G1 + rnd() * (G2 + 1 - G1); snow.push({ x: (rnd() - 0.5) * 9, y: deepY(z) + (rnd() - 0.5) * 7, z, ph: rnd() }); }
      nebulae = [[G2 + 6, -2.2, -1.2, 2.6, [246, 196, 222]], [G2 + 10, 2.4, -0.4, 3.0, [200, 190, 246]], [G2 + 15, -1.0, 0.9, 3.4, [180, 226, 236]], [G2 + 19, 2.0, -1.6, 2.8, [252, 224, 200]]].map(([z, x, y, r, c]) => ({ z, x, y: y + YS, r, c }));
      milky = [];
      for (let i = 0; i < Math.round(520 * dens); i++) { const t = rnd(), sp = (rnd() + rnd() + rnd() - 1.5) * 0.9; milky.push({ x: -9 + t * 18, y: YS - 3.2 + t * 2.6 + sp, z: G2 + 22 + rnd() * 6, s: rnd() }); }
      bodies = [{ kind: 'ring', z: G2 + 7.5, x: 2.3, y: YS + -1.5, r: 0.55, c: [214, 200, 246], c2: [246, 206, 226] }, { kind: 'moon', z: G2 + 12, x: -2.6, y: YS + -1.9, r: 0.42, c: [252, 238, 196] }, { kind: 'ring', z: G2 + 16.5, x: -2.0, y: YS + 0.9, r: 0.32, c: [186, 226, 236], c2: [252, 232, 170] }];
      stars = [];
      for (let i = 0; i < Math.round(300 * dens); i++) stars.push({ x: (rnd() - 0.5) * 12, y: YS - 3.4 + rnd() * 5.2, z: G2 - 1 + rnd() * 26, s: rnd(), sparkle: rnd() < 0.14, c: (rnd() * 3) | 0 });
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
      const slotX = NARROW ? 16 : W * 0.58, bottom = NARROW ? H - 24 : H * 0.64, ceil = NARROW ? H * 0.34 : 0;

      let latest = -1;
      ANCHORS.forEach((a, i) => { if (penZ >= a.z) latest = i; });
      const g = latest >= 0 ? groupOf(ANCHORS[latest].z) : -1, gone = latest >= 0 && penZ > ANCHORS[latest].z + 4.5;
      // a tall thread sits lower so its first message stays on screen
      const stack = ANCHORS.reduce((t, a, i) => t + (!gone && i <= latest && groupOf(a.z) === g ? (a.h || a.el.offsetHeight) + 10 : 0), 0);
      let y = NARROW ? bottom : Math.min(H - 28, Math.max(bottom, stack + 84));
      leadOf = null;
      for (let i = ANCHORS.length - 1; i >= 0; i--) {
        const a = ANCHORS[i], shown = !gone && i <= latest && groupOf(a.z) === g;
        if (!a.w) { a.w = a.el.offsetWidth; a.h = a.el.offsetHeight; }
        a.el.classList.toggle('on', shown);
        a.el.classList.toggle('older', shown && i !== latest);
        // a hidden message waits just under the spot it will take, so it rises a short way when it arrives
        if (!shown) { a.el.style.setProperty('--aa', '0'); a.el.style.setProperty('--ax', slotX.toFixed(1) + 'px'); a.el.style.setProperty('--ay', (bottom - a.h + 18).toFixed(1) + 'px'); a.el.style.setProperty('--as', '1'); continue; }
        // (on a narrow screen the older ones give way once the thread would climb into the scene)
        if (NARROW && i !== latest && y - a.h < ceil) { a.el.classList.remove('on'); a.el.style.setProperty('--aa', '0'); continue; }
        y -= a.h;
        a.el.style.setProperty('--aa', i === latest ? '1' : spaceDark > 0.5 ? '0.88' : '0.62');
        a.el.style.setProperty('--ax', slotX.toFixed(1) + 'px'); a.el.style.setProperty('--ay', y.toFixed(1) + 'px'); a.el.style.setProperty('--as', '1');
        if (i === latest) leadOf = { a, A: 1, x: slotX, y: y + Math.min(a.h / 2, 40) };
        y -= 10;
      }
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
    function drawTip(rgb, A) { const tip = V(pathAt(penZ)); if (tip && penZ > PEN.tale[0] + 0.05) { ctx.fillStyle = `rgba(${rgb},${A})`; ctx.beginPath(); ctx.arc(tip[0], tip[1], clamp(4 * AHEAD / tip[2], 2, 6), 0, Math.PI * 2); ctx.fill(); } }
    // the sea: lighter under the surface, deeper below; slanting light from above
    const SEA = { top: [[228, 236, 240], [214, 240, 246]], mid: [[208, 218, 226], [180, 224, 236]], bot: [[188, 200, 212], [146, 198, 222]], sand: [[206, 204, 198], [238, 224, 196]], ripple: [[150, 150, 146], [196, 170, 130]] };
    const KELP = [[136, 158, 150], [104, 184, 150]], CORAL = [[176, 170, 178], [246, 156, 170]], ROCK = [[[150, 158, 170], [176, 168, 206]], [[160, 160, 164], [150, 184, 196]]];
    const FISH = [[[176, 184, 196], [248, 168, 156]], [[186, 186, 180], [252, 210, 128]], [[170, 180, 196], [140, 190, 238]]];
    const mixC = (pair, k, a) => `rgba(${pair[0].map((v, i) => Math.round(lerp(v, pair[1][i], k))).join(',')},${a})`;
    // deeper down the water turns navy, then the colour of the night sky it will open onto
    const SEA_DEEP = { top: [64, 112, 164], mid: [38, 74, 126], bot: [24, 44, 88] }, ABYSS = { top: [18, 22, 44], mid: [28, 28, 58], bot: [38, 33, 72] };
    const TREE = [136, 190, 146], FLOWER = [[248, 186, 204], [252, 226, 150], [255, 255, 255]];
    const JELLY = ['246,190,222', '204,192,250', '172,230,240'], GLOW = ['150,236,240', '246,180,226', '240,236,170'];
    function seaBackdrop(a) {
      const k = passed(8, 0.5), dk = dkAt(camZ + 2), hz = H * HZ, t = reduce ? 0 : T;
      const f1 = clamp(dk / 0.55), f2 = clamp((dk - 0.55) / 0.45);
      const stop = (n) => `rgba(${SEA[n][0].map((v, i) => Math.round(lerp(lerp(lerp(v, SEA[n][1][i], k), SEA_DEEP[n][i], f1), ABYSS[n][i], f2))).join(',')},${a})`;
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, stop('top')); g.addColorStop(0.46, stop('mid')); g.addColorStop(1, stop('bot'));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // light from the surface, fading as the line sinks
      const light = a * clamp(1 - dk / 0.45); if (light <= 0) return;
      const g2 = ctx.createLinearGradient(0, 0, 0, hz); g2.addColorStop(0, `rgba(255,255,255,${0.5 * light})`); g2.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, hz);
      for (let i = 0; i < 6; i++) {
        const x = W * (0.02 + i * 0.17) + Math.sin(t * 0.25 + i * 1.7) * W * 0.03, wd = W * (0.03 + (i % 3) * 0.02), len = H * (0.7 + (i % 2) * 0.25), sl = W * 0.1;
        const gr = ctx.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, `rgba(255,255,255,${(0.26 + 0.1 * Math.sin(t * 0.6 + i * 2)) * light})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + wd, 0); ctx.lineTo(x + wd * 2.4 + sl, len); ctx.lineTo(x + sl, len); ctx.closePath(); ctx.fill();
      }
    }
    function nightBackdrop(a) { const g = ctx.createLinearGradient(0, 0, W * 0.3, H); g.addColorStop(0, `rgba(18,22,44,${a})`); g.addColorStop(1, `rgba(40,34,74,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // what the pen's line looks like from z0 to z1: thick close by, a hair far away, swelling where something is written
    function drawLine(z0, z1, rgb, A) {
      let run = [], wPrev = -1, aPrev = -1;
      const flush = () => { if (run.length > 1) { ctx.lineWidth = wPrev; ctx.lineCap = aPrev < 1 ? 'butt' : 'round'; ctx.strokeStyle = `rgba(${rgb},${aPrev})`; ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); for (let n2 = 1; n2 < run.length; n2++) ctx.lineTo(run[n2][0], run[n2][1]); ctx.stroke(); } };
      for (let z = Math.max(PEN.tale[0], camZ + 0.15, z0); z <= z1 + 1e-6; z += 0.03) {
        const p = V(pathAt(Math.min(z, z1))); if (!p) continue;
        let sw = 1; for (const az of swellZ) sw += 0.8 * Math.exp(-Math.pow((z - az) / 0.35, 2));
        const wd = Math.round(clamp(2.3 * AHEAD / p[2], 0.5, 5) * sw * 4) / 4, al = Math.round(A * fogA(p[2]) * 20) / 20;
        if (wd !== wPrev || al !== aPrev) { const lastP = run[run.length - 1]; flush(); run = lastP ? [lastP] : []; wPrev = wd; aPrev = al; }
        run.push(p);
      }
      flush(); ctx.lineCap = 'round';
    }
    const near = (z, far = FAR3) => { const dz = z - camZ; return dz > 0.3 && dz < far; };
    // the three worlds, each drawn whole from the same camera: 0 land, 1 sea, 2 space
    const spaceFade = () => 1 - ease(clamp((penZ - 48.2) / 0.7));
    function backdrop(w, A) {
      if (w === 0) {
        const k = passed(2, 0) * A, g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, tint(PASTEL.land.sky, 1, 0.85 * k)); g.addColorStop(0.5, tint([252, 240, 230], 1, 0.5 * k)); g.addColorStop(0.75, tint([252, 240, 230], 1, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // the sun, far away, so it stays where it is on the screen
        const sx = W * 0.74, sy = H * 0.15, R = Math.min(W, H) * 0.045, gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 6);
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
      const inR = (z) => z >= zLo && z < zHi, G1 = ZS;
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
          if (k > 0 && reveal >= 1) { const first = Q[0], lastQ = Q[Q.length - 1]; polyline(Q, Q.length); ctx.lineTo(lastQ[0], H * 2); ctx.lineTo(first[0], H * 2); ctx.closePath(); ctx.fillStyle = tint(c, 1, 0.62 * k * a); ctx.fill(); }
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
        const wireAt = (i, s, f) => { const t0 = pathAt(poles[i]), t1 = pathAt(poles[i + 1]); return [lerp(t0[0], t1[0], f) + s, lerp(t0[1], t1[1], f) + 0.07 + 0.24 * 4 * f * (1 - f), lerp(poles[i], poles[i + 1], f)]; };
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
        return;
      }
      if (w === 1) {
        const t = reduce ? 0 : T, kS = passed(G1, 0.5);
        // the shelf: rows of sand from far to near, ending where it drops into the deep
        for (let z = Math.min(SHELF + 1.6, camZ + 14); z >= Math.max(SHELF0, camZ + 0.5); z -= 0.5) {
          if (!inR(z)) continue;
          // once the camera has sunk below the shelf, its sand is overhead and out of sight
          const yb = bedAt(z), below = clamp((yb - camY - 0.3) / 0.6); if (below <= 0) continue;
          const Q = []; for (let x = -9; x <= 9.001; x += 0.45) Q.push(V([x, yb - 0.04 * Math.sin(x * 2.6 + z * 3.1), z]));
          const a = fogA(z - camZ) * A * below, first = Q[0], last = Q[Q.length - 1]; if (!first || !last) continue;
          polyline(Q, Q.length); ctx.lineTo(last[0], H * 2); ctx.lineTo(first[0], H * 2); ctx.closePath(); ctx.fillStyle = mixC(SEA.sand, kS, 0.5 * a); ctx.fill();
          ctx.strokeStyle = mixC(SEA.ripple, kS, 0.45 * a); ctx.lineWidth = 1; polyline(Q, Q.length); ctx.stroke();
        }
        for (const rk of rocks) {
          if (!inR(rk.z) || !near(rk.z, 16)) continue; const by = bedAt(rk.z), q = V([rk.x, by, rk.z]); if (!q) continue;
          const rx = rk.r * F3 / q[2], a = fogA(q[2]) * A, k = passed(rk.z);
          ctx.fillStyle = mixC(ROCK[rk.c], k, 0.9 * a); ctx.beginPath(); ctx.ellipse(q[0], q[1], rx, rx * 0.6, 0, Math.PI, 0); ctx.fill();
          if (rk.coral) { ctx.strokeStyle = mixC(CORAL, k, 0.9 * a); ctx.lineWidth = clamp(1.8 * AHEAD / q[2], 0.6, 4); for (let j = -1; j <= 1; j++) { const b0 = V([rk.x + j * rk.r * 0.35, by - rk.r * 0.5, rk.z]), b1 = V([rk.x + j * rk.r * 0.6, by - rk.r * 1.25, rk.z]), b2 = V([rk.x + j * rk.r * 0.2, by - rk.r * 1.05, rk.z]); if (!b0 || !b1 || !b2) continue; ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.moveTo((b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2); ctx.lineTo(b2[0], b2[1]); ctx.stroke(); } }
        }
        for (const kp of kelp) {
          if (!inR(kp.z) || !near(kp.z, 16) || penZ < kp.z - 9) continue;
          const dz = kp.z - camZ, k = passed(kp.z), a = fogA(dz) * A, by = bedAt(kp.z), Q = [], sway = (tt) => Math.sin(tt * 5 + kp.ph + t * 1.1) * 0.12 * tt;
          for (let tt = 0; tt <= 1.001; tt += 0.08) Q.push(V([kp.x + sway(tt), by - kp.h * tt, kp.z]));
          ctx.strokeStyle = mixC(KELP, k, 0.85 * a); ctx.lineWidth = clamp(3.4 * AHEAD / dz, 0.8, 6); polyline(Q, Q.length); ctx.stroke();
          ctx.fillStyle = mixC(KELP, k, 0.75 * a);
          for (let j = 1; j <= 5; j++) { const tt = j / 6, q = V([kp.x + sway(tt), by - kp.h * tt, kp.z]); if (!q) continue; const L = 0.17 * F3 / dz, side = j % 2 ? 1 : -1; ctx.beginPath(); ctx.ellipse(q[0] + side * L * 0.55, q[1] - L * 0.2, L * 0.6, L * 0.2, side * -0.6, 0, Math.PI * 2); ctx.fill(); }
        }
        for (const f of fish) {
          if (!inR(f.z) || !near(f.z, 14) || penZ < f.z - 9) continue;
          const x = ((f.x0 + f.dir * t * 0.22 + 7) % 14 + 14) % 14 - 7, q = V([x, f.y + Math.sin(t * 1.3 + f.ph) * 0.04, f.z]); if (!q) continue;
          const L = f.sz * F3 / q[2], a = fogA(q[2]) * A * (1 - 0.6 * dkAt(f.z)), d = f.dir, wig = Math.sin(t * 9 + f.ph) * 0.25;
          ctx.fillStyle = mixC(FISH[f.c], passed(f.z), 0.9 * a);
          ctx.beginPath(); ctx.ellipse(q[0], q[1], L, L * 0.42, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(q[0] - d * L * 0.8, q[1]); ctx.lineTo(q[0] - d * L * 1.55, q[1] - L * (0.45 + wig * 0.3)); ctx.lineTo(q[0] - d * L * 1.55, q[1] + L * (0.45 - wig * 0.3)); ctx.closePath(); ctx.fill();
        }
        // jellyfish, glowing more the darker it gets
        for (const j of jellies) {
          if (!inR(j.z) || !near(j.z, 14)) continue;
          const q = V([j.x, j.y + Math.sin(t * 0.9 + j.ph) * 0.08, j.z]); if (!q) continue;
          const R = j.r * F3 / q[2], a = fogA(q[2]) * A, c = JELLY[j.c], dk = dkAt(j.z), pl = 1 + 0.1 * Math.sin(t * 2 + j.ph);
          if (dk > 0.15) { const gl = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R * 2.8); gl.addColorStop(0, `rgba(${c},${0.4 * dk * a})`); gl.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gl; ctx.fillRect(q[0] - R * 2.8, q[1] - R * 2.8, R * 5.6, R * 5.6); }
          ctx.fillStyle = `rgba(${c},${0.8 * a})`; ctx.beginPath(); ctx.ellipse(q[0], q[1], R * pl, R * 0.8, 0, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = `rgba(${c},${0.65 * a})`; ctx.lineWidth = clamp(R * 0.08, 0.6, 2);
          for (let n = 0; n < 4; n++) { const x0 = q[0] + (n - 1.5) * R * 0.45 * pl; ctx.beginPath(); ctx.moveTo(x0, q[1]); for (let s2 = 1; s2 <= 8; s2++) ctx.lineTo(x0 + Math.sin(s2 * 0.9 + t * 2 + n + j.ph) * R * 0.14, q[1] + s2 * R * 0.3); ctx.stroke(); }
        }
        for (const bb of bubbles) {
          if (!inR(bb.z) || !near(bb.z, 12) || penZ < bb.z - 6) continue;
          const by = bedAt(bb.z), rise = reduce ? bb.off : (bb.off + T * 0.08) % 1, y = by - rise * (by - SURF - 0.1);
          const q = V([bb.x + Math.sin(T + bb.off * 9) * 0.03, y, bb.z]); if (!q) continue;
          const r = bb.r * F3 / q[2], a = fogA(q[2]) * A;
          ctx.fillStyle = `rgba(255,255,255,${0.3 * a})`; ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        // glowing plankton in the dark, and specks drifting down that twinkle like the stars to come
        for (const g of glows) {
          if (!inR(g.z) || !near(g.z, 16)) continue; const q = V([g.x, g.y, g.z]); if (!q) continue;
          const a = A * fogA(q[2]) * dkAt(g.z) * (reduce ? 0.7 : 0.45 + 0.55 * Math.sin(t * 1.7 + g.s * 40)); if (a < 0.03) continue;
          const r = clamp(2.4 * AHEAD / q[2], 0.8, 3.4); ctx.fillStyle = `rgba(${GLOW[g.c]},${a})`; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgb(255,255,255)';
        for (const sn of snow) {
          if (!inR(sn.z) || !near(sn.z, 10)) continue; const q = V([sn.x + Math.sin(t * 0.4 + sn.ph * 6) * 0.05, sn.y + ((sn.ph + t * 0.02) % 1) * 0.5, sn.z]); if (!q) continue;
          const r = clamp(1.6 * AHEAD / q[2], 0.6, 2.6), dk = dkAt(sn.z); ctx.globalAlpha = A * fogA(q[2]) * clamp((sn.z - ZS) / 3) * (0.55 + 0.35 * dk * (reduce ? 0 : Math.sin(t * 2 + sn.ph * 30))); ctx.fillRect(q[0], q[1], r, r);
        }
        ctx.globalAlpha = 1;
        for (let i = surf.length - 1; i >= 0; i--) {
          const sv = surf[i]; if (!inR(sv.z) || !near(sv.z, 12)) continue;
          const dz = sv.z - camZ, reveal = clamp((penZ - (sv.z - 8)) / 2); if (reveal <= 0) continue;
          const Q = []; for (let x = -8; x <= 8.001; x += 0.25) Q.push(V([x, SURF + 0.05 * Math.sin(x * 2.1 + sv.ph + t * 0.9), sv.z]));
          ctx.strokeStyle = `rgba(255,255,255,${0.75 * fogA(dz) * A})`; ctx.lineWidth = clamp(2 * AHEAD / dz, 0.5, 3); polyline(Q, Math.max(2, Math.round(reveal * Q.length))); ctx.stroke();
        }
        return;
      }
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
    // a phone at each change of world: it comes flying along the line from far ahead, turning to face the visitor,
    // faster and faster, and the visitor is drawn into its screen. Through the screen the next world is really there,
    // seen from the same camera, so when the screen fills the view it simply is the next scene. P_RUN is how far the
    // camera travels while the phone comes; it ends at the camera position where the world changes (zc: where the
    // next world begins along the line, kept for reference by the callers).
    const P_RUN = 3.2;
    function portal(id, Xc, zc, drawNext, nextRGB, A) {
      const p = clamp((camZ - (Xc - P_RUN)) / P_RUN);
      if (p <= 0) { drawLine(-1e9, penZ, lineRGB, A); drawTip(lineRGB, A); drawLead(A); return; }
      const dzP = 14 * (1 - p) * (1 - p) + 0.15, s3 = F3 / dzP, show = ease(p / 0.12), dark = id === 'space';
      // it flies in along the line, the line through the middle of its screen, and ends square in the middle
      const zP = camZ + dzP, an = V(pathAt(zP)) || [W / 2, H * 0.5], k = ease((p - 0.68) / 0.3), cx = lerp(an[0], W / 2, k), cy = lerp(an[1], H * 0.5, k);
      const roll = (1 - ease(p / 0.75)) * 0.42 * (dark ? -1 : 1), yaw = (1 - ease(p / 0.72)) * 1.05 * (dark ? 1 : -1), t = reduce ? 0 : T;
      const w = 0.98 * s3, h = 2.02 * s3, m = 0.06 * s3, D = Math.hypot(W, H);
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
      // being drawn in: streaks of light running into the screen
      const st = clamp((p - 0.45) / 0.4) * (1 - clamp((p - 0.93) / 0.07));
      if (st > 0 && !reduce) {
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 22; i++) {
          const ang = i * 2.39996, ph = (t * 1.3 + i * 0.37) % 1, r0 = lerp(0.62, 0.2, ph) * D, r1 = r0 + 0.1 * D;
          ctx.strokeStyle = dark ? `rgba(220,226,255,${0.32 * st * (1 - ph)})` : `rgba(255,255,255,${0.7 * st * (1 - ph)})`;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1); ctx.stroke();
        }
      }
      ctx.save();
      ctx.globalAlpha = show;
      if (dark) { const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.9); gl.addColorStop(0, `rgba(200,206,255,${0.28 * A})`); gl.addColorStop(1, 'rgba(200,206,255,0)'); ctx.fillStyle = gl; ctx.fillRect(cx - h, cy - h, h * 2, h * 2); }
      // the body, a side button, a rim catching the light
      ctx.fillStyle = `rgba(${INK},${A})`; rr(-w / 2, -h / 2, w, h, 0.17 * s3); ctx.fill();
      ctx.strokeStyle = dark ? `rgba(196,200,214,${0.8 * A})` : `rgba(255,255,255,${0.28 * A})`; ctx.lineWidth = Math.max(1, 0.012 * s3); ctx.stroke();
      ctx.fillStyle = `rgba(${INK},${A})`; rr(w / 2 - 0.004 * s3, -h * 0.22, 0.03 * s3, h * 0.12, 0.01 * s3); ctx.fill();
      rr(-w / 2 + m, -h / 2 + m, w - 2 * m, h - 2 * m, 0.11 * s3); ctx.clip();
      // the next world, from the same camera
      ctx.fillStyle = `rgba(251,251,250,${A})`; ctx.fillRect(0, 0, W, H);
      drawNext();
      if (penZ > zP) { drawLine(zP, penZ, nextRGB, A); drawTip(nextRGB, A); }
      // the island at the top of the screen, while the phone is still a phone
      ctx.fillStyle = `rgba(${INK},${A * (1 - clamp((p - 0.8) / 0.12))})`; rr(-0.14 * s3, -h / 2 + m + 0.04 * s3, 0.28 * s3, 0.07 * s3, 0.035 * s3); ctx.fill();
      ctx.restore();
      // this side of the phone: the line runs into it
      drawLine(-1e9, Math.min(penZ, zP), lineRGB, A);
      if (penZ <= zP) drawTip(lineRGB, A);
      drawLead(A);
    }
    function drawWorld(A) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (camZ < ZS) {
        // the land, then up into the sky; the sky takes on the colour of the sea under its surface, the land falls
        // away below, and what lies ahead is already the sea, seen as sky
        const rise = ease((camZ - 6.5) / (ZS - 0.4 - 6.5)), fade = 1 - ease((camZ - 8.5) / (ZS - 0.6 - 8.5));
        backdrop(0, A);
        // (only what could pass for sky: the light, the bright streaks of the surface, specks)
        if (rise > 0) { seaBackdrop(A * rise); elements(1, A * rise, ZS, SINK + 1); }
        if (fade > 0) elements(0, A * fade);
        portal('sea', ZS, ZS, () => { backdrop(1, A); elements(1, A, ZS, SINK + 1); }, INK, A);
        return;
      }
      if (camZ < X2) {
        // the sea sinks into the dark; the life of the sea shows only once the line has begun to sink
        backdrop(1, A);
        elements(1, A, -1e9, SINK + 1); elements(1, A * ease((camZ - ZS) / 1.6), SINK + 1);
        portal('space', X2, S0, () => { backdrop(2, A); elements(2, A); }, '244,244,252', A);
        return;
      }
      backdrop(2, A); elements(2, A);
      drawLine(-1e9, penZ, lineRGB, A); drawTip(lineRGB, A); drawLead(A);
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
      const Rf = NARROW ? Math.min(W * 0.34, H * 0.2) : Math.min(W * 0.26, H * 0.37), size = NARROW ? clamp(W * 0.2, 60, 88) : clamp(H * 0.14, 92, 128);
      const cy0 = NARROW ? H * 0.31 : H * 0.5;
      cur = { cx: NARROW ? W / 2 : W * 0.36, cy: cy0, cy0, F: Rf * VIEW, size, Rf };
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
      const dive = ease((lr - 0.02) / 0.1), out = ease((lr - 0.92) / 0.08);
      // diving: from above the groove (a flat spiral) down into it; leaving: past the last note into the label
      const camZ = lerp(-VIEW - 2.2, focusZ - VIEW, dive) + out * 3.5;
      cur.cx = lerp(W / 2, NARROW ? W / 2 : W * 0.36, dive); cur.cy = cur.cy0;
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
      const near = Math.abs(k - i) < 0.32 && lr > 0.1 && lr < 0.92 && !list && !NARROW ? i : -1;
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
      const flush = () => { if (run.length > 1) { ctx.lineWidth = wPrev; ctx.lineCap = aPrev < 1 ? 'butt' : 'round'; ctx.strokeStyle = `rgba(${lineRGB},${aPrev})`; ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); for (let n = 1; n < run.length; n++) ctx.lineTo(run[n][0], run[n][1]); ctx.stroke(); } };
      for (let z = z0; z <= z1; z += 0.04) {
        const p = proj((z / DZ) * TURN, z, camZ, roll, lineRad(l, z)); if (!p) continue;
        // still one line before it splits: as thick as the pen line it continues
        const wd = Math.round(clamp(width * VIEW / p[2] * (1 + 1.4 * (1 - splitAt(z))), 0.4, 3.2) * 4) / 4, al = Math.round(0.85 * alpha * behind(p[2]) * clamp((FAR - p[2]) / 6) * 20) / 20;
        if (wd !== wPrev || al !== aPrev) { const last = run[run.length - 1]; flush(); run = last ? [last] : []; wPrev = wd; aPrev = al; }
        run.push(p);
      }
      flush(); ctx.lineCap = 'round';
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
    function showReadout(i) {
      const w = bySlug[items[i].dataset.slug];
      items.forEach((li, j) => li.classList.toggle('cur', j === i));
      $('#jy-ro-i').textContent = String(i + 1).padStart(2, '0');
      $('#jy-ro-t').textContent = w.title; $('#jy-ro-a').textContent = w.artist;
      $('#jy-ro-m').textContent = [w.type, w.date].filter(Boolean).join(' · ');
      $('#jy-ro-r').textContent = roleLine(w.roles);
      $('#jy-ro-play').hidden = !sourceOf(w);
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
      mprog.style.transform = `scaleX(${clamp(u / TOTAL)})`;
      if (ch !== chapter) { chapter = ch; syncInert(); mchap.textContent = COPY.rail[railOf[ch]] || ''; if (ch !== 'record' && sheet === 'filters') setSheet(null); rail.forEach((a) => { if (a.dataset.go === railOf[ch]) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); }); }
      // Prologue: fall into the phone
      const ip = clamp(local(u, 'pro')), cover = Math.max(W / 224, H / 504) * 1.08;
      const ps = NARROW ? Math.min(1, (H * 0.47) / 520, (W - 40) / 240) : 1;
      phone.style.transform = `translateX(${NARROW ? 0 : -W * 0.14 * (1 - ease(ip / 0.35))}px) scale(${ps * Math.pow(cover / ps, ease((ip - 0.3) / 0.7))})`;
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
      // (in the sea, around how deep the line is there, and a little further down while it sinks fast)
      const pc = pathAt(penZ - 1.2), base = baseAt(penZ - 1.2);
      camX = lerp(pc[0] * 0.35, 0, ck); camY = lerp((pc[1] - base) * 0.7 + base - 0.45 + 0.6 * (baseAt(penZ) - base), YS, ck);
      placeAnchors();
      // how dark the scene is: the deep sea, then the night sky, until the record
      spaceDark = Math.max(spaceIn(), camZ > ZS ? clamp((dkAt(camZ + 2) - 0.3) / 0.35) : 0) * spaceFade();
      { const m = (c0, c1) => Math.round(lerp(c0, c1, spaceDark)); lineRGB = `${m(20, 244)},${m(28, 244)},${m(48, 252)}`; }
      const caseWork = CASE && bySlug[CASE];
      if (caseWork) { if (lc > 0.04 && lc < 1) { setOffer(caseWork); caseOffer = true; } else if (caseOffer) { caseOffer = false; setOffer(null); } }
      // Record: the dive into the current
      const lr = local(u, 'record'), ld = local(u, 'done'), le = local(u, 'epi');
      const inRecord = lr > 0 && lr < 1;
      on(recordEl, inRecord); on($('#jy-filters'), lr > 0.1 && lr < 0.93); on(fbtn, lr > 0.1 && lr < 0.93); on(readout, lr > 0.1 && lr < 0.93);
      on($('#jy-found'), (lm > 0.88 && lm < 1.1 && lr <= 0) || (lr > 0 && lr < 0.06)); on($('#jy-hint'), lr > 0.05 && lr < 0.18);
      if (inRecord) { recK = clamp((lr - 0.1) / 0.82) * (N - 1); placeCurrent(lr); }
      else if (spiral.style.opacity !== '0') { spiral.style.opacity = '0'; Object.values(trackEls).forEach((box) => box.classList.remove('on')); albumOpen = -1; }
      // Done: out of the current, the phone is seen from outside, the record in it
      const ink = le > 0 || spaceDark > 0.5;
      stageEl.classList.toggle('ink', ink); html.classList.toggle('jy-ink', ink);
      markImg.src = ink ? markImg.dataset.paper : markImg.dataset.ink;
      on($('#jy-letter'), ld > 0.1 && ld < 0.92);
      if (lr > 0.8 && !recBuilt) buildRecordWash();
      // the phone (520px with its charm below) keeps inside short screens
      const RR = Math.min(W, H) * 0.34, FS = NARROW ? Math.min(1, (H * 0.6) / 590) : Math.min(1, (H - 110) / 590);
      if (ld > 0 && le <= 0) {
        const s0 = (2 * RR) / 192, s = lerp(s0, FS, ease(ld / 0.7));
        frame.style.opacity = String(ease(ld / 0.25)); frame.style.transform = `scale(${s})`; frame.style.left = '50%'; frame.style.top = NARROW ? lerp(50, 43, ease(ld / 0.7)) + '%' : '50%';
        const chrome = ld >= 0.35; frame.style.background = chrome ? '' : 'transparent'; frame.style.boxShadow = chrome ? '' : 'none'; frameScr.style.background = chrome ? '' : 'transparent';
      } else if (le > 0) {
        frame.style.opacity = NARROW ? String(1 - ease((le - 0.22) / 0.12)) : '1'; frame.style.transform = `scale(${NARROW ? FS : lerp(FS, Math.min(1.25, (H - 70) / 590), ease(le / 0.3))})`; frame.style.left = NARROW ? '50%' : '72%'; frame.style.top = '50%';
        frame.style.background = ''; frame.style.boxShadow = ''; frameScr.style.background = '';
      } else frame.style.opacity = '0';
      // Epilogue
      on($('#jy-empty'), le > 0.05 && le < 0.3);
      on($('#jy-contact'), le > 0.32);

      // ---- canvas ----
      ctx.clearRect(0, 0, W, H);
      if (inRecord) drawCurrent(lr);
      const worldA = (ip > 0.8 ? ease((ip - 0.8) / 0.2) : 0) * (1 - ease(lr / 0.06));
      if (worldA > 0) drawWorld(worldA);
    }
    function resize() {
      W = innerWidth; H = innerHeight; NARROW = W < 761 || H > W * 1.05; HZ = NARROW ? 0.38 : 0.46;
      html.classList.toggle('jy-narrow', NARROW);
      DPR = Math.min(NARROW ? 1.75 : 2, devicePixelRatio || 1);
      cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildWorld(); buildCurrent(); ANCHORS.forEach((a) => { a.w = 0; }); recShown = -1;
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
