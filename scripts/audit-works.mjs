// What every work and album track resolves to, by the rules in scripts/works-model.mjs, and what is wrong or
// left over. Run it before deciding that a cover, a thumbnail or a sound is missing:
//
//   npm run audit            the problems, the albums track by track, and the files nothing uses
//   npm run audit -- --all   every work, singles too
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWorks, mediaOf, orphans } from './works-model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const all = process.argv.includes('--all');
const { works } = JSON.parse(readFileSync(path.join(root, 'assets/data/works-data.json'), 'utf8'));
const exists = (p) => existsSync(path.join(root, p));
const short = (p) => (p ? (exists(p) || /^https?:/.test(p) ? '' : 'MISSING ') + p.split('/').pop().slice(0, 44) : '—');

const { errors, warnings } = checkWorks(works, exists);
console.log(errors.length ? `${errors.length} problem(s):\n- ${errors.join('\n- ')}\n` : 'No problems.\n');
if (warnings.length) console.log(`${warnings.length} warning(s):\n- ${warnings.join('\n- ')}\n`);

for (const w of works) {
  if (w.kind !== 'album' && !all) continue;
  const m = mediaOf(w);
  console.log(`${w.slug} [${w.kind}]  image ${short(m.image)} · thumb ${short(m.thumb)} · audio ${short(m.audio || (w.versions || []).map((v) => v.language).join('/'))}${m.yt ? ' · video' : ''}`);
  (w.tracks || []).forEach((t, i) => {
    const tm = mediaOf(t);
    console.log(`  ${String(i + 1).padStart(2)}${i === w.titleTrackIndex ? '*' : ' '} ${String(t.title).slice(0, 26).padEnd(26)} image ${short(tm.image)} · thumb ${short(tm.thumb)} · audio ${short(tm.audio)}${tm.yt ? ' · video' : ''}`);
  });
}

const list = (dir) => readdirSync(path.join(root, dir)).map((f) => `${dir}/${f}`);
const files = [...list('assets/works/images'), ...list('assets/works/audio')];
const left = orphans(works, files, readFileSync(path.join(root, 'assets/data/site-content.json'), 'utf8'));
console.log(left.length ? `\n${left.length} file(s) under assets/works that nothing refers to:\n- ${left.join('\n- ')}` : '\nEvery file under assets/works is in use.');
process.exit(errors.length ? 1 : 0);
