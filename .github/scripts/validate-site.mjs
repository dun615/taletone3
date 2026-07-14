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
  'assets/css/works.css': '20260714-plunge-mobile-v2',
  'assets/js/works.js': '20260714-lazy-work-images-p1-v1',
};
const expectedSiteContentCacheKey = '20260714-member-colors-v4';

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
const scriptPayloadHashes = [];
const fallbackHashes = new Map();
let decodedApp = '';
let decodedScriptApp = '';
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
  assert(html.includes(`assets/data/site-content.js?v=${expectedSiteContentCacheKey}`), `${file}: stale site-content cache key`);

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
    assert(decoded.includes('id="intro-skyw"') && decoded.includes('id="intro-ocean"'), `${file}: original above-water intro is missing`);
    assert(decoded.includes('id="intro-sea"') && decoded.includes('id="intro-bubbles"'), `${file}: original underwater intro is missing`);
    assert(decoded.includes('background:{{ member.dotAccent }}'), `${file}: member card dot does not use dotAccent`);
    assert(!decoded.includes('Lightweight first-home-only intro'), `${file}: lightweight replacement intro still present`);
  }

  const scriptPayload = attr(html, /<script\b[^>]*\bdata-dc-script-b64\b[^>]*>([\s\S]*?)<\/script>/i).replace(/\s/g, '');
  assert(scriptPayload.length > 1000, `${file}: encoded app script missing`);
  if (scriptPayload) {
    const decodedScript = Buffer.from(scriptPayload, 'base64').toString('utf8');
    decodedScriptApp ||= decodedScript;
    scriptPayloadHashes.push(createHash('sha256').update(decodedScript).digest('hex'));
    assert(decodedScript.includes('Preserve the original plunge, then resolve the underwater frame into the real HOME DOM'), `${file}: continuous HOME handoff is missing`);
    assert(decodedScript.includes("#c-home > [data-px],#c-home > [data-reveal],#c-home > [data-bob]"), `${file}: intro does not assemble the real HOME elements`);
    assert(decodedScript.includes("forceIntro=new URLSearchParams(location.search).get('intro')==='1'"), `${file}: forced intro replay query is missing`);
    assert(decodedScript.includes("sessionStorage.setItem('tt_intro_home_v5','1')"), `${file}: restored intro session key is stale`);
    assert(decodedScript.includes("this.introEl.style.zIndex='4'") && decodedScript.includes("this.iContent.style.zIndex='5'"), `${file}: real HOME layer is not raised safely into the underwater frame`);
    assert(decodedScript.includes("this.iScene.style.opacity='1'") && decodedScript.includes('clipPath=sceneClip'), `${file}: underwater scene is not using the structural surface mask`);
    assert(decodedScript.includes('strokeDashoffset') && decodedScript.includes('targetBubble._targetX'), `${file}: HOME path/particle assembly is missing`);
    assert(decodedScript.includes('this.draw(0,this.P[this.mood],this._introMobile)'), `${file}: live HOME FX does not continue through the handoff`);
    assert(decodedScript.includes('this.iContent.scrollTop=0;'), `${file}: intro does not begin at the canonical HOME sky position`);
    assert(decodedScript.includes('var introSky=[introPalette.stops[0][1],introPalette.stops[0][2]];'), `${file}: intro HOME gradient is not using valid raw palette colors`);
    assert(decodedScript.includes('var backgroundBlend=this.smooth(0.04,0.72,handoff);') && decodedScript.includes('var lightSettle=this.smooth(0.38,0.78,handoff);'), `${file}: intro background settling phase is missing`);
    assert(decodedScript.includes('backgroundBlend>=0.999&&this._introHomeBackground'), `${file}: intro background does not lock to the exact HOME gradient`);
    assert(!decodedScript.includes('this.iScene.style.opacity=(1-sceneExit)'), `${file}: whole-scene opacity crossfade returned`);
    assert(!decodedScript.includes('assembly.finalOpacity*ae'), `${file}: HOME opacity crossfade returned`);
    assert(decodedScript.includes("this._visualViewport.addEventListener('resize',this.onResize"), `${file}: visual viewport resize handling is missing`);
    assert(decodedScript.includes('mobile?1.35:2'), `${file}: mobile canvas DPR cap is missing`);
    assert(decodedScript.includes("this.scroller.addEventListener('scroll',this._mobileScrollHandler"), `${file}: mobile scroll busy path is missing`);
  }

  const fallback = attr(html, /<noscript>([\s\S]*?)<\/noscript>/i);
  const fallbackText = cleanText(fallback);
  assert(fallbackText.length > 80, `${file}: fallback content is too short`);
  fallbackHashes.set(key, createHash('sha256').update(fallbackText).digest('hex'));
}
assert(new Set(payloadHashes).size === 1, 'route app templates are not synchronized');
assert(new Set(scriptPayloadHashes).size === 1, 'route app scripts are not synchronized');
assert(new Set(fallbackHashes.values()).size === routes.length, 'route fallback content is not unique');
assert(duplicateIds(decodedApp).length === 0, `decoded app template has duplicate IDs: ${duplicateIds(decodedApp).join(', ')}`);
assert(/id="content"\s+role="main"/i.test(decodedApp), 'decoded app template: main landmark missing');
assert(decodedScriptApp.includes('this.INTRO_PLUNGE_MS=2000') && decodedScriptApp.includes('var diveP=this.cl(elapsed/this.INTRO_PLUNGE_MS,0,1);'), 'original plunge clock changed');
assert(decodedScriptApp.includes('var skyY=-22-76*plunge;') && decodedScriptApp.includes('var seaY=104-110*plunge;'), 'original plunge trajectory changed');
assert(decodedScriptApp.includes('var entryHit=this.smooth(0.13,0.21,diveP)*(1-this.smooth(0.29,0.38,diveP));'), 'original water-impact timing changed');
assert(decodedScriptApp.includes('var handoff=this.smooth(this.INTRO_PLUNGE_MS*0.56,this.INTRO_MS*0.82,elapsed);'), 'structural underwater handoff timing changed');

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
const expectedMemberDots = { N4ML: '#a8caff', JAEHA: '#403f6f', Seine: '#f5b0bd', MIEE: '#b3e4b3' };
for (const member of siteJson.members || []) {
  if (Object.hasOwn(expectedMemberDots, member.name)) {
    assert(member.accent === expectedMemberDots[member.name], `member detail color drift: ${member.name}`);
    assert(member.dotAccent === expectedMemberDots[member.name], `member dot color drift: ${member.name}`);
  }
}

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

