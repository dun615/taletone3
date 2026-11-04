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

export const WORK_KEYS = ['id', 'slug', 'artist', 'title', 'date', 'type', 'description', 'credits', 'image', 'thumb', 'audio',
  'fit', 'posX', 'posY', 'brightness', 'index', 'versions', 'tracks', 'kind', 'titleTrackIndex', 'youtube', 'format',
  'translations', 'roles', 'field', 'vinyl', 'pinned', 'category', 'officialCovers'];
export const TRACK_KEYS = ['id', 'title', 'date', 'type', 'description', 'credits', 'image', 'thumb', 'audio', 'fit', 'posX',
  'posY', 'brightness', 'versions', 'youtube', 'translations', 'roles', 'vinyl'];
export const KINDS = ['single', 'multilingual', 'album'];

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

const VINYL = (v) => Array.isArray(v) && v.length === 3 && v.every((c) => /^\d{1,3} \d{1,3} \d{1,3}$/.test(c));

// The rules a work must keep. exists(path) says whether a file is there. Returns { errors, warnings }.
export function checkWorks(works, exists) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const slugs = new Set();
  for (const w of works) {
    const name = w.slug || w.title || w.id;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(w.slug || '')) err(`${name}: slug must be lowercase letters, digits and hyphens`);
    if (slugs.has(w.slug)) err(`${name}: duplicate slug`); slugs.add(w.slug);
    for (const k of Object.keys(w)) if (!WORK_KEYS.includes(k)) err(`${name}: unknown field "${k}" (a typo, or a field to add to WORK_KEYS in scripts/works-model.mjs)`);
    if (!KINDS.includes(w.kind)) err(`${name}: kind must be one of ${KINDS.join(', ')}`);
    if (!/^\d{4}\.\d{2}\.\d{2}$/.test(w.date || '')) err(`${name}: date must be YYYY.MM.DD`);
    if (!w.image || !w.thumb) err(`${name}: needs image and thumb (the small cover, *-w320.webp)`);
    if (!VINYL(w.vinyl)) err(`${name}: vinyl needs three colours "r g b"`);
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
        if (!VINYL(t.vinyl)) err(`${tn}: vinyl needs three colours`);
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

// Files under assets/works that nothing refers to: either forgotten on a work, or safe to delete.
export function orphans(works, files, otherText = '') {
  const used = new Set(works.flatMap((w) => mediaPaths(w).map(([, p]) => p)));
  return files.filter((f) => !used.has(f) && !otherText.includes(f.split('/').pop()));
}
