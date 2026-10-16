// Builds the generated files from their editable sources:
//   src/app/template.html, src/app/component.js -> base64 blocks in every route page
//   assets/data/*-content.json                  -> assets/data/*-content.js
//
//   node scripts/build.mjs          rewrite generated files
//   node scripts/build.mjs --check  fail if any generated file is out of date
//
// The dc-runtime in support.js reads the app from two base64 <script> blocks
// in each page, and the pages load the data as window globals from the .js
// files. Edit the sources, never the generated output.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const routePages = [
  'index.html',
  'story-types/index.html',
  'members/index.html',
  'works/index.html',
  'news/index.html',
  'contact/index.html',
];

const payloads = [
  { source: 'src/app/template.html', block: /(<script type="application\/octet-stream" data-dc-template-b64>)[\s\S]*?(<\/script>)/ },
  { source: 'src/app/component.js', block: /(<script type="application\/octet-stream" data-dc-script data-dc-script-b64[^>]*>)[\s\S]*?(<\/script>)/ },
];

// Same layout as the existing pages: 76-column lines between leading and trailing newlines.
const encode = (buffer) => `\n${buffer.toString('base64').match(/.{1,76}/g).join('\n')}\n`;

const encoded = await Promise.all(payloads.map(async ({ source, block }) => ({
  source,
  block,
  body: encode(await readFile(path.join(root, source))),
})));

const dataScripts = [
  { source: 'assets/data/site-content.json', output: 'assets/data/site-content.js', globals: ['TALETONE_CONTENT'] },
  { source: 'assets/data/seo-content.json', output: 'assets/data/seo-content.js', globals: ['TALETONE_SEO_CONTENT', 'TALETONE_SEO'] },
];

const outputs = [];
for (const page of routePages) {
  let html = await readFile(path.join(root, page), 'utf8');
  for (const { source, block, body } of encoded) {
    if (!block.test(html)) throw new Error(`${page}: missing embedded block for ${source}`);
    html = html.replace(block, (_, open, close) => `${open}${body}${close}`);
  }
  outputs.push([page, html]);
}
for (const { source, output, globals: [name, ...aliases] } of dataScripts) {
  const data = JSON.parse(await readFile(path.join(root, source), 'utf8'));
  const lines = [`window.${name} = ${JSON.stringify(data, null, 2)};`, ...aliases.map((alias) => `window.${alias} = window.${name};`)];
  outputs.push([output, `${lines.join('\n')}\n`]);
}

const stale = [];
for (const [relative, content] of outputs) {
  const file = path.join(root, relative);
  if (await readFile(file, 'utf8') === content) continue;
  stale.push(relative);
  if (!check) await writeFile(file, content);
}

if (check && stale.length) {
  console.error(`Generated files are out of date: ${stale.join(', ')}`);
  console.error('Run `node scripts/build.mjs` and commit the result.');
  process.exit(1);
}
console.log(check
  ? `Generated files are up to date (${outputs.length} files).`
  : stale.length ? `Rebuilt ${stale.length} file(s): ${stale.join(', ')}` : 'All generated files already up to date.');
