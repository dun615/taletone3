// Builds every generated file from its editable source:
//   scripts/journey-page.mjs, src/journey/* + assets/data/*.json -> the five chapter routes in KR (/), EN (/en/)
//                                                                 and JP (/ja/), and assets/journey/*
//   assets/data/seo-content.json                                -> sitemap.xml
//   the retired addresses (/preview/, /members/, ...)           -> redirect pages
//
//   node scripts/build.mjs          rewrite generated files
//   node scripts/build.mjs --check  fail if any generated file is out of date
//   node scripts/build.mjs --list   print the generated files (they are built in CI, not committed)
//
// Edit the sources, never the generated output.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { japaneseCharacters } from './font-coverage.mjs';
import { renderJourney } from './journey-page.mjs';
import { journeyData } from './journey-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const listOnly = process.argv.includes('--list');
const read = (file) => readFile(path.join(root, file), 'utf8');
const readJson = async (file) => JSON.parse(await read(file));

// Content keys stay kr/en/jp; URLs and html lang use ISO codes.
const languages = [
  { key: 'kr', html: 'ko', prefix: '', locale: 'ko_KR', label: '한국어' },
  { key: 'en', html: 'en', prefix: '/en', locale: 'en_US', label: 'English' },
  { key: 'jp', html: 'ja', prefix: '/ja', locale: 'ja_JP', label: '日本語' },
];

const [siteJsonText, seoJsonText, works] = await Promise.all([
  read('assets/data/site-content.json'),
  read('assets/data/seo-content.json'),
  readJson('assets/data/works-data.json'),
]);
const site = JSON.parse(siteJsonText);
const seo = JSON.parse(seoJsonText);
const baseUrl = seo.baseUrl.replace(/\/+$/, '');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const localized = (item, lang) => ({ ...item, ...((item && item.translations && item.translations[lang]) || {}) });
const urlFor = (lang, pagePath) => `${baseUrl}${lang.prefix}${pagePath}`;
const fileFor = (lang, pagePath) => `${lang.prefix.slice(1)}${pagePath}index.html`.replace(/^\//, '');
// Cloudflare Web Analytics: set seo-content.json → analytics.cloudflareToken to switch it on.
const analyticsToken = String(seo.analytics?.cloudflareToken || '').trim();
const analyticsTag = analyticsToken
  ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: analyticsToken })}'></script>`
  : '';
const version = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12);
function pageCopy(page, lang) {
  return { title: page.title, description: page.description, ...((page.translations && page.translations[lang.key]) || {}) };
}

function jsonLd(page, lang) {
  const copy = pageCopy(page, lang);
  const home = pageCopy(seo.pages.find((p) => p.key === 'home'), lang);
  const rootUrl = `${baseUrl}/`;
  const organization = {
    '@type': 'Organization',
    '@id': `${rootUrl}#organization`,
    name: seo.siteName,
    alternateName: seo.alternateNames,
    url: rootUrl,
    logo: `${rootUrl}assets/icons/icon-512.png`,
    email: site.contact.email,
    description: home.description,
  };
  const website = {
    '@type': 'WebSite',
    '@id': `${rootUrl}#website`,
    name: seo.siteName,
    alternateName: seo.alternateNames,
    url: rootUrl,
    inLanguage: ['ko', 'en', 'ja'],
    publisher: { '@id': `${rootUrl}#organization` },
  };
  const webPage = {
    '@type': 'WebPage',
    '@id': `${urlFor(lang, page.path)}#webpage`,
    name: copy.title,
    url: urlFor(lang, page.path),
    description: copy.description,
    inLanguage: lang.html,
    isPartOf: { '@id': `${rootUrl}#website` },
    about: { '@id': `${rootUrl}#organization` },
  };
  const navigation = seo.pages.map((entry,index)=>({'@type':'SiteNavigationElement',position:index+1,name:entry.label,url:urlFor(lang,entry.path)}));
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [organization, website, webPage, ...navigation] }).replace(/</g, '\\u003c');
}

const missingSlug = works.works.find((item) => !/^[a-z0-9-]+$/.test(item.slug || ''));
if (missingSlug) throw new Error(`Every work needs a lowercase "slug": ${missingSlug.id || missingSlug.slotId}`);

