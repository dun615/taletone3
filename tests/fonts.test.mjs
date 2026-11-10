import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hangulCharacters, japaneseCharacters } from '../scripts/font-coverage.mjs';

// The fonts are subsets (scripts/subset-fonts.py): every Hangul syllable and every Japanese character the site can show
// must be in them, or that character falls back to another face. When this fails, run the subset script again.
test('the font subsets hold every Korean and Japanese character the site uses', async () => {
  const covered = JSON.parse(await readFile('scripts/font-subsets.json', 'utf8'));
  // (a character the face itself does not have, such as 뱨 in a credited name, is recorded as such and falls back)
  const missing = (chars, family) => [...chars].filter((ch) => !covered[family].includes(ch) && !covered[`${family} (not in the face)`].includes(ch)).join('');
  const ko = missing(await hangulCharacters('.'), 'nanum-square-round');
  const ja = missing(await japaneseCharacters('.'), 'mplus-rounded');
  assert.equal(ko, '', `NanumSquareRound lacks ${ko}: run python3 scripts/subset-fonts.py <the source fonts>`);
  assert.equal(ja, '', `M PLUS Rounded 1c lacks ${ja}: run python3 scripts/subset-fonts.py <the source fonts>`);
});

// Three weights, matched by stroke (00-base.css): the styles only ever ask for 100, 400 or 700.
test('the styles use only the three weights', async () => {
  const css = (await Promise.all(['00-base', '10-column', '20-panels', '30-stage', '40-stage-pieces', '50-stage-narrow', '60-record-tabs', '70-chat-room', '80-tablet'].map((f) => readFile(`src/journey/css/${f}.css`, 'utf8')))).join('\n');
  const rules = css.replace(/@font-face\{[^}]*\}/g, '');
  const weights = new Set([...rules.matchAll(/font-weight:(\w+)/g), ...rules.matchAll(/font:(\d+) /g)].map((m) => m[1]));
  assert.deepEqual([...weights].filter((w) => !['100', '400', '700', 'inherit', 'normal'].includes(w)), []);
});
