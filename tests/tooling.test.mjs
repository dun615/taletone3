// Guards for the build tooling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the deploy stage publishes the site but no sources or notes', async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'tt-stage-'));
  try {
    execFileSync(process.execPath, [path.join(root, 'scripts/stage-site.mjs'), out, 'test'], { cwd: root });
    const entries = await readdir(out);
    for (const needed of ['assets', 'CNAME', '404.html', 'version.txt']) assert.ok(entries.includes(needed), `${needed} missing from the stage`);
    for (const hidden of ['src', 'scripts', 'preview-src', 'archive', 'tests', 'node_modules', '.github', 'package.json']) assert.ok(!entries.includes(hidden), `${hidden} would be published`);
    assert.ok(!entries.some((name) => name.endsWith('.md')), 'markdown notes would be published');
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

// The page's script and styles are parts joined in one scope by the build (ARCHITECTURE.md): each part says what it
// is for in its first line, and the joined script parses (two parts declaring the same name would not).
test('the script and style parts each say what they are, and the joined script parses', async () => {
  for (const dir of ['src/journey/js', 'src/journey/css']) {
    for (const f of (await readdir(path.join(root, dir))).sort()) {
      const first = (await readFile(path.join(root, dir, f), 'utf8')).split('\n')[0];
      assert.match(first, /^(\/\/|\/\*)/, `${dir}/${f} must begin with a comment saying what it does`);
    }
  }
  execFileSync(process.execPath, ['--check', path.join(root, 'assets/journey/journey.js')]);
});

