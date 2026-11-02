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
  const CH = { pro: [0, 1], tale: [1, 2.4], tone: [2.4, 4.4], case: [4.4, 5.8], music: [5.8, 8.2], record: [8.2, 12.2], done: [12.2, 13.1], epi: [13.1, 14.1] };
  const TOTAL = 14.1;
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
    const wash = document.createElement('canvas'), wctx = wash.getContext('2d');
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
    let palette = [], blots = [];
    let line = [], accents = [], trail = [], knot = 0, poles = [], layers = [], grass = [], clouds = [], dots = [], pts = null;
    let wireA = 1, cam = 0, recBuilt = false, chapter = '', caseOffer = false, caseLaid = false, casePath = null;
    // the case's path: from under her request (top right) down to our answer (bottom left), an S of the pen
    const caseReq = $('#jy-case-req'), caseAns = $('#jy-case-ans'), caseMarks = [$('#jy-case-m0'), $('#jy-case-m1')];
    const bez = (p, t) => { const u2 = 1 - t; return [0, 1].map((k) => u2 * u2 * u2 * p[0][k] + 3 * u2 * u2 * t * p[1][k] + 3 * u2 * t * t * p[2][k] + t * t * t * p[3][k]); };
    function placeCase(lc) {
      if (!caseReq) return;
      if (!caseLaid) {
        caseLaid = true;
        caseReq.style.setProperty('--x', W * 0.5 + 'px'); caseReq.style.setProperty('--y', H * 0.16 + 'px');
        caseAns.style.setProperty('--x', W * 0.07 + 'px'); caseAns.style.setProperty('--y', H * 0.6 + 'px');
        const rh = caseReq.offsetHeight || 90;
        const a = [W * 0.5 + 60, H * 0.16 + rh + 6], b = [W * 0.07 + 70, H * 0.6 - 10];
        casePath = [a, [a[0] + W * 0.22, a[1] + H * 0.1], [b[0] + W * 0.34, b[1] - H * 0.02], b];
        caseMarks.forEach((m, n) => { const q = bez(casePath, n ? 0.66 : 0.3); m.style.setProperty('--x', q[0] + 'px'); m.style.setProperty('--y', q[1] + 'px'); });
      }
      const pen = clamp((lc - 0.14) / 0.56);
      on(caseReq, lc > 0.04); on(caseMarks[0], pen >= 0.3); on(caseMarks[1], pen >= 0.66); on(caseAns, pen >= 1);
    }
    function drawCase(lc) {
      if (!casePath || !caseLaid) return;
      const pen = clamp((lc - 0.14) / 0.56), fade = 1 - ease((lc - 0.94) / 0.08);
      if (pen <= 0 || fade <= 0) return;
      ctx.strokeStyle = `rgba(${INK},${fade})`; ctx.lineCap = 'round'; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let t = 0; t <= pen + 1e-6; t += 0.01) { const q = bez(casePath, Math.min(t, pen)); t ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.stroke();
      [0.3, 0.66].forEach((t) => { if (pen < t) return; const q = bez(casePath, t); ctx.fillStyle = `rgba(${INK},${fade})`; ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, Math.PI * 2); ctx.fill(); });
      if (pen < 1) { const q = bez(casePath, pen); ctx.beginPath(); ctx.arc(q[0], q[1], 3.2, 0, Math.PI * 2); ctx.fill(); }
    }
    const CASE = ($('.jy-case-btn') || {}).dataset ? $('.jy-case-btn').dataset.open : null;
    const rail = $$('.jy-rail a'), railOf = { pro: 'pro', tale: 'tale', tone: 'tone', case: 'tone', music: 'tone', record: 'record', done: 'record', epi: 'epi' };

    const U = () => { const m = document.documentElement.scrollHeight - innerHeight; return m > 0 ? (scrollY / m) * TOTAL : 0; };
    const topFor = (u) => (u / TOTAL) * (document.documentElement.scrollHeight - innerHeight);
    const goU = (u, smooth = true) => scrollTo({ top: topFor(u), behavior: smooth && !reduce ? 'smooth' : 'auto' });

    // clock on the lock screen
    { const d = new Date(), loc = { kr: 'ko-KR', en: 'en-US', jp: 'ja-JP' }[LANG];
      $('#jy-clock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      try { $('#jy-date').textContent = d.toLocaleDateString(loc, { month: 'long', day: 'numeric', weekday: 'long' }); } catch (_) {} }

    /* ---- camera: depth z; the scroll walks forward ---- */
    const CX = () => W / 2, CY = () => H * 0.5;
    const sc = (z, c = cam) => z / Math.max(0.05, z - c);
    const P = (p, c = cam) => { const s = sc(p[2], c); return [CX() + (p[0] - CX()) * s, CY() + (p[1] - CY()) * s, s]; };

    /* ---- one landscape skeleton: the bones are ours, the colour is theirs ---- */
    const HILL = {
      near: { z: 1.6, y: (x) => 0.75 + 0.045 * Math.sin(x * 3.1 + 0.4) + 0.018 * Math.sin(x * 7.3) },
      mid: { z: 2.5, y: (x) => 0.625 + 0.04 * Math.sin(x * 2.3 + 1.6) + 0.014 * Math.sin(x * 9.1) },
      far: { z: 4, y: (x) => { const pk = (c, w, h) => { const d = Math.abs(x - c) / w; return d >= 1 ? 0 : h * Math.pow(0.5 + 0.5 * Math.cos(Math.PI * d), 1.1); }; return 0.53 - Math.max(pk(0.12, 0.2, 0.13), pk(0.38, 0.17, 0.09), pk(0.7, 0.24, 0.15), pk(0.98, 0.18, 0.1)) - 0.012 * Math.sin(x * 23); } },
    };
    // the signature songs (pinned in the data) bring the colours
    const pinned = WORKS.filter((w) => w.pinned).sort((a, b) => a.pinned - b.pinned);
    Promise.all(pinned.map(sample)).then(() => { palette = pinned.map((w, i) => ({ slug: w.slug, c: colorOf[w.slug], s: 1 - i * 0.1 })).filter((p) => p.c); });
    const startPoint = () => [W * 0.22, H * 0.86];
    function spline(ctrl, n, z) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1)) * (ctrl.length - 1), k = Math.min(ctrl.length - 2, Math.floor(t)), f = t - k;
        const p0 = ctrl[Math.max(0, k - 1)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(ctrl.length - 1, k + 2)];
        const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f * f + (-a + 3 * b - 3 * cc + d) * f * f * f);
        out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), z]);
      }
      return out;
    }
    const hillPts = (name, from, to, n) => { const h = HILL[name], o = []; for (let i = 0; i < n; i++) { const x = lerp(from, to, i / (n - 1)); o.push([x * W, h.y(x) * H, h.z]); } return o; };
    function buildLine() {
      const [sx, sy] = startPoint();
      const PX = [0.04, 0.28, 0.52, 0.76, 1.0].map((v) => v * W), PY = H * 0.28, SAG = H * 0.075, ZP = 1.3;
      // rise: from the chosen reply up to the first pole, with a slack loop the winder keeps
      const rise = spline([[sx, H * 1.08], [sx, sy], [lerp(sx, PX[0], 0.45), H * 0.7], [W * 0.1, H * 0.5], [PX[0], PY]], 240, ZP);
      const li = Math.round(rise.length * 0.62), a = rise[li], b = rise[li + 3], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), rr = 20, loop = [];
      for (let j = 1; j < 56; j++) { const th = (j / 56) * Math.PI * 2, cx = a[0] - Math.sin(ang) * rr, cy = a[1] + Math.cos(ang) * rr; loop.push([cx + Math.sin(ang + th) * rr, cy - Math.cos(ang + th) * rr, ZP]); }
      rise.splice(li, 0, ...loop);
      line = [...rise]; knot = Math.round(rise.length * 0.3);
      // the wire between poles: the works were already hanging here
      poles = [{ x: PX[0], i: line.length - 1 }]; const mids = [];
      for (let k = 0; k < 4; k++) { for (let j = 1; j <= 120; j++) { const f = j / 120; line.push([lerp(PX[k], PX[k + 1], f), PY + SAG * 4 * f * (1 - f), ZP, 4 * f * (1 - f), k]); if (j === 60) mids.push(line.length - 1); } poles.push({ x: PX[k + 1], i: line.length - 1 }); }
      poles.forEach((p) => { p.top = PY; p.base = HILL.near.y(p.x / W) * H + H * 0.04; });
      // then the land, back and forth like one stroke of a pen
      line.push(...spline([[PX[4], PY], [W * 1.08, H * 0.5], [W * 1.08, HILL.near.y(1.08) * H]], 40, ZP).slice(1));
      const nearStart = line.length; line.push(...hillPts('near', 1.08, -0.08, 320));
      line.push(...hillPts('mid', -0.08, 1.08, 320));
      line.push(...hillPts('far', 1.08, -0.08, 320));
      layers = ['far', 'mid', 'near'].map((n) => ({ n, z: HILL[n].z, pts: hillPts(n, -0.1, 1.1, 90) }));
      grass = [];
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let xf = -0.04; xf <= 1.04; xf += 0.012 + rnd() * 0.03) { const m = 2 + ((rnd() * 3) | 0); for (let q = 0; q < m; q++) { const x = xf + q * 0.0035, yb = HILL.near.y(x) * H; grass.push({ x: x * W, y: yb + 1, h: (q === 1 ? 14 : 6) + rnd() * 10, lean: (q - 1) * 3 + (rnd() - 0.5) * 2, i: nearStart + Math.round(clamp((1.08 - x) / 1.16) * 319) }); } }
      clouds = [[0.2, 0.17, 0.13, 0.86], [0.6, 0.13, 0.17, 0.89], [0.88, 0.21, 0.1, 0.92]].map(([cx, cy, w, a], ci) => {
        const pts2 = [], bx = [[-0.36, 0.13], [-0.18, 0.22], [0.04, 0.3], [0.25, 0.22], [0.4, 0.12]], X = cx * W, Y = cy * H, Wd = w * W;
        for (let j = 0; j <= 80; j++) { const x = -0.5 + j / 80; let top = 0; for (const [b2, r] of bx) { const d = x - b2; if (Math.abs(d) < r) top = Math.max(top, Math.sqrt(r * r - d * d)); } pts2.push([X + x * Wd, Y - top * Wd * 1.05, 5]); }
        for (let j = 1; j <= 20; j++) { const x = 0.5 - j / 20; pts2.push([X + x * Wd, Y + Math.sin((j / 20) * Math.PI) * 4, 5]); }
        return { pts: pts2, a, b: a + 0.05, ci };
      });
      accents = mids.slice(0, 3).map((idx) => idx / (line.length - 1));
      // the messages of the philosophy are left where the pen passes: the creed on the rise, the steps on the swells
      trail = [[Math.round(li * 0.45), '#jy-creed'], ...mids.slice(0, 3).map((idx, n) => [idx, '#jy-step-' + n])].map(([i, sel]) => ({ i, el: $(sel) })).filter((a) => a.el);
    }
    function buildDots() { const n = W <= 760 ? DOTS.narrow : DOTS.wide; dots = []; for (let i = 0; i < n; i++) dots.push({ x: lerp(-0.3, 1.3, Math.random()) * W, y: lerp(-0.05, 1.05, Math.random()) * H, z: lerp(1.2, 6, Math.random()), t: Math.random(), s: Math.random() }); }

    function paintBlot(b, k, c = wctx) {
      const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * k);
      g.addColorStop(0, `rgba(${b.c},${b.a})`); g.addColorStop(0.7, `rgba(${b.c},${b.a * 0.6})`); g.addColorStop(1, `rgba(${b.c},0)`);
      c.fillStyle = g; c.beginPath();
      for (let j = 0; j <= 18; j++) { const an = (j / 18) * Math.PI * 2, rr = b.r * k * (0.8 + 0.25 * Math.sin(an * 3 + b.x)), x = b.x + Math.cos(an) * rr, y = b.y + Math.sin(an) * rr; j ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.fill();
    }
    const redrawWash = () => { wctx.clearRect(0, 0, W, H); for (const b of blots) if (b.done) paintBlot(b, 1); };

    /* ---- the hills fill with the colours they were brought ---- */
    const layerColour = (i) => { const p = [...palette].sort((a, b) => b.s - a.s); const fall = [[176, 178, 184], [163, 168, 181], [159, 161, 166]]; return (p[i % Math.max(1, p.length)] || { c: fall[i % 3] }).c; };
    function facePath(L) { ctx.beginPath(); L.pts.forEach((p, i) => { const q = P(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); const e = P(L.pts[L.pts.length - 1]), s0 = P(L.pts[0]); ctx.lineTo(e[0], H * 3); ctx.lineTo(s0[0], H * 3); ctx.closePath(); }
    function drawFaces(k, alpha) {
      if (alpha <= 0 || k <= 0) return;
      const ks = ease((k - 0.3) / 0.5);
      if (ks > 0) { const c = layerColour(3), g = ctx.createLinearGradient(0, 0, 0, H * 0.6); g.addColorStop(0, `rgba(${c},${0.3 * ks * alpha})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.6); }
      const delay = { near: 0, mid: 0.18, far: 0.36 };
      layers.forEach((L, li) => {
        const kk = ease((k - delay[L.n]) / 0.5); if (kk <= 0) return;
        const c = layerColour(2 - li);
        facePath(L); const top = P(L.pts[45])[1], g = ctx.createLinearGradient(0, top - 40, 0, top + H * 0.45);
        g.addColorStop(0, `rgba(${c},${0.42 * kk * alpha})`); g.addColorStop(1, `rgba(${c},${0.14 * kk * alpha})`); ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); L.pts.forEach((p, i) => { const q = P(p); i ? ctx.lineTo(q[0], q[1] + 3) : ctx.moveTo(q[0], q[1] + 3); }); ctx.strokeStyle = `rgba(${c},${0.35 * kk * alpha})`; ctx.lineWidth = 5; ctx.stroke();
      });
    }
    function drawClouds(rv, k, alpha) {
      for (const c of clouds) {
        const g = clamp((rv - c.a) / (c.b - c.a)); if (g <= 0) continue;
        const dx = reduce ? 0 : Math.sin(T * 0.08 + c.ci * 2) * 24;
        const Q = c.pts.map((p) => P([p[0] + dx, p[1], p[2]])), n = Math.max(2, Math.round(g * Q.length));
        if (k > 0 && g >= 1) {
          const col = layerColour(1); ctx.beginPath(); Q.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
          const top = Math.min(...Q.map((q) => q[1])), bot = Math.max(...Q.map((q) => q[1])), gr = ctx.createLinearGradient(0, top, 0, bot);
          gr.addColorStop(0, `rgba(254,254,254,${0.97 * k * alpha})`); gr.addColorStop(0.6, `rgba(254,254,254,${0.9 * k * alpha})`); gr.addColorStop(1, `rgba(${col},${0.22 * k * alpha})`); ctx.fillStyle = gr; ctx.fill();
        }
        ctx.strokeStyle = `rgba(${INK},${alpha * 0.85})`; ctx.lineWidth = 1.3 * Q[0][2]; ctx.lineJoin = 'round'; ctx.beginPath();
        for (let i = 0; i < n; i++) { const q = Q[i]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
        ctx.stroke();
      }
    }
    // the line swells near the works, like a crescendo, and thins where it rests
    function drawLine(rv, alpha) {
      if (alpha <= 0) return;
      const n = Math.max(2, Math.round(rv * (line.length - 1)));
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const Q = line.map((p) => { const q = P(p); if (p[3] && !reduce) q[1] += Math.sin(T * 1.3 + p[4] * 1.7) * 5 * p[3] * q[2]; return q; });
      ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(${INK},${alpha * 0.8})`; ctx.beginPath();
      for (const g of grass) { if (g.i > n) continue; const a = P([g.x, g.y, 1.6]), s = a[2], sw = reduce ? 0 : Math.sin(T * 1.8 + g.x * 0.03) * 3; ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(a[0] + g.lean * s * 0.5, a[1] - g.h * s * 0.6, a[0] + (g.lean + sw) * s, a[1] - g.h * s); }
      ctx.stroke();
      for (let i = 1; i < n; i += 3) {
        const j = Math.min(n - 1, i + 3), t = i / (line.length - 1);
        let w = 1.5; for (const a of accents) w += 2.2 * Math.exp(-Math.pow((t - a) / 0.03, 2));
        w *= clamp(Q[i][2], 1, 3) * (line[i][2] >= 4 ? 0.75 : 1);
        const B = (k) => (reduce ? 0 : Math.sin(T * 6 + k * 0.08) * 0.45);
        ctx.strokeStyle = `rgba(${INK},${alpha * (line[i][2] < 1.5 ? wireA : 1)})`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(Q[i - 1][0], Q[i - 1][1] + B(i - 1));
        for (let k = i; k <= j; k++) ctx.lineTo(Q[k][0], Q[k][1] + B(k));
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${INK},${alpha * wireA})`;
      for (const p of poles) {
        const g = ease((n - p.i) / 90); if (g <= 0 || wireA <= 0) continue;
        const a = P([p.x, p.top, 1.3]), b = P([p.x, lerp(p.top, p.base, g), 1.3]);
        ctx.lineWidth = 2 * a[2]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        const c1 = P([p.x - 11, p.top + 10, 1.3]), c2 = P([p.x + 11, p.top + 10, 1.3]); ctx.lineWidth = 1.5 * a[2]; ctx.beginPath(); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.stroke();
      }
      if (n > knot + 2 && wireA > 0) {
        ctx.globalAlpha = wireA; const p = Q[knot], q = Q[knot + 3], an = Math.atan2(q[1] - p[1], q[0] - p[0]);
        ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(an); ctx.scale(p[2], p[2]); ctx.fillStyle = `rgba(254,254,254,${alpha})`; ctx.lineWidth = 1.5; ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-13, -8, 26, 16, 8); else ctx.rect(-13, -8, 26, 16);
        ctx.fill(); ctx.stroke(); ctx.fillStyle = `rgba(${INK},${alpha})`; for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.arc(dx, 0, 1.6, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore(); ctx.globalAlpha = 1;
      }
      if (n < line.length - 1) { const p = Q[n]; ctx.fillStyle = `rgba(${INK},${alpha})`; ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2); ctx.fill(); }
    }

    /* ---- the turn: the faces scatter to points, the points curl like the mark, then find the groove ---- */
    const CURL = [[0.55,0.98],[0.617,0.972],[0.682,0.96],[0.744,0.938],[0.797,0.906],[0.845,0.865],[0.883,0.817],[0.908,0.764],[0.919,0.711],[0.914,0.65],[0.893,0.598],[0.858,0.55],[0.81,0.51],[0.754,0.479],[0.692,0.458],[0.627,0.445],[0.559,0.441],[0.491,0.445],[0.428,0.46],[0.369,0.484],[0.315,0.525],[0.281,0.57],[0.26,0.624],[0.26,0.681],[0.286,0.73],[0.334,0.728],[0.357,0.676],[0.418,0.652],[0.476,0.673],[0.498,0.727],[0.466,0.775],[0.412,0.796],[0.338,0.794],[0.274,0.78],[0.213,0.756],[0.158,0.723],[0.113,0.681],[0.081,0.632],[0.062,0.577],[0.056,0.521],[0.065,0.464],[0.085,0.41],[0.115,0.359],[0.154,0.313],[0.201,0.273],[0.256,0.24],[0.317,0.216],[0.381,0.2],[0.448,0.192],[0.515,0.194],[0.581,0.204],[0.646,0.22],[0.712,0.223],[0.762,0.185],[0.758,0.132],[0.751,0.087],[0.812,0.11],[0.862,0.148],[0.897,0.112],[0.923,0.091],[0.943,0.144],[0.948,0.202],[0.938,0.258],[0.909,0.305],[0.855,0.343],[0.79,0.356],[0.724,0.351],[0.658,0.339],[0.619,0.353],[0.683,0.368],[0.746,0.379],[0.821,0.378],[0.88,0.361],[0.93,0.322],[0.961,0.274],[0.976,0.217],[0.975,0.161],[0.961,0.106],[0.933,0.055],[0.885,0.022],[0.873,0.08],[0.833,0.091],[0.774,0.063],[0.711,0.048],[0.658,0.064],[0.707,0.105],[0.738,0.15],[0.708,0.199],[0.642,0.195],[0.579,0.178],[0.512,0.167],[0.442,0.167],[0.378,0.175],[0.314,0.191],[0.254,0.213],[0.197,0.243],[0.143,0.283],[0.101,0.325],[0.066,0.372],[0.041,0.425],[0.027,0.479],[0.023,0.539],[0.033,0.593],[0.056,0.647],[0.09,0.696],[0.135,0.74],[0.186,0.773],[0.247,0.8],[0.31,0.815],[0.385,0.818],[0.445,0.81],[0.499,0.779],[0.525,0.729],[0.51,0.672],[0.46,0.636],[0.395,0.63],[0.338,0.66],[0.296,0.695],[0.286,0.636],[0.304,0.585],[0.339,0.539],[0.391,0.5],[0.452,0.477],[0.518,0.466],[0.586,0.467],[0.651,0.476],[0.714,0.495],[0.771,0.52],[0.828,0.561],[0.863,0.606],[0.883,0.658],[0.886,0.723],[0.873,0.771],[0.844,0.822],[0.803,0.866],[0.75,0.903],[0.691,0.929],[0.628,0.945],[0.557,0.955],[0.496,0.969]];
    function buildPoints() {
      const n = W <= 760 ? TURN_POINTS.narrow : TURN_POINTS.wide; pts = [];
      const LN = Math.round(n * 0.5);
      const vis = line.map((p) => P(p)).filter((q) => q[0] > -80 && q[0] < W + 80 && q[1] > -80 && q[1] < H + 80), src = vis.length > 50 ? vis : line.map((p) => P(p));
      for (let i = 0; i < LN; i++) { const t = i / LN, q = src[Math.round(t * (src.length - 1))]; pts.push({ x0: q[0], y0: q[1], t, ring: true, s: Math.random() }); }
      for (let i = LN, guard = 0; i < n && guard < n * 6; i++, guard++) {
        const li = (Math.random() * layers.length) | 0, L = layers[li], x = Math.random() * W;
        let ey = H; for (let j = 1; j < L.pts.length; j++) { const a = P(L.pts[j - 1]), b = P(L.pts[j]); if (a[0] <= x && b[0] >= x) { ey = lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1)); break; } }
        if (ey >= H) { i--; continue; }
        const y = lerp(Math.max(ey, 0), H, Math.random() * 0.9);
        pts.push({ x0: x, y0: y, t: Math.random(), col: layerColour(2 - li), ring: false, s: Math.random(), rr: 0.42 + Math.random() * 0.56, th: Math.random() * Math.PI * 2 });
      }
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
       at the same place, so the swirl turns around the visitor. The mark stands at the head of the staff as its
       clef. An album in focus lets its tracks out on an earphone cord. */
    const DZ = 0.6, TURN = 0.5, VIEW = 1.5, FOCUS = 0.5, NEAR = 0.25, FAR = 11, GAP = 0.066;
    // depth shrinks the swirl gently (a power below 1), so the far turns open out instead of knotting at the centre
    const OPEN = 0.55, shrink = (dz) => Math.pow(VIEW / dz, OPEN);
    const pitchOf = (i) => Math.round(4 + 3 * Math.sin(i * 0.83 + 0.4)); // 0..8: lines and spaces, bottom to top
    const radiusOf = (p) => 1 + (p - 4) * GAP * 0.5;
    const trackLayer = $('#jy-tracks');
    const clef = new Image(); clef.src = markImg.dataset.ink;
    let cur = null, recK = 0, recShown = -1, flow = [], trackEls = {}, albumOpen = -1;
    function buildCurrent() {
      const Rf = Math.min(W * 0.26, H * 0.37), size = clamp(H * 0.14, 92, 128);
      cur = { cx: W * 0.36, cy: H * 0.5, F: Rf * VIEW, size, Rf };
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
      const dive = ease(lr / 0.1), out = ease((lr - 0.92) / 0.08);
      // diving: from above the groove (a flat spiral) down into it; leaving: past the last note into the label
      const camZ = lerp(-2 - VIEW * Math.pow(cur.Rf / (Math.min(W, H) * 0.34), 1 / OPEN), focusZ - VIEW, dive) + out * 3.5;
      cur.cx = lerp(W / 2, W * 0.36, dive); cur.cy = H * 0.5;
      const roll = FOCUS - ((camZ + VIEW) / DZ) * TURN;
      cur.camZ = camZ; cur.roll = roll;
      const list = recordEl.classList.contains('list');
      spiral.style.opacity = list ? '1' : String(ease((lr - 0.02) / 0.06) * (1 - out));
      if (!list) items.forEach((li, i) => {
        const p = proj(i * TURN, i * DZ, camZ, roll, radiusOf(pitchOf(i)));
        if (!p || p[2] > FAR) { li.style.visibility = 'hidden'; return; }
        // a note fades as soon as it has passed the focus, so it never covers the words on the right
        const sc2 = Math.pow(VIEW / p[2], 0.8), a = clamp((p[2] - VIEW * 0.72) / (VIEW * 0.22)) * clamp((FAR - p[2]) / 5);
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
    function staffLine(rad, z0, z1, camZ, roll, alpha, width) {
      let run = [], wPrev = -1, aPrev = -1;
      const flush = () => { if (run.length > 1) { ctx.lineWidth = wPrev; ctx.strokeStyle = `rgba(${INK},${aPrev})`; ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); for (let n = 1; n < run.length; n++) ctx.lineTo(run[n][0], run[n][1]); ctx.stroke(); } };
      for (let z = z0; z <= z1; z += 0.04) {
        const p = proj((z / DZ) * TURN, z, camZ, roll, rad); if (!p) continue;
        const wd = Math.round(clamp(width * VIEW / p[2], 0.4, 3.2) * 4) / 4, al = Math.round(0.85 * alpha * behind(p[2]) * clamp((FAR - p[2]) / 6) * 20) / 20;
        if (wd !== wPrev || al !== aPrev) { const last = run[run.length - 1]; flush(); run = last ? [last] : []; wPrev = wd; aPrev = al; }
        run.push(p);
      }
      flush();
    }
    function drawCurrent(lr) {
      if (!cur || cur.camZ == null) return;
      const { camZ, roll } = cur, alpha = ease(lr / 0.05) * (1 - ease((lr - 0.94) / 0.06));
      if (alpha <= 0) return;
      // the colour of the note in focus, faint, around the swirl
      const w = recShown >= 0 && bySlug[items[recShown].dataset.slug], c = w && colorOf[w.slug];
      if (c) { const g = ctx.createRadialGradient(cur.cx, cur.cy, 0, cur.cx, cur.cy, Math.max(W, H) * 0.6); g.addColorStop(0, `rgba(${c},${0.16 * alpha})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      // the staff: five ink lines swirling in, thick close by, a hair far away
      const z0 = Math.max(-1.6, camZ + NEAR + 0.02), z1 = Math.min((N - 1) * DZ + 2.5, camZ + FAR);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let l = 0; l < 5; l++) staffLine(radiusOf(l * 2), z0, z1, camZ, roll, alpha, 1.3);
      // bar lines every four notes
      for (let i = 3; i < N; i += 4) {
        const z = (i + 0.5) * DZ, a = proj((z / DZ) * TURN, z, camZ, roll, radiusOf(0)), b2 = proj((z / DZ) * TURN, z, camZ, roll, radiusOf(8));
        if (!a || !b2 || a[2] > FAR) continue;
        ctx.strokeStyle = `rgba(${INK},${0.85 * alpha * behind(a[2]) * clamp((FAR - a[2]) / 6)})`; ctx.lineWidth = clamp(1.6 * VIEW / a[2], 0.4, 3); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
      }
      // stems: from each note, across the staff, away from the middle line
      for (let i = 0; i < N; i++) {
        const pi = pitchOf(i), up = pi < 4, th = i * TURN, z = i * DZ;
        const a = proj(th, z, camZ, roll, radiusOf(pi)); if (!a || a[2] > FAR || a[2] < VIEW * 0.72) continue;
        const rr = (cur.size / 2) * Math.pow(VIEW / a[2], 0.8), dir = up ? 1 : -1, ang = th + roll, len = cur.Rf * GAP * 3.4 * shrink(a[2]);
        const sx = a[0] + Math.cos(ang) * rr * dir, sy = a[1] + Math.sin(ang) * rr * dir;
        ctx.strokeStyle = `rgba(${INK},${0.85 * alpha * clamp((FAR - a[2]) / 6) * clamp((a[2] - VIEW * 0.72) / (VIEW * 0.22))})`; ctx.lineWidth = clamp(2 * VIEW / a[2], 0.5, 3);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(ang) * len * dir, sy + Math.sin(ang) * len * dir); ctx.stroke();
      }
      // the mark at the head of the staff, as its clef
      { const z = -1.1, p = proj((z / DZ) * TURN, z, camZ, roll, 1); if (p && clef.complete && clef.naturalWidth) { const h = cur.Rf * GAP * 9 * shrink(p[2]), wd = h * (1079 / 1275); ctx.globalAlpha = alpha * clamp((FAR - p[2]) / 6) * behind(p[2]); ctx.drawImage(clef, p[0] - wd / 2, p[1] - h / 2, wd, h); ctx.globalAlpha = 1; } }
      // specks drifting down the swirl
      ctx.fillStyle = `rgb(${INK})`;
      for (const d of flow) {
        if (!reduce) d.z -= d.v * 0.016; if (d.z < camZ) d.z += FAR;
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
      // Tale: a quiet stretch, then TALETONE introduces itself, message by message
      const lt = local(u, 'tale');
      on($('#jy-hello'), lt > 0.14 && lt < 1.04); on($('#jy-pcard'), lt > 0.3 && lt < 1.04); on($('#jy-types'), lt > 0.46 && lt < 1.04); on($('#jy-clients'), lt > 0.62 && lt < 1.04);
      // Tone: the line draws while the philosophy arrives
      const lo = local(u, 'tone');
      let reveal = lerp(0, 0.05, ease((lt - 0.45) / 0.5)); if (lo > 0) reveal = lerp(0.05, 1, ease((lo - 0.1) / 0.78));
      const pen = reveal * (line.length - 1);
      // one message per beat: the pen must have passed its point, and the scroll its turn
      trail.forEach((a, n) => { const q = P(line[a.i]); a.el.style.setProperty('--x', q[0] + 'px'); a.el.style.setProperty('--y', q[1] + 'px'); on(a.el, lo > 0.02 + n * 0.17 && pen >= a.i && lo < 1.02); });
      // Case: the request comes in from the client; TALETONE answers with her strength, a question, the story
      const lc = local(u, 'case');
      const caseOn = lc > 0 && lc < 1.02;
      if (caseOn) placeCase(lc); else if (caseLaid) { caseLaid = false; ['#jy-case-req', '#jy-case-ans', '#jy-case-m0', '#jy-case-m1'].forEach((sel) => on($(sel), false)); }
      const caseWork = CASE && bySlug[CASE];
      if (caseWork) { if (lc > 0.04 && lc < 1) { setOffer(caseWork); caseOffer = true; } else if (caseOffer) { caseOffer = false; setOffer(null); } }
      const lm = local(u, 'music');
      // Music
      cam = lm > 0 ? lerp(0, 1.02, ease(lm / 0.5)) : lo > 0 ? 0 : lerp(-2.2, 0, ease(clamp(lt / 0.45)));
      if (lm > 0.03 && lm < 0.5) setNowPlaying(Math.min(pinned.length - 1, Math.floor(clamp(lm / 0.5) * pinned.length)));
      if (!(lm > 0.03 && lm < 0.5) && npShown >= 0) { npShown = -1; setOffer(null); }
      on($('#jy-landscape'), lm > 0.55 && lm < 0.69);
      on($('#jy-fact'), lm > 0.71 && lm < 0.86);
      if (lm > 0.5 && !pts) buildPoints(); if (lm <= 0.5 && pts) pts = null;
      // Record: the dive into the current
      const lr = local(u, 'record'), ld = local(u, 'done'), le = local(u, 'epi');
      const inRecord = lr > 0 && lr < 1;
      on(recordEl, inRecord); on($('#jy-filters'), lr > 0.1 && lr < 0.93); on(readout, lr > 0.1 && lr < 0.93);
      on($('#jy-found'), (lm > 0.88 && lm < 1.1 && lr <= 0) || (lr > 0 && lr < 0.06)); on($('#jy-hint'), lr > 0.05 && lr < 0.18);
      if (inRecord) { recK = clamp((lr - 0.1) / 0.82) * (N - 1); placeCurrent(lr); }
      else if (spiral.style.opacity !== '0') { spiral.style.opacity = '0'; Object.values(trackEls).forEach((box) => box.classList.remove('on')); albumOpen = -1; }
      // Done: out of the current, the phone is seen from outside, the record in it
      const ink = le > 0;
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
      if (u > CH.record[0] + 0.12) return;
      if (ip > 0.8 && lm <= 0) {
        const da = ease((ip - 0.8) / 0.2); ctx.fillStyle = `rgb(${INK})`;
        for (const d of dots) {
          const g = reveal > 0 ? ease(clamp((reveal - d.t + 0.08) / 0.08)) : 0; if (reveal > d.t + 0.004) continue;
          const wind = reduce ? 0 : Math.sin(T * 0.6 + d.s * 20) * 6;
          const q = P([d.x + wind, d.y + (reduce ? 0 : Math.cos(T * 0.4 + d.s * 9) * 3), d.z]);
          const tgt = line[Math.min(line.length - 1, Math.round(d.t * (line.length - 1)))];
          const x = lerp(q[0], tgt[0], g), y = lerp(q[1], tgt[1], g), r = 1.1 + 1.7 * q[2];
          ctx.globalAlpha = da * clamp(0.3 + 0.5 * q[2], 0.3, 0.85) * (1 - g * 0.5); ctx.fillRect(x - r / 2, y - r / 2, r, r);
        }
        ctx.globalAlpha = 1;
      }
      const faceK = lm > 0 ? ease(lm / 0.42) : 0, faceA = lm > 0.5 ? 1 - ease((lm - 0.5) / 0.08) : 1;
      if (reveal > 0 && lm <= 0.58) {
        for (const b of blots) if (!b.done && now - b.born >= 1200) { paintBlot(b, 1); b.done = true; }
        const wa = 1 - ease(lm / 0.2);
        if (wa > 0) { ctx.globalAlpha = wa; ctx.drawImage(wash, 0, 0, W, H); for (const b of blots) if (!b.done) { const k = clamp((now - b.born) / 1200); if (k > 0) paintBlot(b, 0.3 + 0.7 * ease(k), ctx); } ctx.globalAlpha = 1; }
        wireA = 1 - ease(lm / 0.16);
        const back = 1 - 0.78 * ease(lc / 0.1) * (1 - ease((lc - 0.92) / 0.08));
        drawClouds(reveal, faceK, faceA * back); drawFaces(faceK, faceA); drawLine(reveal, faceA * back);
        if (lc > 0 && lc < 1) drawCase(lc);
      }
      if (pts && lr <= 0.08) {
        const lp = clamp((lm - 0.5) / 0.5), k = ease(lp / 0.85), fade = lr > 0 ? 1 - ease(lr / 0.06) : 1, cx = W / 2, cy = H * 0.5;
        const tilt = lerp(1.15, 0, ease((lp - 0.6) / 0.35)), spin = (reduce ? 0 : T * 0.35) + k * 2;
        for (const p of pts) {
          let tx, ty;
          if (p.ring) { const th = p.t * Math.PI * 2 * 10 + spin, r = RR * (0.97 - p.t * 0.53); tx = Math.cos(th) * r; ty = Math.sin(th) * r; }
          else { const th = p.th + spin, r = RR * p.rr; tx = Math.cos(th) * r; ty = Math.sin(th) * r; }
          const tz = ty * Math.sin(tilt); ty *= Math.cos(tilt);
          const k1 = ease((lp - p.s * 0.08) / 0.32), k2 = ease((lp - 0.36 - p.s * 0.1) / 0.4);
          let mx, my;
          if (p.ring) { const c = CURL[Math.min(CURL.length - 1, Math.floor(p.t * CURL.length))]; mx = cx + (c[0] - 0.5) * RR * 1.7 * (1079 / 1275); my = cy + (c[1] - 0.5) * RR * 1.7; }
          else { mx = lerp(p.x0, cx, 0.35); my = lerp(p.y0, cy, 0.35); }
          const bx = lerp(p.x0, mx, k1), by = lerp(p.y0, my, k1), x = lerp(bx, cx + tx, k2), y = lerp(by, cy + ty, k2), z = lerp(0, tz, k2);
          const f = 900 / (900 + z), depth = clamp(0.5 - z / (2 * RR)), r = (p.ring ? 1.3 : 2.2) * f * (0.6 + depth * 0.8);
          const a = (p.ring ? 0.75 : 0.8) * fade * (0.5 + depth * 0.5) * ease(lp / 0.06);
          ctx.fillStyle = p.ring ? `rgba(${INK},${a})` : `rgba(${p.col},${a})`;
          ctx.fillRect(cx + (x - cx) * f - r / 2, cy + (y - cy) * f - r / 2, r, r);
        }
      }
    }
    function resize() {
      DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      for (const c of [cv, wash]) { c.width = W * DPR; c.height = H * DPR; }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      caseLaid = false; buildLine(); buildDots(); buildCurrent(); blots.forEach((b) => { b.done = true; }); redrawWash(); recShown = -1;
    }
    addEventListener('resize', resize);
    phone.addEventListener('click', () => goU(CH.tale[0] + 0.5));

    // sample every cover once the record is near, so its wash can mix them
    let sampledAll = false;
    addEventListener('scroll', () => { if (!sampledAll && U() > CH.music[0]) { sampledAll = true; paintRecord(); } }, { passive: true });

    function reset() { recBuilt = false; pts = null; $('#jy-charm-cd').style.background = ''; }
    const at = (c, f) => CH[c][0] + (CH[c][1] - CH[c][0]) * f;
    const target = { pro: 0, tale: at('tale', 0.7), tone: at('tone', 0.9), record: recordU(0), epi: CH.epi[0] + 0.5 };
    function goStage(where, smooth = true) {
      goU(target[where] != null ? target[where] : 0, smooth);
    }
    setNowPlaying(0); resize();
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
