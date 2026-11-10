// The works data, by the rules in scripts/works-model.mjs: the page, the site check and `npm run audit` read
// works through that one file, so these tests guard all three. Each case below is a mistake that once happened.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWorks, mediaOf, orphans, titleIn } from '../scripts/works-model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { works } = JSON.parse(readFileSync(path.join(root, 'assets/data/works-data.json'), 'utf8'));
const exists = (p) => existsSync(path.join(root, p));
const always = () => true;
const track = (n, extra = {}) => ({ title: `T${n}`, image: `i${n}.webp`, thumb: `i${n}-w320.webp`, audio: `a${n}.mp3`, ...extra });
const album = (extra = {}) => ({ slug: 'an-album', kind: 'album', date: '2026.01.01', image: 'c.webp', thumb: 'c-w320.webp', audio: '', titleTrackIndex: 0, origin: 'kr', title: 'An album', tracks: [track(1), track(2)], ...extra });
const pinned = [1, 2, 3].map((n) => ({ slug: `p${n}`, kind: 'single', date: '2026.01.01', image: 'x.webp', thumb: 'x-w320.webp', audio: 'x.mp3', origin: 'kr', title: `P${n}`, pinned: n }));
const problems = (w) => checkWorks([...pinned, w], always).errors;

test('the live works keep every rule, and every file they name exists', () => {
  const { errors } = checkWorks(works, exists);
  assert.deepEqual(errors, [], `run \`npm run audit\` for details:\n- ${errors.join('\n- ')}`);
});

test('a track with only an image still shows it (tracks once read only thumb and looked empty)', () => {
  assert.equal(mediaOf({ image: 'cover.webp' }).thumb, 'cover.webp');
  assert.equal(mediaOf({ youtube: 'https://youtu.be/yiprl7-dU04' }).thumb, 'https://i.ytimg.com/vi/yiprl7-dU04/mqdefault.jpg');
});

test('an album with a sound of its own is refused (SilverLine once played Cloudnine for the whole album)', () => {
  assert.deepEqual(problems(album()), []);
  assert.ok(problems(album({ audio: 'a3.mp3' })).some((e) => e.includes('has no audio of its own')));
});

test('every album track needs its own image, thumb and sound', () => {
  assert.ok(problems(album({ tracks: [track(1), track(2, { audio: '' })] })).some((e) => e.includes('needs audio')));
  assert.ok(problems(album({ tracks: [track(1), track(2, { thumb: undefined })] })).some((e) => e.includes('own thumb')));
  assert.ok(problems(album({ titleTrackIndex: 5 })).some((e) => e.includes('titleTrackIndex')));
});

test('an unknown field is refused, so a typo or a second way to say the same thing cannot hide (isTitle)', () => {
  assert.ok(problems(album({ tracks: [track(1, { isTitle: true }), track(2)] })).some((e) => e.includes('unknown field "isTitle"')));
  assert.ok(problems({ ...pinned[0], slug: 'typo', pinned: 0, iamge: 'x.webp' }).some((e) => e.includes('unknown field "iamge"')));
});

test('a file nothing refers to is listed', () => {
  assert.deepEqual(orphans([album()], ['i1.webp', 'forgotten.mp3']), ['forgotten.mp3']);
});

test('each language shows an official title, never a translated one', () => {
  const kr = { title: '마음악보', titles: { en: 'Heart Score' } };
  assert.equal(titleIn(kr, 'kr', 'kr'), '마음악보');
  assert.equal(titleIn(kr, 'kr', 'en'), 'Heart Score');
  assert.equal(titleIn(kr, 'kr', 'jp'), 'Heart Score', 'a Japanese page without a Japanese title shows the English one');
  assert.equal(titleIn({ title: '운명', titles: { jp: '運命' } }, 'kr', 'en'), '운명', 'an English page without an English title shows the title as it was made');
  assert.equal(titleIn({ title: '여름을 그리다' }, 'kr', 'jp'), '여름을 그리다');
  const jp = { title: '逆光', titles: { en: 'Gyakkou' } };
  assert.equal(titleIn(jp, 'jp', 'jp'), '逆光');
  assert.equal(titleIn(jp, 'jp', 'kr'), '逆光', 'a Korean page without a Korean title shows the title as it was made');
  assert.ok(problems(album({ origin: undefined })).some((e) => e.includes('origin')));
  assert.ok(problems(album({ translations: { en: { title: 'X' } } })).some((e) => e.includes('a title is not translated')));
  assert.ok(problems(album({ titles: { en: 'An album' } })).some((e) => e.includes('same as its title')));
});
