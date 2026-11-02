import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the live site keeps its approved journey with the book before contact', async () => {
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
  assert.ok((await readFile('assets/app/app.js', 'utf8')).includes('tt-arrival-copy'));
  assert.ok((await readFile('assets/css/works.css', 'utf8')).includes('.tt-process'));
  for (const prefix of ['', 'en/', 'ja/']) assert.ok((await readFile(prefix+'index.html','utf8')).includes('content="index, follow"'));
});

// /preview/ hosts the new journey (a phone, a line, the record of every story) until it replaces the live site.
test('the preview is the new journey: not indexed, every chapter and every work in the document', async () => {
  const site = JSON.parse(await readFile('assets/data/site-content.json', 'utf8'));
  const works = JSON.parse(await readFile('assets/data/works-data.json', 'utf8')).works;
  for (const lang of ['en', 'jp']) for (const key of ['notify', 'ask', 'wire', 'landscape', 'letter', 'found', 'empty', 'contactTitle', 'received']) assert.ok(site.journey.translations[lang][key], `journey.${key} missing in ${lang}`);
  // each path has its featured works, chosen in the data
  for (const branch of ['game', 'artist', 'anim']) assert.ok(works.some((w) => w.journey && w.journey.branch === branch), `no featured work for ${branch}`);
  for (const prefix of ['', 'en/', 'ja/']) for (const route of ['', 'about/', 'approach/', 'discography/', 'contact/']) {
    const html = await readFile(`preview/${prefix}${route}index.html`, 'utf8');
    assert.ok(html.includes('content="noindex, nofollow"'), `${prefix}${route}: preview must not be indexed`);
    for (const ch of ['pro', 'tale', 'tone', 'music', 'done', 'record', 'epi']) assert.ok(html.includes(`data-ch="${ch}"`), `${prefix}${route}: chapter ${ch} missing`);
    assert.equal((html.match(/class="jy-sw"/g) || []).length, works.length, `${prefix}${route}: the record must list every work`);
    assert.equal((html.match(/class="jy-reply"/g) || []).length, 3);
    assert.ok(/name="project" required="required"/.test(html) && /name="reply" type="email" required="required"/.test(html), 'project and email are required');
    assert.ok(!/수면|바닷속|마법의 서|심해/.test(html), `${prefix}${route}: sea or book words in the journey`);
  }
  const js = await readFile('preview/assets/journey/journey.js', 'utf8');
  assert.ok(js.includes('api.web3forms.com/submit') && js.includes('COPY.branchLine'), 'the inquiry is really sent and names the chosen path');
  assert.ok(js.includes("matchMedia('(prefers-reduced-motion: reduce)')"));
});
