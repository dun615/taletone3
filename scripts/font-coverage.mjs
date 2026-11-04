// The Japanese characters the site can show, for the Google Fonts `text=` request that serves LINE Seed JP on the
// Japanese pages as one small file per weight instead of dozens of slices.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Everything that can put text on a page.
const SOURCES = [
  'assets/data/site-content.json', 'assets/data/seo-content.json', 'assets/data/works-data.json',
  'scripts/build.mjs', 'scripts/journey-page.mjs', 'src/journey/journey.js',
];

// Kana, kanji, CJK punctuation and full-width forms.
const japanese = (cp) => (cp >= 0x3000 && cp <= 0x30ff) || (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xffef);

export async function japaneseCharacters(root, sources = SOURCES) {
  const chars = new Set();
  for (const file of sources) {
    for (const ch of await readFile(path.join(root, file), 'utf8')) {
      if (japanese(ch.codePointAt(0))) chars.add(ch);
    }
  }
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}
