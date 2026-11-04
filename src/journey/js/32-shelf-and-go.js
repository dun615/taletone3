// Sound Engineering and ETC as cards on a shelf over the record, and go(): moving to a chapter from any link.
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
  if (!was) stage.hold(true);
  if (from) from.focus({ preventScroll: true });
}
function closeShelf() {
  if (shelf.hidden) return;
  $$('#jy-shelf .jy-embed').forEach(unEmbed); $$('#jy-shelf audio').forEach((a) => a.pause());
  shelf.classList.remove('open'); shelf.hidden = true; shelfG = null;
  $$('.jy-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === 'songs')));
  stage.hold(false);
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
  stage.go(where);
}
