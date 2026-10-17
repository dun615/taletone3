// Guards for the build tooling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const list = async (dir) => (await readdir(path.join(root, dir))).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`);

// Nanum Gothic is requested with only the Korean characters the site uses, so every source that can put
// text on a page must be in the coverage list (a new file once dropped 11 characters from /preview/).
test('font coverage reads every script and component part', async () => {
  const source = await readFile(path.join(root, 'scripts/font-coverage.mjs'), 'utf8');
  for (const file of [...await list('src/app/parts'), ...await list('assets/js'), 'src/app/component.js', 'src/app/template.html']) {
    if (file.endsWith('image-slot.js') || source.includes(`'${file}'`)) continue;
    assert.fail(`${file} is not in SOURCES of scripts/font-coverage.mjs`);
  }
  for (const file of [...await list('preview-src/app/parts'), ...await list('preview-src/js'), 'preview-src/app/component.js']) {
    assert.ok(source.includes(`'${file}'`), `${file} is not in PREVIEW_SOURCES of scripts/font-coverage.mjs`);
  }
});

test('the deploy stage publishes the site but no sources or notes', async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'tt-stage-'));
  try {
    execFileSync(process.execPath, [path.join(root, 'scripts/stage-site.mjs'), out, 'test'], { cwd: root });
    const entries = await readdir(out);
    for (const needed of ['assets', 'support.js', 'CNAME', '404.html', 'version.txt']) assert.ok(entries.includes(needed), `${needed} missing from the stage`);
    for (const hidden of ['src', 'scripts', 'preview-src', 'archive', 'tests', 'node_modules', '.github', 'package.json']) assert.ok(!entries.includes(hidden), `${hidden} would be published`);
    assert.ok(!entries.some((name) => name.endsWith('.md')), 'markdown notes would be published');
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

// The rich-text sanitizer exists twice (the component runtime and works.js load separately and share no
// module), so their allow-lists must stay identical.
test('both rich-text sanitizers allow the same tags and style properties', async () => {
  const allowLists = (source) => [...source.matchAll(/var allowed = (\{[\s\S]*?\});/g)]
    .map((m) => m[1].replace(/\s+/g, '').replace(/'/g, '"'));
  for (const [component, works] of [['src/app/parts/content.js', 'assets/js/works.js'], ['preview-src/app/parts/content.js', 'preview-src/js/works.js']]) {
    const a = allowLists(await readFile(path.join(root, component), 'utf8'));
    const b = allowLists(await readFile(path.join(root, works), 'utf8'));
    assert.equal(a.length, 2, `${component}: expected the style and tag allow-lists`);
    assert.deepEqual(a, b, `${component} and ${works} sanitize rich text differently`);
  }
});
