import { access, readFile, readdir } from 'node:fs/promises';
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
const cleanRef = (value) => value.trim().replace(/&amp;/gi, '&').split(/[?#]/)[0].replace(/^\/+/, '');
const ignoredRef = (value) => !value || /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i.test(value) || value.includes('{' + '{') || value.includes('&#');
const duplicateIds = (html) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const match of html.matchAll(/\sid=["']([^"']+)["']/gi)) {
    if (seen.has(match[1])) duplicates.add(match[1]);
    seen.add(match[1]);
  }
  return [...duplicates];
};
const walkFiles = async (directory = root, prefix = '') => {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walkFiles(absolute, relative));
    else found.push(relative);
  }
  return found;
};
const rawEditorMarkers = [
  '{' + '{', 'SEO' + ' EDITOR', 'COPY' + ' JSON', 'SEO' + '_MESSAGE',
  'seo' + 'EditMode', 'members' + 'EditMode', '<sc-' + 'if', '<sc-' + 'for',
  'onclick="' + '{' + '{', 'value="' + '{' + '{',
];
const expectedCacheKeys = {
  'assets/js/image-slot.js': '20260710-p1',
  'assets/css/works.css': '20260712-dlgfix',
  'assets/js/works.js': '20260712-dialog-tablet-hardfix',
};

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
let decodedApp = '';
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
    decodedApp ||= decoded;
    payloadHashes.push(createHash('sha256').update(decoded).digest('hex'));
    for (const [asset, cacheKey] of Object.entries(expectedCacheKeys)) {
      assert(decoded.includes(`${asset}?v=${cacheKey}`), `${file}: stale cache key for ${asset}`);
    }
  }

  const fallback = attr(html, /<noscript>([\s\S]*?)<\/noscript>/i);
  const fallbackText = cleanText(fallback);
  assert(fallbackText.length > 80, `${file}: fallback content is too short`);
  fallbackHashes.set(key, createHash('sha256').update(fallbackText).digest('hex'));
}
assert(new Set(payloadHashes).size === 1, 'route app templates are not synchronized');
assert(new Set(fallbackHashes.values()).size === routes.length, 'route fallback content is not unique');
assert(duplicateIds(decodedApp).length === 0, `decoded app template has duplicate IDs: ${duplicateIds(decodedApp).join(', ')}`);
assert(/id="content"\s+role="main"/i.test(decodedApp), 'decoded app template: main landmark missing');

const publicHtmlFiles = [...new Set([...routes.map(([, file]) => file), 'projects/index.html', '404.html'])];
for (const file of publicHtmlFiles) {
  const html = await text(file);
  assert(/^<!doctype html>/i.test(html.trimStart()), `${file}: missing HTML doctype`);
  assert((html.match(/<html\b/gi) || []).length === 1, `${file}: invalid html root count`);
  assert((html.match(/<head\b/gi) || []).length === 1 && (html.match(/<body\b/gi) || []).length === 1, `${file}: missing head or body`);
  assert(duplicateIds(html).length === 0, `${file}: duplicate IDs: ${duplicateIds(html).join(', ')}`);
  assert(!rawEditorMarkers.some((marker) => html.includes(marker)), `${file}: raw editor/template markup exposed`);
}

const inventory = await walkFiles();
const caseMap = new Map(inventory.map((file) => [file.toLowerCase(), file]));
const referencedPaths = [];
const inspectReference = (value, source, basePath = '/') => {
  const ref = value.trim();
  if (ignoredRef(ref)) return;
  if (/^http:\/\//i.test(ref)) errors.push(`${source}: mixed-content reference: ${ref}`);
  let url;
  try { url = new URL(ref, `https://taletone.net${basePath}`); } catch { errors.push(`${source}: invalid URL reference: ${ref}`); return; }
  if (url.origin !== 'https://taletone.net') return;
  let local = cleanRef(url.pathname).replace(/\/+$/, '');
  if (url.pathname.endsWith('/')) local = local ? `${local}/index.html` : 'index.html';
  else if (!local) local = 'index.html';
  referencedPaths.push([local, source, ref]);
};
const inspectHtmlReferences = (html, source, basePath) => {
  for (const match of html.matchAll(/\s(?:href|src|poster|action)=["']([^"']+)["']/gi)) inspectReference(match[1], source, basePath);
  for (const match of html.matchAll(/\ssrcset=["']([^"']+)["']/gi)) {
    for (const candidate of match[1].split(',')) inspectReference(candidate.trim().split(/\s+/)[0], source, basePath);
  }
  for (const match of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) inspectReference(match[1], source, basePath);
};
for (const [, file] of routes) inspectHtmlReferences(await text(file), file, '/');
inspectHtmlReferences(await text('projects/index.html'), 'projects/index.html', '/');
inspectHtmlReferences(await text('404.html'), '404.html', '/');
inspectHtmlReferences(decodedApp, 'decoded app template', '/');
for (const cssFile of inventory.filter((file) => file.endsWith('.css'))) {
  const css = await text(cssFile);
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) inspectReference(match[1], cssFile, `/${cssFile}`);
}
for (const [local, source, ref] of referencedPaths) {
  const actual = caseMap.get(local.toLowerCase());
  assert(Boolean(actual), `${source}: missing local reference ${ref}`);
  if (actual) assert(actual === local, `${source}: path case mismatch ${ref} (actual: ${actual})`);
}

const appIds = new Set([...decodedApp.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]));
for (const match of decodedApp.matchAll(/\shref=["']#([^"']+)["']/gi)) assert(appIds.has(match[1]), `decoded app template: dead anchor #${match[1]}`);

const robots = await text('robots.txt');
const sitemap = await text('sitemap.xml');
assert(/Sitemap:\s*https:\/\/taletone\.net\/sitemap\.xml/i.test(robots), 'robots.txt: sitemap declaration missing');
for (const [, , route] of routes) assert(sitemap.includes(`<loc>https://taletone.net${route}</loc>`), `sitemap.xml: missing ${route}`);
const manifest = JSON.parse(await text('site.webmanifest'));
for (const icon of manifest.icons || []) assert(await exists(cleanRef(icon.src || '')), `site.webmanifest: missing icon ${icon.src}`);

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
