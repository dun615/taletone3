// The data the journey shows, ready for the page: each work, the copy, and the other work (Sound Engineering, ETC),
// localized for one language. scripts/journey-page.mjs draws the HTML from it; journeyData() is the window.TT_JOURNEY
// script that src/journey/js/ reads. Where a work's media are found is decided in scripts/works-model.mjs.
import { mediaOf, ytId } from './works-model.mjs';

export const plain = (value) => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
export const merge = (base, lang) => {
  const own = (base && base.translations && base.translations[lang]) || {};
  return { ...base, ...own };
};

// Each work localized, with only the fields the page and its script use; where its media are found is decided in
// scripts/works-model.mjs, the same rules the site check and `npm run audit` use.

export function journeyWorks(worksData, lang) {
  const local = (item) => (lang === 'kr' ? item : merge(item, lang));
  const unit = (item) => {
    const u = local(item);
    return { title: plain(u.title || item.title), artist: plain(u.artist || item.artist), type: plain(u.type || item.type), description: plain(u.description || item.description), credits: String(u.credits || item.credits || ''), ...mediaOf(item), youtube: item.youtube || '', date: item.date || '', roles: item.roles || [], fit: item.fit || 'cover', pos: `${item.posX || '50%'} ${item.posY || '50%'}` };
  };
  const gains = (worksData.loudness && worksData.loudness.files) || {};
  const gainOf = (src) => (src && gains[src] && typeof gains[src].gain === 'number' ? gains[src].gain : 0);
  return worksData.works.map((w) => {
    const u = unit(w);
    const versions = (w.versions || []).map((v) => ({ language: v.language || '', audio: v.audio || '', gain: gainOf(v.audio) })).filter((v) => v.audio);
    const tracks = (w.tracks || []).map((t) => { const tu = unit(t); return { title: tu.title, description: tu.description, audio: tu.audio, gain: gainOf(tu.audio), roles: tu.roles, thumb: tu.thumb, credits: tu.credits, yt: tu.yt, vinyl: t.vinyl || [] }; });
    const covers = (w.officialCovers || []).map((c) => ({ artist: (lang === 'en' && c.artistEn) || (lang === 'jp' && c.artistJp) || c.artist || '', yt: ytId(c.youtube) })).filter((c) => c.yt);
    const roles = [...new Set([...(w.roles || []), ...(w.tracks || []).flatMap((t) => t.roles || [])])];
    return { slug: w.slug, ...u, roles, gain: gainOf(w.audio), field: w.field || 'original', kind: w.kind || 'single', format: w.format || '', versions, tracks, titleTrack: w.titleTrackIndex || 0, pinned: w.pinned || 0, covers, vinyl: w.vinyl || [] };
    // the featured works (pinned 1, 2, 3) open the record in their order; the rest follow, newest first
  }).sort((a, b) => (a.pinned || 1e3) - (b.pinned || 1e3) || b.date.localeCompare(a.date));
}

export function journeyCopy(site, lang) {
  const j = merge(site.journey, lang);
  const projects = merge(site.projects, lang);
  const contact = merge(site.contact, lang);
  const form = merge(contact.form || {}, lang);
  const rows = ((projects.proof && projects.proof.rows) || []).map((row, i) => ({ label: plain((site.projects.proof.rows[i] || {}).label || row.label), title: plain(row.steps && row.steps[0] && row.steps[0].text), text: plain(row.result) }));
  const members = merge(site.membersMeta, lang), footer = merge(site.footerMeta, lang);
  const intro = { hello: plain(members.subtitle), typesLabel: plain(members.typesLabel), types: [projects.audienceGameTitle, projects.audienceCreatorTitle, projects.audienceAnimationTitle].map(plain), creed: plain(String(footer.tagline || '').split(' · ')[0]).replace(/, /, ',\n') };
  const cs = (projects.proof && projects.proof.case) || null;
  return { ...j, intro, caseStudy: cs, rail: j.rail || site.journey.rail, fields: j.fields || site.journey.fields, roles: j.roles || site.journey.roles, chapterLabels: site.journey.chapterLabels, notifyFrom: site.journey.notifyFrom, steps: rows, form, mail: { email: contact.email, formKey: contact.formKey, mailSubject: contact.mailSubject } };
}

