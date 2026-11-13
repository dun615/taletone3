// The one place that says what a work in assets/data/works-data.json is, and how its media are found.
//
// The page (scripts/journey-page.mjs), the site check (.github/scripts/validate-site.mjs) and the audit
// (`npm run audit`) all read works through this file, so they can never disagree about where a cover, a
// thumbnail or a sound lives. Before deciding that a file is missing, run `npm run audit`: it prints what every
// work and track resolves to.
//
//   kind 'single'        one song: audio (or a YouTube video), no tracks
//   kind 'multilingual'  one song in several languages: versions [{ language, audio }], no tracks
//   kind 'album'         tracks, each with its own image, thumb and audio (or a YouTube video); the album itself
//                        has no audio of its own (it plays its title track, titleTrackIndex)
//
// A work's titles: `title` is its official title where it was made, `origin` is where that is ('kr', 'en' or 'jp',
// the content keys), and `titles` holds its titles in the other languages ({ kr, en, jp } but its own): an official
// one, or where a language has none, the name it is commonly called by there; never one made up for the site, and
// `translations` carries no title. A track has `title` and `titles` and comes from its album's origin. titleIn()
// says which one each language shows. The other work (Sound Engineering, ETC, in site-content.json) keeps the same
// fields and rules (checkTitledItems).

export const WORK_KEYS = ['slug', 'artist', 'title', 'date', 'type', 'description', 'credits', 'image', 'thumb', 'audio',
  'fit', 'posX', 'posY', 'versions', 'tracks', 'kind', 'titleTrackIndex', 'youtube', 'format',
  'translations', 'roles', 'field', 'pinned', 'officialCovers', 'origin', 'titles', 'cdZoom'];
export const TRACK_KEYS = ['title', 'date', 'type', 'description', 'credits', 'image', 'thumb', 'audio', 'fit', 'posX',
  'posY', 'versions', 'youtube', 'translations', 'roles', 'titles', 'cdZoom'];
export const KINDS = ['single', 'multilingual', 'album'];
export const LANGS = ['kr', 'en', 'jp'];

// The title a page in lang shows for a work or a track (origin: the work's): Japanese pages the official Japanese
// title, else the official English one, else the title as it was made; English pages the official English title,
// else the title as it was made; Korean pages the official Korean title, else the title as it was made.
export function titleIn(item, origin, lang) {
  const t = item.titles || {}, own = (l) => (l === origin ? item.title : t[l]);
  if (lang === 'kr') return own('kr') || item.title;
  if (lang === 'jp') return own('jp') || own('en') || item.title;
  return own(lang) || item.title;
}

export const ytId = (url) => {
  const m = String(url || '').match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/) || String(url || '').match(/^([\w-]{11})$/);
  return m ? m[1] : '';
};

// A work's or a track's media: its cover, its small cover (for chips and lists), its sound and its video.
// The small cover falls back to the cover, then to the video's still, so nothing shows empty.
export function mediaOf(item) {
  const yt = ytId(item.youtube);
  const image = item.image || '';
  return {
    image,
    thumb: item.thumb || image || (yt ? `https://i.ytimg.com/vi/${yt}/mqdefault.jpg` : ''),
    audio: item.audio || '',
    yt,
  };
}

// Every media path a work refers to, with where it sits (for existence checks and the orphan list).
export function mediaPaths(work) {
  const out = [];
  const add = (where, p) => { if (p && !/^https?:/.test(p)) out.push([where, p]); };
  for (const k of ['image', 'thumb', 'audio']) add(`${work.slug}.${k}`, work[k]);
  (work.versions || []).forEach((v, i) => add(`${work.slug}.versions[${i}].audio`, v.audio));
  (work.tracks || []).forEach((t, i) => {
    for (const k of ['image', 'thumb', 'audio']) add(`${work.slug}.tracks[${i}].${k}`, t[k]);
    (t.versions || []).forEach((v, j) => add(`${work.slug}.tracks[${i}].versions[${j}].audio`, v.audio));
  });
  return out;
}

// the titles' rules, for a work, a track or an item of the other work (origin: where it was made)
function checkTitles(item, name, err, origin) {
  if (!item.title) err(`${name}: needs its title (the official one where it was made)`);
  const t = item.titles, others = LANGS.filter((l) => l !== origin);
  if (t !== undefined) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) err(`${name}: titles must be { ${others.join(', ')} }`);
    else for (const [k, v] of Object.entries(t)) {
      if (!others.includes(k)) err(`${name}: titles.${k} is not a language the site shows other than its own (${others.join(', ')})`);
      if (!v || typeof v !== 'string') err(`${name}: titles.${k} must be a title`);
      if (v === item.title) err(`${name}: titles.${k} is the same as its title (keep only official titles that differ)`);
    }
  }
  for (const [l, tr] of Object.entries(item.translations || {})) if (tr && 'title' in tr) err(`${name}: translations.${l}.title: a title is not translated (an official one goes in titles.${l})`);
}

