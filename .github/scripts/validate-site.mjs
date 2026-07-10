import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const routes = [
  ['home', 'index.html', '/', 'TALETONE MUSIC'],
  ['story-types', 'story-types/index.html', '/story-types/', 'Story Types'],
  ['members', 'members/index.html', '/members/', 'Members'],
  ['works', 'works/index.html', '/works/', 'Works'],
  ['news', 'news/index.html', '/news/', 'News'],
  ['contact', 'contact/index.html', '/contact/', 'Contact'],
];
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const text = (file) => readFile(path.join(root, file), 'utf8');
const exists = async (file) => { try { await access(path.join(root, file)); return true; } catch { return false; } };
const attr = (html, pattern) => html.match(pattern)?.[1] || '';
const cleanText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const rawEditorMarkers = [
  '{' + '{', 'SEO' + ' EDITOR', 'COPY' + ' JSON', 'SEO' + '_MESSAGE',
  'seo' + 'EditMode', 'members' + 'EditMode', '<sc-' + 'if', '<sc-' + 'for',
  'onclick="' + '{' + '{', 'value="' + '{' + '{',
];

const required = [
  ...routes.map(([, file]) => file), 'projects/index.html', '404.html', 'robots.txt',
  'sitemap.xml', 'site.webmanifest', 'CNAME', 'support.js',
  'assets/data/site-content.json', 'assets/data/site-content.js',
  'assets/data/seo-content.json', 'assets/data/seo-content.js',
  'assets/data/works-data.json', 'assets/vendor/react-18.3.1.min.js',
  'assets/vendor/react-dom-18.3.1.min.js',
];
for (const file of required) assert(await exists(file), `missing required file: ${file}`);

const payloadHashes = [];
const fallbackHashes = new Map();
for (const [key, file, route, expectedTitle] of routes) {
  const html = await text(file);
  const title = attr(html, /<title>([\s\S]*?)<\/title>/i);
  const description = attr(html, /<meta\s+name="description"\s+content="([^"]+)"/i);
  const canonical = attr(html, /<link\s+rel="canonical"\s+href="([^"]+)"/i);
  assert(title.includes(expectedTitle), `${file}: unexpected title`);
  assert(description.length >= 18, `${file}: description is too short`);
  assert(canonical === `https://taletone.net${route}`, `${file}: canonical mismatch`);
  for (const lang of ['ko', 'en', 'ja', 'x-default']) {
    assert(new RegExp(`<link\\s+rel="alternate"\\s+hreflang="${lang}"`, 'i').test(html), `${file}: missing hreflang ${lang}`);
  }
  for (const meta of ['og:title', 'og:description', 'og:image']) {
    assert(new RegExp(`<meta\\s+property="${meta}"\\s+content="[^"]+"`, 'i').test(html), `${file}: missing ${meta}`);
  }
  for (const meta of ['twitter:title', 'twitter:description', 'twitter:image']) {
    assert(new RegExp(`<meta\\s+name="${meta}"\\s+content="[^"]+"`, 'i').test(html), `${file}: missing ${meta}`);
  }
  assert(/<meta\s+name="referrer"\s+content="strict-origin-when-cross-origin">/i.test(html), `${file}: missing referrer policy`);
  assert(!rawEditorMarkers.some((marker) => html.includes(marker)), `${file}: raw editor/template markup exposed`);

  const ld = attr(html, /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  try { JSON.parse(ld); } catch { errors.push(`${file}: invalid JSON-LD`); }

  const payload = attr(html, /<script\s+type="application\/octet-stream"\s+data-dc-template-b64>([\s\S]*?)<\/script>/i).replace(/\s/g, '');
  assert(payload.length > 1000, `${file}: encoded app template missing`);
  if (payload) {
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    payloadHashes.push(createHash('sha256').update(decoded).digest('hex'));
    assert(decoded.includes('assets/js/image-slot.js?v=20260710-p1'), `${file}: stale image-slot cache key`);
    assert(decoded.includes('assets/js/works.js?v=20260710-p1-p2-final15'), `${file}: stale works cache key`);
  }

  const fallback = attr(html, /<noscript>([\s\S]*?)<\/noscript>/i);
  const fallbackText = cleanText(fallback);
  assert(fallbackText.length > 80, `${file}: fallback content is too short`);
  fallbackHashes.set(key, createHash('sha256').update(fallbackText).digest('hex'));
}
assert(new Set(payloadHashes).size === 1, 'route app templates are not synchronized');
assert(new Set(fallbackHashes.values()).size === routes.length, 'route fallback content is not unique');

