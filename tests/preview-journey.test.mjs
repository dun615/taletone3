import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { previewSite, previewTemplate } from '../preview-src/story-journey.mjs';

test('the preview experiment keeps live copy intact and connects the book before contact', async () => {
  const source = JSON.parse(await readFile('assets/data/site-content.json', 'utf8'));
  const before = JSON.stringify(source);
  const next = previewSite(source);
  assert.equal(JSON.stringify(source), before);
  for (const lang of ['kr', 'en', 'jp']) {
    assert.equal(next.projects.translations[lang].proof.rows.length, 3);
    assert.ok(next.home.translations[lang].journeyIntro);
    assert.ok(next.contact.translations[lang].arrivalLabel);
    assert.ok(next.contact.translations[lang].form.contactLabel);
  }
  const raw = await readFile('src/app/template.html', 'utf8');
  const template = previewTemplate(raw);
  const start = template.indexOf('<section id="c-contact"');
  const book = template.indexOf('class="tt-book2"', start);
  const title = template.indexOf('tt-contact-title', start);
  assert.ok(book > start && title > book);
  assert.equal((template.match(/class="tt-book2"/g) || []).length, 1);
  assert.equal((template.match(/id="email-link"/g) || []).length, 1);
  const app = await readFile('assets/app/app.js', 'utf8');
  assert.ok(!app.includes('tt-arrival-copy'));
  assert.ok((await readFile('preview/assets/app/app.js', 'utf8')).includes('tt-arrival-copy'));
  assert.ok(!(await readFile('assets/css/works.css', 'utf8')).includes('.tt-process'));
});