// The rules a work must keep. exists(path) says whether a file is there. Returns { errors, warnings }.
export function checkWorks(works, exists) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const slugs = new Set();
  for (const w of works) {
    const name = w.slug || w.title;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(w.slug || '')) err(`${name}: slug must be lowercase letters, digits and hyphens`);
    if (slugs.has(w.slug)) err(`${name}: duplicate slug`); slugs.add(w.slug);
    for (const k of Object.keys(w)) if (!WORK_KEYS.includes(k)) err(`${name}: unknown field "${k}" (a typo, or a field to add to WORK_KEYS in scripts/works-model.mjs)`);
    if (!KINDS.includes(w.kind)) err(`${name}: kind must be one of ${KINDS.join(', ')}`);
    if (!/^\d{4}\.\d{2}\.\d{2}$/.test(w.date || '')) err(`${name}: date must be YYYY.MM.DD`);
    if (!w.image || !w.thumb) err(`${name}: needs image and thumb (the small cover, *-w320.webp)`);
    if (!LANGS.includes(w.origin)) err(`${name}: origin must be where it was made (${LANGS.join(', ')})`);
    // (cdZoom: how much larger the cover is drawn on its CD, for a cover with a frame or a plain border at its edge)
    for (const it of [w, ...(w.tracks || [])]) if (it.cdZoom != null && !(typeof it.cdZoom === 'number' && it.cdZoom >= 1 && it.cdZoom <= 1.5)) err(`${name}: cdZoom must be a number from 1 to 1.5`);
    checkTitles(w, name, err, w.origin);
    for (const [where, p] of mediaPaths(w)) if (!exists(p)) err(`${where}: file ${p} does not exist`);
    const tracks = w.tracks || [];
    if (w.kind === 'album') {
      if (tracks.length < 2) err(`${name}: an album needs at least two tracks`);
      // the album plays its tracks: a sound at the album level hides a track's own (SilverLine once played Cloudnine)
      if (w.audio) err(`${name}: an album has no audio of its own; put ${w.audio} on its track`);
      if (!(Number.isInteger(w.titleTrackIndex) && w.titleTrackIndex >= 0 && w.titleTrackIndex < tracks.length)) err(`${name}: titleTrackIndex must point at one of its ${tracks.length} tracks`);
      tracks.forEach((t, i) => {
        const tn = `${name} · ${i + 1}. ${t.title || '?'}`;
        for (const k of Object.keys(t)) if (!TRACK_KEYS.includes(k)) err(`${tn}: unknown field "${k}"`);
        if (!t.image) err(`${tn}: needs its own image`);
        if (!t.thumb) err(`${tn}: needs its own thumb (*-w320.webp)`);
        if (!t.audio && !ytId(t.youtube)) err(`${tn}: needs audio or a YouTube video`);
        checkTitles(t, tn, err, w.origin);
      });
    } else {
      if (tracks.length) err(`${name}: only an album has tracks (kind is ${w.kind})`);
      if (w.kind === 'multilingual' && (w.versions || []).length < 2) err(`${name}: a multilingual work needs at least two versions`);
      if (!w.audio && !(w.versions || []).some((v) => v.audio) && !ytId(w.youtube)) err(`${name}: needs audio, versions or a YouTube video`);
    }
    if (w.thumb && w.thumb === w.image) warn(`${name}: thumb is the full image; make a *-w320.webp`);
  }
  const pinned = works.filter((w) => w.pinned).map((w) => w.pinned).sort();
  if (pinned.join() !== '1,2,3') err(`the featured works must be pinned 1, 2, 3 (found ${pinned.join() || 'none'})`);
  return { errors, warnings };
}

// The other work's items (site-content.json: mixWorks, bgmWorks): where each was made and its titles, by the same
// rules as a work's. Returns the errors.
export function checkTitledItems(items, where) {
  const errors = [], err = (m) => errors.push(m);
  items.forEach((it, i) => {
    const name = `${where}[${i}] ${it.title || '?'}`;
    if (!LANGS.includes(it.origin)) err(`${name}: origin must be where it was made (${LANGS.join(', ')})`);
    for (const k of ['titleEn', 'titleJp']) if (k in it) err(`${name}: ${k} is retired; its title goes in titles`);
    checkTitles(it, name, err, it.origin);
  });
  return errors;
}

// Files under assets/works that nothing refers to: either forgotten on a work, or safe to delete.
export function orphans(works, files, otherText = '') {
  const used = new Set(works.flatMap((w) => mediaPaths(w).map(([, p]) => p)));
  return files.filter((f) => !used.has(f) && !otherText.includes(f.split('/').pop()));
}
