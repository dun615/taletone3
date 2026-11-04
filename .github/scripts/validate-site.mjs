// Static checks of the built site: the journey at the five chapter routes in three languages, the redirects, the
// sitemap and robots, and the data every page and the record depend on. Run after `node scripts/build.mjs`.
import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { checkWorks } from '../../scripts/works-model.mjs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const text = (file) => readFile(path.join(root, file), 'utf8');
const exists = async (file) => { try { await access(path.join(root, file)); return true; } catch { return false; } };
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);
const cleanRef = (value) => value.trim().replace(/&amp;/gi, '&').split(/[?#]/)[0].replace(/^\/+/, '');
const duplicateIds = (html) => { const seen = new Set(), dup = new Set(); for (const m of html.matchAll(/\sid="([^"]+)"/g)) { if (seen.has(m[1])) dup.add(m[1]); seen.add(m[1]); } return [...dup]; };

const BASE = 'https://taletone.net';
const languages = [{ key: 'kr', prefix: '', html: 'ko' }, { key: 'en', prefix: 'en/', html: 'en' }, { key: 'jp', prefix: 'ja/', html: 'ja' }];
const routes = ['', 'approach/', 'about/', 'discography/', 'contact/'];
const CHAPTERS = ['pro', 'tale', 'tone', 'case', 'music', 'done', 'record', 'epi'];

// generated files are current
try { execFileSync(process.execPath, ['scripts/build.mjs', '--check'], { cwd: root, stdio: 'pipe' }); }
catch (e) { assert(false, `generated files are out of date: ${String(e.stderr || e.stdout || e.message).trim()}`); }

const site = JSON.parse(await text('assets/data/site-content.json'));
const works = JSON.parse(await text('assets/data/works-data.json')).works;
const assetsCss = await text('assets/journey/journey.css'), assetsJs = await text('assets/journey/journey.js');

// ---- the pages ----
for (const lang of languages) for (const route of routes) {
  const file = `${lang.prefix}${route}index.html`, url = `${BASE}/${lang.prefix}${route}`;
  if (!(await exists(file))) { assert(false, `${file}: missing`); continue; }
  const html = await text(file);
  assert(new RegExp(`<html lang="${lang.html}"[ >]`).test(html), `${file}: html lang is not ${lang.html}`);
  assert(/<title>[^<]{8,}<\/title>/.test(html), `${file}: title missing`);
  assert(/<meta name="description" content="[^"]{20,}">/.test(html), `${file}: description missing`);
  assert(html.includes('<meta name="robots" content="index, follow">') && !html.includes('noindex'), `${file}: must be indexable`);
  assert(html.includes(`<link rel="canonical" href="${url}">`), `${file}: canonical is not ${url}`);
  for (const l of languages) assert(html.includes(`<link rel="alternate" hreflang="${l.html}" href="${BASE}/${l.prefix}${route}">`), `${file}: hreflang ${l.html} missing`);
  assert(html.includes(`hreflang="x-default" href="${BASE}/${route}"`), `${file}: x-default missing`);
  for (const p of ['og:title', 'og:description', 'og:url', 'og:image']) assert(html.includes(`property="${p}"`), `${file}: ${p} missing`);
  const og = (html.match(/property="og:image" content="https:\/\/taletone\.net\/([^"?]+)/) || [])[1];
  assert(og && await exists(og), `${file}: og:image ${og} missing`);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  try { JSON.parse(ld ? ld[1] : ''); } catch { assert(false, `${file}: structured data is not valid JSON`); }
  for (const ch of CHAPTERS) assert(html.includes(`data-ch="${ch}"`), `${file}: chapter ${ch} missing`);
  assert((html.match(/class="jy-sw(?: pin)?"/g) || []).length === works.length, `${file}: the record must list every work`);
  assert(duplicateIds(html).length === 0, `${file}: duplicate ids ${duplicateIds(html).join(', ')}`);
  assert(html.includes(`journey.css?v=${hash(assetsCss)}`) && html.includes(`journey.js?v=${hash(assetsJs)}`), `${file}: journey asset versions are not their content hashes`);
  assert(html.length < 160_000, `${file}: document ${html.length} bytes > 160000`);
  // every local file the page refers to exists
  for (const m of html.matchAll(/\s(?:src|href|poster|data-src|data-paper|data-ink)="(\/[^"]*)"/g)) {
    const ref = cleanRef(m[1]); if (!ref || ref.endsWith('/')) continue;
    assert(await exists(ref), `${file}: missing ${m[1]}`);
  }
  // internal chapter links stay within the language
  for (const m of html.matchAll(/<a href="(\/[^"]*)" data-go="[a-z]+"/g)) assert(m[1].startsWith(`/${lang.prefix}`), `${file}: chapter link ${m[1]} leaves the language`);
}
for (const lang of languages) assert(await exists(`assets/journey/data-${lang.key}.js`), `assets/journey/data-${lang.key}.js missing`);

