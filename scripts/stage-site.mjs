// Copy the files the public site serves into a folder for GitHub Pages (Actions deployment).
//
//   node scripts/stage-site.mjs _site [commit-sha]
//
// Everything in the repository is published except sources, tooling and notes listed below. Run
// `node scripts/build.mjs` first so the generated pages, bundles and sitemap exist.
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.argv[2] || '_site');
const sha = process.argv[3] || '';

// not part of the site
const EXCLUDE = new Set([
  '.git', '.github', '.claude', 'node_modules', 'src', 'scripts', 'preview-src', 'archive', 'qa', 'tests',
  'package.json', 'package-lock.json', '.gitignore', path.basename(out),
]);
const skip = (name) => EXCLUDE.has(name) || /\.md$/i.test(name) || (name.startsWith('.') && name !== '.well-known');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
let count = 0;
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (skip(entry.name)) continue;
  await cp(path.join(root, entry.name), path.join(out, entry.name), { recursive: true });
  count++;
}
// which commit is live, readable at /version.txt
if (sha) await writeFile(path.join(out, 'version.txt'), `${sha}\n`);
console.log(`staged ${count} top-level entries into ${path.relative(root, out) || out}`);
