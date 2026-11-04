// Guards for the build tooling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
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
