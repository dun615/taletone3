import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the approved journey is shared by live and preview with the book before contact', async () => {
  const site = JSON.parse(await readFile('assets/data/site-content.json', 'utf8'));
  for (const lang of ['kr', 'en', 'jp']) {
    assert.equal(site.projects.translations[lang].proof.rows.length, 3);
    assert.ok(site.home.translations[lang].journeyIntro);
    assert.ok(site.contact.translations[lang].arrivalLabel);
  }
  assert.equal(site.home.tagline, '우리의 이야기가 음악이 되는 곳');
  assert.ok(!JSON.stringify([site.home,site.projects,site.contact,site.bridges]).includes('당신'));
  const template = await readFile('src/app/template.html', 'utf8');
  const start = template.indexOf('<section id="c-contact"');
  const book = template.indexOf('class="tt-book2"', start);
  const title = template.indexOf('tt-contact-title', start);
  assert.ok(book > start && title > book);
  assert.equal((template.match(/class="tt-book2"/g) || []).length, 1);
  assert.equal((template.match(/id="email-link"/g) || []).length, 1);
  for (const prefix of ['', 'preview/']) {
    assert.ok((await readFile(prefix+'assets/app/app.js', 'utf8')).includes('tt-arrival-copy'));
    assert.ok((await readFile(prefix+'assets/css/works.css', 'utf8')).includes('.tt-process'));
  }
  for (const prefix of ['', 'en/', 'ja/']) {
    assert.ok((await readFile('preview/'+prefix+'index.html','utf8')).includes('content="noindex, nofollow"'));
    assert.ok((await readFile(prefix+'index.html','utf8')).includes('content="index, follow"'));
  }
});
