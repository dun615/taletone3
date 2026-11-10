// The detail of a work (a dialog): cover or video, facts, credits, versions, tracks, covers.
/* ---------------- story panel ---------------- */
const story = $('#jy-story'), storyBox = $('.jy-box', story), playBtn = $('#jy-play'), prog = $('#jy-pg'), sLp = $('#jy-s-lp');
let storyWork = null, storyReturn = null, untrapStory = null;
function roleLine(roles) { const t = (roles || []).map((r) => COPY.roles[r]).filter(Boolean).join(' · '); return t ? 'TALETONE · ' + t : ''; }
// the making of the song (what the record's card says at a glance); mixing, mastering, recording and editing are in
// the detail and on the Sound Engineering shelf
const MAKING = ['produce', 'compose', 'arrange', 'lyrics'];
const makingLine = (roles) => roleLine((roles || []).filter((r) => MAKING.includes(r)));
// ---- videos: a YouTube card or stage turns into the player in place (or opens YouTube where embedding is not allowed) ----
// (a preview that cannot frame YouTube, such as the claude.ai artifact, sets window.TT_NO_EMBED: videos open in a tab)
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
  $('#jy-s-v').src = ASSET + (w.image || w.thumb);
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
  stage.syncInert();
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
  if (b.classList.contains('jy-sw-btn')) { stage.pick(b.dataset.open); return; }
  openStory(b.dataset.open, b);
});