const readJson = async (file) => JSON.parse(await text(file));
const siteJson = await readJson('assets/data/site-content.json');
const seoJson = await readJson('assets/data/seo-content.json');
const worksJson = await readJson('assets/data/works-data.json');
const parseAssignedJson = (source, name) => {
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  assert(source.includes(name), `${name} assignment missing`);
  return JSON.parse(source.slice(start, end + 1));
};
const siteJs = parseAssignedJson(await text('assets/data/site-content.js'), 'window.TALETONE_CONTENT');
const seoSource = await text('assets/data/seo-content.js');
const seoJs = parseAssignedJson(seoSource, 'window.TALETONE_SEO_CONTENT');
assert(JSON.stringify(siteJson) === JSON.stringify(siteJs), 'site-content JSON/JS drift');
assert(JSON.stringify(seoJson) === JSON.stringify(seoJs), 'seo-content JSON/JS drift');
assert(seoSource.includes('window.TALETONE_SEO = window.TALETONE_SEO_CONTENT'), 'SEO runtime alias missing');
assert(Array.isArray(worksJson.works) && worksJson.works.length > 0, 'works data is empty');
assert(new Set(worksJson.works.map((work) => work.id)).size === worksJson.works.length, 'duplicate works IDs');

const assetRefs = new Set();
const collectAssets = (value) => {
  if (Array.isArray(value)) return value.forEach(collectAssets);
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) {
    if (typeof child === 'string' && /^assets[\\/]/i.test(child)) assetRefs.add(child.replace(/\\/g, '/').split(/[?#]/)[0]);
    else collectAssets(child);
  }
};
[siteJson, worksJson].forEach(collectAssets);
for (const file of assetRefs) assert(await exists(file), `missing referenced asset: ${file}`);

const support = await text('support.js');
assert(support.includes('assets/vendor/react-18.3.1.min.js'), 'React is not self-hosted');
assert(support.includes('assets/vendor/react-dom-18.3.1.min.js'), 'ReactDOM is not self-hosted');
assert(support.includes('window.parent !== window'), 'public duplicate document fetch guard missing');
const sri = {
  'assets/vendor/react-18.3.1.min.js': 'DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z',
  'assets/vendor/react-dom-18.3.1.min.js': 'gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1',
};
for (const [file, expected] of Object.entries(sri)) {
  const bytes = await readFile(path.join(root, file));
  assert(createHash('sha384').update(bytes).digest('base64') === expected, `${file}: integrity mismatch`);
}

const redirect = await text('projects/index.html');
assert(/noindex/i.test(redirect) && /\/story-types\//.test(redirect), 'legacy projects redirect is invalid');
const notFound = await text('404.html');
assert(/noindex/i.test(notFound) && /href="\/works\/"/.test(notFound), '404 page is not index-safe or navigable');

const forbidden = [
  ['5', '30'].join(''),
  ['LI', 'LPA'].join(''),
  ['EP', 'IC7'].join(''),
  ['Always', ' with you'].join(''),
  '\uCE58\uC5B4\uB9AC\uB529',
  ['J-', 'ROCK'].join(''),
  '\uBCF5\uC2DD',
  '\uC57C\uAD6C\uBD80',
  ['010', '-'].join(''),
];
const publicText = [JSON.stringify(siteJson), JSON.stringify(seoJson), JSON.stringify(worksJson)].join('\n');
for (const term of forbidden) assert(!publicText.toLowerCase().includes(term.toLowerCase()), `forbidden public term found: ${term}`);

if (errors.length) {
  console.error(`Site validation failed (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Site validation passed: ${routes.length} routes, ${assetRefs.size} referenced assets, ${worksJson.works.length} works.`);