// ---- the old addresses lead to the live chapters ----
for (const lang of languages) {
  for (const route of routes) {
    const file = `preview/${lang.prefix}${route}index.html`;
    const html = (await exists(file)) ? await text(file) : '';
    assert(html.includes('noindex') && html.includes(`url=/${lang.prefix}${route}"`), `${file}: must redirect to /${lang.prefix}${route}`);
  }
  for (const [from, to] of [['members/', 'about/'], ['story-types/', 'approach/'], ['projects/', 'approach/'], ['works/', 'discography/']]) {
    const html = (await exists(`${lang.prefix}${from}index.html`)) ? await text(`${lang.prefix}${from}index.html`) : '';
    assert(html.includes(`url=/${lang.prefix}${to}"`), `${lang.prefix}${from}: must redirect to /${lang.prefix}${to}`);
  }
}

// ---- sitemap and robots ----
const sitemap = await text('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
assert(locs.length === 15, `sitemap.xml lists ${locs.length} pages, expected 15`);
for (const lang of languages) for (const route of routes) assert(locs.includes(`${BASE}/${lang.prefix}${route}`), `sitemap.xml: missing ${BASE}/${lang.prefix}${route}`);
const robots = await text('robots.txt');
assert(robots.includes(`Sitemap: ${BASE}/sitemap.xml`), 'robots.txt: no sitemap');
for (const line of robots.split('\n')) if (/^Disallow:\s*\/(?:en|ja|about|approach|discography|contact)?\/?\s*$/.test(line)) assert(false, `robots.txt blocks a live route: ${line}`);

// ---- data ----
// every work by the rules in scripts/works-model.mjs (the same rules the page and `npm run audit` use)
const model = checkWorks(works, (p) => existsSync(path.join(root, p)));
for (const e of model.errors) assert(false, e);
for (const w of model.warnings) console.warn(`warning: ${w}`);
for (const lang of ['en', 'jp']) for (const key of ['notify', 'notifyTitle', 'enterAction', 'found', 'letter', 'empty', 'contactTitle', 'askNext', 'goOn', 'featuredLabel', 'rooms']) assert(site.journey.translations[lang][key], `journey.${key} missing in ${lang}`);
for (const f of ['assets/video/lockscreen.mp4', 'assets/video/lockscreen.jpg', 'assets/fonts/line-seed-kr-400.woff2', 'assets/fonts/line-seed-kr-700.woff2', 'assets/social/og-image.jpg', 'assets/social/og-image-en.jpg', 'assets/social/og-image-ja.jpg', 'CNAME', '404.html']) assert(await exists(f), `${f} missing`);

if (errors.length) {
  console.error(`Site validation failed:\n- ${errors.join('\n- ')}`);
  if (process.env.GITHUB_ACTIONS) for (const e of errors) console.log(`::error title=Site check::${String(e).replace(/\r?\n/g, ' ')}`);
  process.exit(1);
}
console.log(`Site validation passed: ${languages.length * routes.length} pages, their redirects, the sitemap and ${works.length} works.`);