function sitemap() {
  const entry = (pathFor) => languages.map((lang) => [
    '  <url>',
    `    <loc>${baseUrl}${pathFor(lang)}</loc>`,
    ...languages.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.html}" href="${baseUrl}${pathFor(l)}"/>`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${pathFor(languages[0])}"/>`,
    '  </url>',
  ].join('\n'));
  const urls = [
    ...seo.pages.flatMap((page) => entry((lang) => `${lang.prefix}${page.path}`)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

// ---- The site: the journey (a phone, a line, the record of every story) at the five chapter routes ----
// Its sources are src/journey/* and scripts/journey-page.mjs, reading the data files; /preview/ redirects here.
// the page's styles: the parts in src/journey/css/, in file-name order (later parts win where they overlap)
const journeyCssParts = (await readdir(path.join(root, 'src/journey/css'))).filter((f) => f.endsWith('.css')).sort();
const journeyCss = `/* GENERATED by scripts/build.mjs from src/journey/css/*.css (in file-name order). Edit those, not this. */\n${(await Promise.all(journeyCssParts.map(async (f) => `/* ==== src/journey/css/${f} ==== */\n${await read(`src/journey/css/${f}`)}`))).join('')}`;
// the page's script: the parts in src/journey/js/, in file-name order, in one scope (see ARCHITECTURE.md)
const journeyParts = (await readdir(path.join(root, 'src/journey/js'))).filter((f) => f.endsWith('.js')).sort();
const journeyJs = `// GENERATED by scripts/build.mjs from src/journey/js/*.js (in file-name order). Edit those, not this.
(() => {
'use strict';
if (!window.TT_JOURNEY) return;
${(await Promise.all(journeyParts.map(async (f) => `// ==== src/journey/js/${f} ====\n${await read(`src/journey/js/${f}`)}`))).join('\n')}})();
`;
const lineSeedJpUrl = `https://fonts.googleapis.com/css2?family=LINE+Seed+JP:wght@100;400;700&display=swap&text=${encodeURIComponent(await japaneseCharacters(root))}`;
const scriptCopyKeys = [...new Set([...journeyJs.matchAll(/\bCOPY\.(\w+)/g)].map((m) => m[1]))].sort();
const journeyDataFor = (lang) => journeyData(site, works, lang.key, scriptCopyKeys);
// what search engines and link previews read: canonical, alternates, social cards, structured data, analytics
const liveHead = (page, lang) => {
  const copy = pageCopy(page, lang), url = urlFor(lang, page.path), og = `${baseUrl}/assets/social/og-image${{ kr: '', en: '-en', jp: '-ja' }[lang.key]}.jpg?v=20261104-phone`;
  return [
    '<meta name="robots" content="index, follow">',
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    '<meta name="naver-site-verification" content="23ea8d36f5a701c952745fc9f07f3be5398091d9">',
    '<meta name="msvalidate.01" content="DEFAC52B48D954826EA12E5564081FD6">',
    `<link rel="canonical" href="${url}">`,
    ...languages.map((l) => `<link rel="alternate" hreflang="${l.html}" href="${urlFor(l, page.path)}">`),
    `<link rel="alternate" hreflang="x-default" href="${urlFor(languages[0], page.path)}">`,
    '<meta property="og:type" content="website">', '<meta property="og:site_name" content="TALETONE MUSIC">',
    `<meta property="og:title" content="${esc(copy.title)}">`, `<meta property="og:description" content="${esc(copy.description)}">`,
    `<meta property="og:url" content="${url}">`, `<meta property="og:image" content="${og}">`, `<meta property="og:image:alt" content="${esc(copy.title)}">`,
    '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
    `<meta property="og:locale" content="${lang.locale}">`, ...languages.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${l.locale}">`),
    '<meta name="twitter:card" content="summary_large_image">', `<meta name="twitter:title" content="${esc(copy.title)}">`,
    `<meta name="twitter:description" content="${esc(copy.description)}">`, `<meta name="twitter:image" content="${og}">`,
    '<link rel="manifest" href="/site.webmanifest">',
    `<script type="application/ld+json">${jsonLd(page, lang)}</script>`,
    analyticsTag,
  ].filter(Boolean).join('\n');
};
const journeyAssets = (lang) => ({
  css: `/assets/journey/journey.css?v=${version(journeyCss)}`,
  js: `/assets/journey/journey.js?v=${version(journeyJs)}`,
  data: `/assets/journey/data-${lang.key}.js?v=${version(journeyDataFor(lang))}`,
  lineSeedJp: lineSeedJpUrl.replace(/&/g, '&amp;'),
});
const journeyOutputs = [
  ...seo.pages.flatMap((page) => languages.map((lang) => [fileFor(lang, page.path), renderJourney({
    lang, route: page.path, seoPage: localized(page, lang.key), site, worksData: works, base: '', assets: journeyAssets(lang), head: liveHead(page, lang),
  })])),
  ['assets/journey/journey.css', journeyCss],
  ['assets/journey/journey.js', journeyJs],
  ...languages.map((lang) => [`assets/journey/data-${lang.key}.js`, journeyDataFor(lang)]),
];

// Retired News and RSS have no replacement. Remove prior generated artifacts so Pages serves 404.
if (!check && !listOnly) {
  for (const prefix of ['', 'en/', 'ja/', 'preview/', 'preview/en/', 'preview/ja/']) {
    // the Works detail pages are retired too (not indexed, not linked)
    for (const relative of [prefix+'news', prefix+'rss.xml', ...works.works.flatMap(work=>[prefix+'discography/'+work.slug, prefix+'works/'+work.slug])]) {
      const target=path.resolve(root,relative);
      if(!target.startsWith(root+path.sep)) throw new Error('Invalid retired route path');
      await rm(target,{recursive:true,force:true});
    }
  }
}
// GitHub Pages serves static files: preserve legacy links with immediate HTML redirects.
// These aliases never appear in the sitemap or internal navigation.
const redirectPage = (target, lang) => `<!DOCTYPE html>
<html lang="${lang.html}"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow">
<title>Page moved | TALETONE MUSIC</title><link rel="canonical" href="${baseUrl}${target}">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
</head><body><a href="${target}">Continue to TALETONE MUSIC</a></body></html>`;
const legacyOutputs = languages.flatMap(lang => {
  const prefix=lang.prefix;
  const pairs=[['/members/','/about/'],['/story-types/','/approach/'],['/projects/','/approach/'],['/works/','/discography/']];
  return pairs.map(([from,to])=>[(prefix+from+'index.html').slice(1),redirectPage(prefix+to,lang)]);
});
// the preview became the site: its addresses (and their old aliases) lead to the same chapter of the live one
const previewRedirects = languages.flatMap((lang) => [
  ...seo.pages.map((page) => [`preview/${fileFor(lang, page.path)}`, redirectPage(lang.prefix + page.path, lang)]),
  ...[['/members/', '/about/'], ['/story-types/', '/approach/'], ['/projects/', '/approach/'], ['/works/', '/discography/']].map(([from, to]) => [`preview${lang.prefix}${from}index.html`, redirectPage(lang.prefix + to, lang)]),
]);
const outputs = [
  ...legacyOutputs,
  ...journeyOutputs,
  ...previewRedirects,
  ['sitemap.xml', sitemap()],
];

if (listOnly) { console.log(outputs.map(([relative]) => relative).join('\n')); process.exit(0); }

const stale = [];
for (const [relative, content] of outputs) {
  const file = path.join(root, relative);
  let current = null;
  try { current = await readFile(file, 'utf8'); } catch {}
  if (current === content) continue;
  stale.push(relative);
  if (!check) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
}

if (check && stale.length) {
  console.error(`Generated files are out of date: ${stale.join(', ')}`);
  console.error('Run `node scripts/build.mjs` and commit the result.');
  process.exit(1);
}
console.log(check
  ? `Generated files are up to date (${outputs.length} files).`
  : stale.length ? `Rebuilt ${stale.length} file(s): ${stale.join(', ')}` : 'All generated files already up to date.');
