import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('every page says whose site it is: the name in the top bar and on the first screen', async () => {
  const site = JSON.parse(await readFile('assets/data/site-content.json', 'utf8'));
  assert.equal(site.home.tagline, '우리의 이야기가 음악이 되는 곳');
  for (const prefix of ['', 'en/', 'ja/']) {
    const html = await readFile(prefix + 'index.html', 'utf8');
    assert.ok(/<img class="jy-wm" src="\/assets\/logo\/lockup-line-ink\.svg"/.test(html), `${prefix}: the top bar names TALETONE MUSIC (its one-line lockup)`);
    assert.ok(/class="jy-brand"><img src="\/assets\/logo\/lockup-ink\.svg" alt="TALETONE MUSIC">/.test(html), `${prefix}: the first screen names TALETONE MUSIC (its lockup)`);
    assert.ok(html.indexOf('class="jy-brand"') > -1 && html.indexOf('class="jy-brand"') < html.indexOf('<h1>'), `${prefix}: the name comes before the first words`);
    assert.ok(html.includes('content="index, follow"'));
  }
});

// The journey (a phone, a line, the record of every story) is the site; /preview/ leads to it.
test('the site is the journey: indexed, every chapter and every work in the document', async () => {
  const works = JSON.parse(await readFile('assets/data/works-data.json', 'utf8')).works;
  for (const prefix of ['', 'en/', 'ja/']) for (const route of ['', 'about/', 'approach/', 'discography/', 'contact/']) {
    const html = await readFile(`${prefix}${route}index.html`, 'utf8');
    assert.ok(html.includes('content="index, follow"') && !html.includes('noindex'), `${prefix}${route}: the site must be indexed`);
    assert.ok(html.includes(`<link rel="canonical" href="https://taletone.net/${prefix}${route}">`), `${prefix}${route}: canonical`);
    const old = await readFile(`preview/${prefix}${route}index.html`, 'utf8');
    assert.ok(old.includes('noindex') && old.includes(`url=/${prefix}${route}"`), `preview/${prefix}${route}: must lead to the live chapter`);
    for (const ch of ['pro', 'tale', 'tone', 'case', 'music', 'done', 'record', 'epi']) assert.ok(html.includes(`data-ch="${ch}"`), `${prefix}${route}: chapter ${ch} missing`);
    assert.equal((html.match(/class="jy-sw(?: pin)?"/g) || []).length, works.length, `${prefix}${route}: the record must list every work`);
    // the featured works (pinned 1, 2, 3) open the record, in their order, marked as featured
    const first = [...html.matchAll(/<li class="jy-sw( pin)?"[^>]*data-slug="([^"]+)"/g)].slice(0, 4).map((m) => [m[2], !!m[1]]);
    const pinned = works.filter((w) => w.pinned).sort((a, b) => a.pinned - b.pinned).map((w) => w.slug);
    assert.deepEqual(first.slice(0, pinned.length), pinned.map((s) => [s, true]), `${prefix}${route}: the featured works must come first, in order`);
    assert.equal(first[pinned.length] && first[pinned.length][1], false, `${prefix}${route}: only the featured works are marked`);
    // the intro comes first, then the philosophy, then a real project; the chapter rail is always there
    assert.ok(html.indexOf('id="jy-creed"') < html.indexOf('id="jy-case-req"') && html.includes('data-open="love-dopamine"'), 'the Love Dopamine case follows the philosophy');
    assert.ok(html.indexOf('id="jy-hello"') < html.indexOf('id="jy-creed"') && html.indexOf('id="jy-creed"') < html.indexOf('id="discography"'));
    assert.equal((html.match(/<a href="[^"]*" data-go="(?:pro|tale|tone|record|epi)">/g) || []).length, 10, 'rail and menu each list the five chapters');
    assert.ok(/name="project" required="required"/.test(html) && /name="reply" type="email" required="required"/.test(html), 'project and email are required');
    assert.ok(!/수면|바닷속|마법의 서|심해/.test(html), `${prefix}${route}: sea or book words in the journey`);
  }
  const js = await readFile('assets/journey/journey.js', 'utf8');
  assert.ok(js.includes('api.web3forms.com/submit'), 'the inquiry is really sent');
  assert.ok(js.includes("matchMedia('(prefers-reduced-motion: reduce)')"));
});
