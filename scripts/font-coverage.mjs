// Korean characters the site can show, for the Google Fonts `text=` request that
// serves Nanum Gothic as one small file per weight instead of dozens of slices.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Everything that can put Korean text on a page.
const SOURCES = [
  'src/app/template.html', 'src/app/component.js', 'src/page.html',
  'assets/data/site-content.json', 'assets/data/seo-content.json', 'assets/data/works-data.json',
  'assets/js/works.js', 'assets/js/image-slot.js', 'scripts/build.mjs',
];

// ASCII is drawn by the Latin fonts; kana/kanji by Noto Sans JP.
const skip = (cp) => cp < 0x80 || (cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xff65 && cp <= 0xff9f) || (cp >= 0xf900 && cp <= 0xfaff);

export async function nanumCharacters(root) {
  const chars = new Set();
  for (const file of SOURCES) {
    for (const ch of await readFile(path.join(root, file), 'utf8')) {
      if (!skip(ch.codePointAt(0))) chars.add(ch);
    }
  }
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}