const worksCss = await text('assets/css/works.css');
const worksJs = await text('assets/js/works.js');
const removedImagePreloadSymbols = [
  '_allImagePreloadStarted',
  'collectWorkImageUrls',
  'preloadAllWorkImages',
  'scheduleAllWorkImagePreload',
  'preloadGalleryOpeningImages',
  '_imgCache',
  '_neighbourPreloadTimer',
  'cacheImage',
  'preloadCurrentWork',
  'preloadNearbyImages',
];
for (const symbol of removedImagePreloadSymbols) assert(!worksJs.includes(symbol), `WORKS eager image preload returned: ${symbol}`);
const imgTagSource = worksJs.match(/function imgTag\(unit, className, defer\) \{[\s\S]*?\n  \}\n\n  function numeric/)?.[0] || '';
assert(imgTagSource.includes("var loading = defer ? 'lazy' : 'eager';"), 'WORKS deferred images are not marked lazy');
assert(imgTagSource.includes("var priority = defer ? 'low' : 'high';"), 'WORKS image priority does not follow visibility');
assert(imgTagSource.includes("var sourceAttribute = defer ? 'data-works-src' : 'src';"), 'WORKS deferred images still receive an eager src');
assert(worksJs.includes("imgTag(unit, '', !loadImages || !layout.visible)"), 'hidden Showcase cards can load images eagerly');
assert(worksJs.includes("imgTag(unit, '', !loadImages || index >= eagerCount)"), 'offscreen Gallery cards can load images eagerly');
assert(worksJs.includes("querySelectorAll('.tt-gh-gallery img[data-works-src]')") && worksJs.includes("if (!('IntersectionObserver' in window))"), 'WORKS Gallery lazy-loading path or fallback is missing');
assert(worksJs.includes("if (detail.chapter) render();"), 'WORKS images are not reconciled when the active chapter changes');
const updateShowcaseDomSource = worksJs.match(/function updateShowcaseDom\(layoutOnly\) \{[\s\S]*?\n  \}\n\n  function onClick/)?.[0] || '';
const dragImageHydrationIndex = updateShowcaseDomSource.indexOf("if (img && layout.visible && img.hasAttribute('data-works-src')) loadDeferredImage(img);");
const layoutOnlyReturnIndex = updateShowcaseDomSource.indexOf('if (layoutOnly) return;');
assert(dragImageHydrationIndex >= 0 && layoutOnlyReturnIndex >= 0 && dragImageHydrationIndex < layoutOnlyReturnIndex, 'WORKS drag can reveal a deferred card before its image is loaded');
const removedAudioPreloadSymbols = [
  'allLayeredAudioWarmStarted',
  'warmAudioEntries',
  'collectLayeredAudioEntries',
  'preloadAllLayeredAudio',
  'scheduleLayeredAudioPreload',
];
for (const symbol of removedAudioPreloadSymbols) assert(!worksJs.includes(symbol), `WORKS eager audio preload returned: ${symbol}`);
const syncAudioStateSource = worksJs.match(/function syncAudioState\(\) \{[\s\S]*?\n  \}\n\n  function playCurrent\(\)/)?.[0] || '';
assert(/if \(!state\.playing\) \{\s*if \(layeredPlayback\) stopLayeredPlayback\(true\);\s*audioPool\.forEach\(function \(audio\) \{ audio\.pause\(\); \}\);\s*layeredFallbackActive = false;\s*return;\s*\}/.test(syncAudioStateSource), 'WORKS paused state can create or preload audio');
assert(syncAudioStateSource.indexOf('if (!state.playing)') < syncAudioStateSource.indexOf('currentAudioEntries()'), 'WORKS paused guard must run before audio entries are created');
assert(worksJs.includes('function isShowcasePlaybackView()'), 'WORKS playback view guard is missing');
assert(worksJs.includes("state.mode === 'showcase'") && worksJs.includes('!state.modalOpen') && worksJs.includes('!state.videoOpen'), 'WORKS playback guard does not require an uncovered Showcase');
assert(worksJs.includes("if (nextMode !== 'showcase') pauseAll(true);"), 'Gallery entry does not force Pause state');
assert(worksJs.includes('function pauseAll(skipRender)') && worksJs.includes('if (!skipRender && !updateShowcaseDom()) render();'), 'WORKS transition-safe pause path is missing');
assert(worksJs.includes('var playbackSessionToken = 0;') && worksJs.includes('sessionToken !== playbackSessionToken || signature !== audioEntriesSignature(currentAudioEntries())'), 'native WORKS playback is missing stale-session protection');
assert(!worksJs.includes('galleryWasPlaying'), 'Gallery detail still restores Showcase audio');
assert(worksJs.includes("if (!isShowcasePlaybackView()) {\n      if (state.playing) pauseAll();"), 'WORKS play action bypasses the Showcase guard');
assert(worksJs.includes('if (state.playing) pauseAll();\n    globalUxState.dialog = dialog;'), 'site detail dialogs do not pause WORKS audio');
assert(/#sky\s*\{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?min-height:\s*0\s*!important;/i.test(worksCss), 'mobile sky does not cover the expanded viewport');
assert(/#fx,[\s\S]*?height:\s*100lvh\s*!important;[\s\S]*?min-height:\s*0\s*!important;/i.test(worksCss), 'mobile canvas does not use the large viewport height');
assert(/#lang-switcher\.tt-lang-switcher\s*>\s*div\s*\{[\s\S]*?backdrop-filter:\s*none\s*!important;/i.test(worksCss), 'mobile language switcher blur is still enabled');
assert(!worksCss.includes('ttIntroOverlayHandoff'), 'obsolete CSS-only intro handoff is still present');

const redirect = await text('projects/index.html');
assert(/noindex/i.test(redirect) && /\/story-types\//.test(redirect), 'legacy projects redirect is invalid');
const notFound = await text('404.html');
assert(/noindex/i.test(notFound) && /href="\/works\/"/.test(notFound), '404 page is not index-safe or navigable');

const forbidden = [
  ['5', '30'].join(''),
  ['LI', 'LPA'].join(''),
  '\uCE58\uC5B4\uB9AC\uB529',
  ['J-', 'ROCK'].join(''),
  '\uBCF5\uC2DD',
  '\uC57C\uAD6C\uBD80',
  ['010', '-'].join(''),
];
const memberPortfolioOnly = [
  ['Always', ' with you'].join(''),
  ['EP', 'IC7'].join(''),
];
const publicText = [JSON.stringify(siteJson), JSON.stringify(seoJson), JSON.stringify(worksJson)].join('\n');
for (const term of forbidden) assert(!publicText.toLowerCase().includes(term.toLowerCase()), `forbidden public term found: ${term}`);
const { members: memberPortfolio, ...siteWithoutMembers } = siteJson;
const nonMemberPublicText = [JSON.stringify(siteWithoutMembers), JSON.stringify(seoJson), JSON.stringify(worksJson)].join('\n');
for (const term of memberPortfolioOnly) {
  assert(!nonMemberPublicText.toLowerCase().includes(term.toLowerCase()), `member portfolio term found outside members: ${term}`);
}

if (errors.length) {
  console.error(`Site validation failed (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Site validation passed: ${routes.length} routes, ${assetRefs.size} referenced assets, ${worksJson.works.length} works.`);