// The other work, built as the live Discography's Sound Engineering and ETC tabs: Sound Engineering lists
// mixWorks, plus the studio's own songs and tracks credited with recording, editing, mixing or mastering (with a
// video or audio), plus ETC cards with those credits; duplicates go, newest video first. ETC lists bgmWorks.
const POST = { rec: 'Rec', edit: 'Edit', mix: 'Mix', master: 'Master' };
export function journeyExtras(site, worksData, lang) {
  const c = journeyCopy(site, lang), cardRoles = c.cardRoles || {}, dates = site.videoDates || {};
  const titleKey = { en: 'titleEn', jp: 'titleJp' }[lang];
  const keysOf = (roles) => String(roles || '').split(/\s*·\s*/).map((w) => w.replace(/\s*\(.*\)$/, '')).filter(Boolean);
  const roleText = (roles) => String(roles || '').split(/\s*·\s*/).filter(Boolean).map((word) => { const m = word.match(/^(.*?)(\s*\(.*\))?$/); return (cardRoles[m[1]] || m[1]) + (m[2] || ''); }).join(' · ');
  const dateText = (d) => { const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return String(d); return lang === 'en' ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1]} ${+m[3]}, ${m[1]}` : `${m[1]}.${m[2]}.${m[3]}`; };
  const gains = (worksData.loudness && worksData.loudness.files) || {};
  const card = (it, extra = {}) => {
    const yt = ytId(it.youtube), shown = String((yt && dates[yt]) || it.date || '');
    return { title: (titleKey && it[titleKey]) || it.title, artist: it.artist || '', roles: roleText(it.roles), keys: keysOf(it.roles), yt, audio: yt ? '' : (it.audio || ''), gain: (it.audio && gains[it.audio] && gains[it.audio].gain) || 0, date: shown, dateText: dateText(shown), cover: !!it.cover, ...extra };
  };
  const own = [];
  for (const w of worksData.works) {
    const album = lang === 'kr' ? w : merge(w, lang);
    const units = (w.kind === 'album' && (w.tracks || []).length) ? w.tracks : [w];
    for (const u of units) {
      const post = Object.keys(POST).filter((r) => (u.roles || []).includes(r));
      const yt = ytId(u.youtube || (u === w ? w.youtube : ''));
      if (!post.length || !(yt || u.audio)) continue;
      const lu = lang === 'kr' ? u : merge(u, lang);
      own.push({ title: plain(lu.title || u.title), artist: plain(album.artist || w.artist), roles: post.map((r) => POST[r]).join(' · '), youtube: yt, audio: yt ? '' : u.audio, date: String(u.date || w.date || '').replace(/\./g, '-'), own: true });
    }
  }
  const etcPost = ((site.bgmWorks || {}).items || []).filter((it) => keysOf(it.roles).some((k) => Object.values(POST).includes(k)));
  const group = (key, items, roles) => {
    const g = merge(site[key] || {}, lang), seen = new Set();
    const list = items.filter((it) => { const k = ytId(it.youtube) || it.audio; if (!k || seen.has(k)) return false; seen.add(k); return true; })
      .map((it) => card(it, it.own ? { own: true } : {})).sort((a, b) => b.date.localeCompare(a.date));
    return { key, label: g.label || '', note: g.note || '', coverTag: g.coverTag || '', roles, items: list };
  };
  return [
    group('mixWorks', [...((site.mixWorks || {}).items || []), ...own, ...etcPost], [['Rec', c.roleRec], ['Edit', c.roleEdit], ['Mix', c.roleMix], ['Master', c.roleMaster]]),
    group('bgmWorks', (site.bgmWorks || {}).items || [], null),
  ];
}

// window.TT_JOURNEY for one language. The copy carries only the keys the script reads (copyKeys: the build finds
// every COPY.<key> in src/journey/js/); the rest of the words are already in the page's HTML.
export function journeyData(site, worksData, lang, copyKeys) {
  const c = journeyCopy(site, lang);
  const copy = Object.fromEntries(copyKeys.map((k) => [k, c[k]]));
  const missing = copyKeys.filter((k) => c[k] === undefined);
  if (missing.length) throw new Error(`src/journey/js/ reads COPY.${missing.join(', COPY.')}, which ${lang} copy does not have`);
  return `window.TT_JOURNEY=${JSON.stringify({ copy, works: journeyWorks(worksData, lang), extras: journeyExtras(site, worksData, lang) }).replace(/</g, '\\u003c')};\n`;
}
