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
  'assets/js/image-slot.js': '20260714-p2',
  'assets/css/works.css': '20260715-home-tagline-lockup-v1',
  'assets/js/works.js': '20260716-chapter-copy-clear-v1',
};
const expectedSiteContentCacheKey = '20260716-chapter-copy-clear-v1';
const routeDocumentBudgetBytes = 370_000;
const decodedTemplateBudgetBytes = 112_000;
const decodedScriptBudgetBytes = 155_000;
const expectedFontStylesheet = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400..800&amp;family=Noto+Sans+KR:wght@400..800&amp;display=swap';
const expectedFontAssets = {
  'assets/fonts/hanken-grotesk-latin-normal-v12.woff2': ['E9201EDDF1D41D0B62253295D869CE3CF65768F7102B797F02C7F8C876B4A9D5', 34_704],
  'assets/fonts/quicksand-latin-normal-v37.woff2': ['2ADD7D60B1CD2AB84C9967E23D5EC08EB3FC9635C46855B17D59404DEC6B410E', 28_244],
};

const imageSlotJs = await text('assets/js/image-slot.js');
assert(imageSlotJs.includes('if (!slot.isConnected) return false;'), 'image-slot: detached slots can start image requests before chapter gating');
assert(imageSlotJs.includes("if (!slot.closest('#c-news')) return true;"), 'image-slot: hidden NEWS cards are not scoped for deferred loading');
assert(imageSlotJs.includes("if (activeChapter) return activeChapter === 'news';"), 'image-slot: hidden NEWS cards are no longer gated by the active chapter');
assert(imageSlotJs.includes("return /^\\/news(?:\\/index\\.html)?\\/?$/i.test(location.pathname);"), 'image-slot: direct NEWS route fallback is missing');
assert(imageSlotJs.includes("const url = shouldLoadNewsImage(this) ? (this._userUrl || srcAttr) : '';"), 'image-slot: NEWS image URL is assigned before the chapter is active');
assert(imageSlotJs.includes("document.querySelectorAll('#c-news image-slot').forEach((slot) => slot._render());"), 'image-slot: NEWS cards do not refresh on chapter entry');
assert(imageSlotJs.includes("window.addEventListener('TALETONE_CHAPTER_CHANGE', refreshNewsImages);"), 'image-slot: chapter-change refresh hook is missing');

const required = [
  ...routes.map(([, file]) => file), 'projects/index.html', '404.html', 'robots.txt',
  'sitemap.xml', 'site.webmanifest', 'CNAME', 'support.js',
  'assets/data/site-content.json', 'assets/data/site-content.js',
  'assets/data/seo-content.json', 'assets/data/seo-content.js',
  'assets/data/works-data.json', 'assets/vendor/react-18.3.1.min.js',
  'assets/vendor/react-dom-18.3.1.min.js',
  ...Object.keys(expectedFontAssets), 'assets/fonts/LICENSES.txt',
  '.github/scripts/validate-runtime-performance.mjs', '.github/workflows/site-validation.yml',
];
for (const file of required) assert(await exists(file), `missing required file: ${file}`);
for (const [file, [expectedHash, expectedBytes]] of Object.entries(expectedFontAssets)) {
  if (!await exists(file)) continue;
  const bytes = await readFile(path.join(root, file));
  assert(bytes.length === expectedBytes, `${file}: unexpected font byte size`);
  assert(createHash('sha256').update(bytes).digest('hex').toUpperCase() === expectedHash, `${file}: font asset hash mismatch`);
}
const runtimePerformanceValidator = await text('.github/scripts/validate-runtime-performance.mjs');
const validationWorkflow = await text('.github/workflows/site-validation.yml');
for (const requiredGuard of [
  'maxTransferBytes', 'maxWarmFirstPartyTransferBytes', 'maxFirstPartyRequests', 'maxGoogleFontRequests', 'maxFcpMs', 'maxLcpMs', 'maxCls', 'maxLongTasks',
  'audioRequests === 0', 'worksDataRequests === 0', 'recalcStyleCount <= 60',
  'runFunctionalMatrix', 'runInteractionSmoke', 'network.audioRequests === 1',
  'network.worksDataRequests === 0',
  "dataset.ttMediaPlayback === 'paused'", 'members-keyboard-dialog', 'news-language-dialog',
  'unexpectedThirdPartyUrls.length === 0',
]) {
  assert(runtimePerformanceValidator.includes(requiredGuard), `runtime performance validator is missing guard: ${requiredGuard}`);
}
assert(validationWorkflow.includes('uses: actions/setup-node@v5') && validationWorkflow.includes('node-version: 24') && validationWorkflow.includes('node .github/scripts/validate-runtime-performance.mjs'), 'site-validation workflow does not use the Node 24 action/runtime performance budgets');

const payloadHashes = [];
const scriptPayloadHashes = [];
const fallbackHashes = new Map();
let decodedApp = '';
let decodedScriptApp = '';
for (const [key, file, route, expectedTitle] of routes) {
  const html = await text(file);
  assert(Buffer.byteLength(html) <= routeDocumentBudgetBytes, `${file}: route document exceeds ${routeDocumentBudgetBytes} byte budget`);
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
  assert(!html.includes('assets/data/track-record.js'), `${file}: standalone track-record request returned`);
  assert(!html.includes('assets/icons/favicon.svg'), `${file}: PNG-wrapped SVG favicon returned`);
  assert(html.includes('<link rel="preload" href="assets/fonts/hanken-grotesk-latin-normal-v12.woff2" as="font" type="font/woff2" crossorigin>'), `${file}: Hanken Grotesk preload is missing`);
  assert(html.includes('<link rel="preload" href="assets/fonts/quicksand-latin-normal-v37.woff2" as="font" type="font/woff2" crossorigin>'), `${file}: Quicksand preload is missing`);

  const ld = attr(html, /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  try { JSON.parse(ld); } catch { errors.push(`${file}: invalid JSON-LD`); }

  const payload = attr(html, /<script\s+type="application\/octet-stream"\s+data-dc-template-b64>([\s\S]*?)<\/script>/i).replace(/\s/g, '');
  assert(payload.length > 1000, `${file}: encoded app template missing`);
  if (payload) {
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    assert(Buffer.byteLength(decoded) <= decodedTemplateBudgetBytes, `${file}: decoded template exceeds ${decodedTemplateBudgetBytes} byte budget`);
    decodedApp ||= decoded;
    payloadHashes.push(createHash('sha256').update(decoded).digest('hex'));
    for (const [asset, cacheKey] of Object.entries(expectedCacheKeys)) {
      assert(decoded.includes(`${asset}?v=${cacheKey}`), `${file}: stale cache key for ${asset}`);
    }
    assert(decoded.includes(expectedFontStylesheet), `${file}: optimized font stylesheet query is missing`);
    assert(!decoded.includes('family=Quicksand') && !decoded.includes('family=Hanken+Grotesk'), `${file}: remote Latin font request returned`);
    assert(!decoded.includes('Noto+Sans+JP:wght@400;500;600;700;800') && !decoded.includes('Noto+Sans+KR:wght@400;500;600;700;800'), `${file}: duplicate per-weight CJK font CSS returned`);
    assert((decoded.match(/hanken-grotesk-latin-normal-v12\.woff2/g) || []).length === 5, `${file}: local Hanken Grotesk normal weights changed`);
    assert(!decoded.includes('hanken-grotesk-latin-italic-v12.woff2'), `${file}: unused Hanken Grotesk italic face returned`);
    assert((decoded.match(/quicksand-latin-normal-v37\.woff2/g) || []).length === 4, `${file}: local Quicksand weights changed`);
    assert(decoded.includes(":root{--tt-noto-primary:'Noto Sans KR';--tt-noto-secondary:'Noto Sans JP';") && decoded.includes(":root:lang(ja){--tt-noto-primary:'Noto Sans JP';--tt-noto-secondary:'Noto Sans KR'}"), `${file}: language-aware CJK font order is missing`);
    const decodedFontDeclarations = [...decoded.matchAll(/font-family\s*:\s*([^;}\r\n]+)/gi)].map((match) => match[1]);
    assert(!decodedFontDeclarations.some((value) => /Noto Sans (?:KR|JP)/.test(value)), `${file}: literal CJK family order remains in a template font declaration`);
    assert(decoded.includes("font-family:'Quicksand',var(--tt-noto-primary),var(--tt-noto-secondary),sans-serif"), `${file}: Japanese language button does not preserve Quicksand before the CJK fallbacks`);
    assert(decoded.includes('id="intro-skyw"') && decoded.includes('id="intro-ocean"'), `${file}: original above-water intro is missing`);
    assert(decoded.includes('id="intro-sea"') && decoded.includes('id="intro-bubbles"'), `${file}: original underwater intro is missing`);
    assert(decoded.includes('background:{{ member.dotAccent }}'), `${file}: member card dot does not use dotAccent`);
    assert(decoded.includes('<img data-member-src="{{ member.photo }}" alt="{{ member.name }}" loading="lazy"'), `${file}: member card image is not deferred until MEMBERS is active`);
    assert(!decoded.includes('<img src="{{ member.photo }}"'), `${file}: hidden member cards can load before MEMBERS is active`);
    assert(decoded.includes('class="tt-news-modal" role="dialog" aria-modal="true"'), `${file}: NEWS dialog lacks a direct selector`);
    assert(decoded.includes('class="tt-home-tagline"') && decoded.includes('{{ HOME.tagline }}'), `${file}: localized HOME tagline lockup is missing`);
    for (const binding of ['HOME.tagline', 'MEMBERS_META.subtitle', 'MEMBERS_META.description', 'NEWS_META.subtitle', 'NEWS_META.description', 'CONTACT.subtitle', 'CONTACT.caption']) {
      assert(decoded.includes(`<sc-if value="{{ ${binding} }}">`), `${file}: empty chapter copy is not conditionally removed: ${binding}`);
    }
    assert(!decoded.includes('HOME.subtitleLine') && !decoded.includes('HOME.descriptionLine'), `${file}: obsolete multi-line HOME copy binding returned`);
    assert(!decoded.includes('id="tt-works-data"'), `${file}: stale embedded WORKS fallback returned`);
    for (const deadTemplateSymbol of ['notMembersEditMode', '{{ accent }}', '.tt-prologue-copy', '.tt-orb-link', '.tt-orb-ring', '.tt-sigil', '.tt-page-stage']) {
      assert(!decoded.includes(deadTemplateSymbol), `${file}: dead template symbol returned: ${deadTemplateSymbol}`);
    }
    for (const deadKeyframe of ['bob', 'haloSpin', 'haloSpinR', 'eq', 'floaty']) {
      assert(!decoded.includes(`@keyframes ${deadKeyframe}`), `${file}: dead keyframe returned: ${deadKeyframe}`);
    }
    assert((decoded.match(/data-story-bridge-wrap="" style="height:100vh;/g) || []).length === 4, `${file}: generic story bridges do not reserve their final height`);
    assert(!decoded.includes('data-story-bridge-wrap="" style="height:64vh;'), `${file}: delayed generic story bridge height returned`);
    assert(!decoded.includes('Lightweight first-home-only intro'), `${file}: lightweight replacement intro still present`);
  }

  const scriptPayload = attr(html, /<script\b[^>]*\bdata-dc-script-b64\b[^>]*>([\s\S]*?)<\/script>/i).replace(/\s/g, '');
  assert(scriptPayload.length > 1000, `${file}: encoded app script missing`);
  if (scriptPayload) {
    const decodedScript = Buffer.from(scriptPayload, 'base64').toString('utf8');
    assert(Buffer.byteLength(decodedScript) <= decodedScriptBudgetBytes, `${file}: decoded app script exceeds ${decodedScriptBudgetBytes} byte budget`);
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
    const drawBody = (decodedScript.match(/\n  draw\(n, pal, fastMobile\)\{([\s\S]*?)\n  \}/) || [])[1] || '';
    const drawRailBody = (decodedScript.match(/\n  drawRail\(n, pal, time\)\{([\s\S]*?)\n  \}/) || [])[1] || '';
    assert(decodedScript.includes('refreshLayoutGeometry(layoutHeight){') && decodedScript.includes('el._motionBounds={top:rect.top-rootTop+scrollTop,height:rect.height};'), `${file}: shared layout geometry cache is missing`);
    assert(decodedScript.includes('this._railCenters.push(section.offsetTop+section.clientHeight*0.5);'), `${file}: rail centers are not cached with layout geometry`);
    assert(decodedScript.includes('docY:bookRect.top+scrollTop+bookRect.height*0.30-currentFloatY') && decodedScript.includes('bookGeometry.docY+bookFloatY'), `${file}: deep-book float compensation is missing`);
    assert(decodedScript.includes('fl._floatY=Number(floatY);'), `${file}: live deep-book float offset is not retained`);
    assert(decodedScript.includes('var geometryDirty=this._layoutGeometryDirty||this._layoutGeometryHeight!==layoutHeight;') && decodedScript.includes('if(geometryDirty) this.refreshLayoutGeometry(layoutHeight);'), `${file}: layout geometry is not invalidated by height changes`);
    assert(decodedScript.includes('if(!this.introDone){\n      if(this._layoutGeometryDirty&&this.scroller) this.refreshLayoutGeometry(this.scroller.scrollHeight);'), `${file}: intro does not initialize shared layout geometry before style writes`);
    assert(decodedScript.includes('this._layoutGeometryDirty=true;\n      this._sceneDirty=true;\n      this.introDone=true;'), `${file}: intro completion does not invalidate layout geometry and the scroll-derived scene`);
    assert(decodedScript.includes('isNearViewport(el, margin, bounds, scrollTop, viewportHeight){'), `${file}: viewport helper does not accept cached loop geometry`);
    assert(decodedScript.includes('var vh=viewportHeight==null?(window.innerHeight||800):viewportHeight') && decodedScript.includes('scrollTop==null?(this.scroller?this.scroller.scrollTop:window.scrollY):scrollTop'), `${file}: viewport helper no longer falls back safely outside the main loop`);
    assert((decodedScript.match(/this\.isNearViewport\([^,\n]+,motionMargin,[^\n]+\._motionBounds,sc,vhR\)/g) || []).length === 6, `${file}: decorative motion still rereads viewport geometry between style writes`);
    assert(decodedScript.includes('this._layoutGeometryDirty = true;') && decodedScript.includes('this._layoutGeometryDirty=true;'), `${file}: shared layout geometry lifecycle invalidation is missing`);
    assert(!drawRailBody.includes('.offsetTop') && !drawRailBody.includes('.clientHeight'), `${file}: rail layout is still measured every frame`);
    assert(!drawBody.includes("document.getElementById('deep-book-svg')") && !drawBody.includes('getBoundingClientRect()') && !drawBody.includes('refreshLayoutGeometry'), `${file}: draw still performs layout measurement`);
    assert(!decodedScript.includes('refreshMotionBounds') && !decodedScript.includes('_motionBoundsDirty') && !decodedScript.includes('_motionBoundsHeight'), `${file}: obsolete motion-only cache state remains`);
    assert((decodedScript.match(/new MutationObserver/g) || []).length === 0, `${file}: broad component mutation observer returned`);
    assert(decodedScript.includes('loadMemberImages(){') && decodedScript.includes("document.body.getAttribute('data-active-chapter')!=='members'"), `${file}: member image loading is not scoped to the active MEMBERS chapter`);
    assert(decodedScript.includes("querySelectorAll('img[data-member-src]')") && decodedScript.includes("image.removeAttribute('data-member-src')"), `${file}: member image loading is not one-shot`);
    assert(decodedScript.includes("this._chapterTarget&&this._chapterTarget!=='c-members'") && decodedScript.includes('this._chapterTarget=id;') && decodedScript.includes("activeSection.id===this._chapterTarget) this._chapterTarget=''"), `${file}: pass-through navigation can activate hidden member images`);
    assert(!decodedScript.includes('tt-mobile-bridge-line-inner'), `${file}: unused mobile bridge inner class returned`);
    assert(!decodedScript.includes('fastMobile ? 0.38 : 0.72'), `${file}: unreachable fast-mobile motion margin returned`);
    assert(decodedScript.includes("var bl=(1-exit)*4; re.style.filter = bl>0.25 ? 'blur('+bl.toFixed(1)+'px)' : 'none';"), `${file}: relaxed scroll-exit blur condition is missing`);
    assert(!decodedScript.includes('var bl=(1-exit)*5;'), `${file}: aggressive scroll-exit blur returned`);
    assert(decodedScript.includes('this.raf=0;\n    if(document.hidden) return;'), `${file}: hidden documents can keep the main animation loop alive`);
    const visibilityHandlerSource = decodedScript.match(/this\._visibilityHandler=\(\)=>\{[\s\S]*?\n    \};/)?.[0] || '';
    assert(/if\(document\.hidden\)\{\s*cancelAnimationFrame\(this\.raf\);\s*this\.raf=0;\s*return;/.test(visibilityHandlerSource), `${file}: hidden animation loop cancellation order changed`);
    assert((visibilityHandlerSource.match(/requestAnimationFrame\(this\.loop\)/g) || []).length === 1 && visibilityHandlerSource.includes('if(!this.raf){'), `${file}: visible animation loop does not resume exactly once`);
    assert(decodedScript.includes("document.addEventListener('visibilitychange',this._visibilityHandler)") && decodedScript.includes("document.removeEventListener('visibilitychange',this._visibilityHandler)"), `${file}: animation visibility lifecycle is incomplete`);
    const synchronousLangIndex = decodedScript.indexOf("document.documentElement.lang=this.lang==='kr'?'ko':(this.lang==='jp'?'ja':'en');");
    const deferredLangIndex = decodedScript.indexOf('this._langInitTimer=setTimeout');
    assert(synchronousLangIndex >= 0 && deferredLangIndex > synchronousLangIndex, `${file}: document language is not set before deferred content localization`);
    assert(decodedScript.includes('var sceneDirty=this._sceneDirty||geometryDirty||this._lastSceneScroll!==sc||this._lastSceneHeight!==layoutHeight;'), `${file}: scroll-derived scene work is not dirty-gated`);
    assert(decodedScript.includes('if(sceneDirty||bridgePlaying) this.updateBridges(vhR);'), `${file}: bridge work is not limited to changes or active playback`);
    assert(decodedScript.includes('if((sceneDirty||this._transPlaying||this.lastActive===1)') && decodedScript.includes('this.updateTranslation(scEl,tA);'), `${file}: translation work is not lifecycle-gated`);
    assert(decodedScript.includes('(this.isMobileMotion() ? 34 : 1000/60)') && decodedScript.includes('this._lastLoopFrame += minFrameMs;'), `${file}: high-refresh displays can run the main canvas above 60 fps`);
    assert(decodedScript.includes('var motionFrameDue=sceneDirty||!this._lastMotionFrame||frameNow-this._lastMotionFrame>=(this.isMobileMotion()?67:34);'), `${file}: decorative DOM motion is not cadence-limited`);
    assert(/if\(fastMobile\)\{[\s\S]*?this\._sceneDirty=true;\s*this\.raf=requestAnimationFrame\(this\.loop\);\s*return;/.test(decodedScript), `${file}: fast mobile scrolling can leave the final scene state stale`);
    assert(decodedScript.includes("el.style.setProperty('--tt-motion-play-state',idle?'paused':'running');"), `${file}: offscreen decorative CSS animations are not paused`);
    assert(decodedScript.includes("outer.style.setProperty('--tt-bridge-play-state','paused')") && decodedScript.includes("outer.style.setProperty('--tt-bridge-play-state','running')"), `${file}: bridge CSS animation lifecycle is incomplete`);
    assert(decodedScript.includes("outer.classList.add('tt-bridge-pinned');"), `${file}: pinned bridge lifecycle is missing`);
    assert(!decodedScript.includes("outer.style.minHeight='100vh'") && !decodedScript.includes("outer.style.height='100vh'"), `${file}: runtime bridge geometry writes can reintroduce layout shift`);
  }

  const fallback = attr(html, /<noscript>([\s\S]*?)<\/noscript>/i);
  const fallbackText = cleanText(fallback);
  assert(fallbackText.length > 80, `${file}: fallback content is too short`);
  assert(!fallbackText.includes('당신의 이야기가 음악이 되는 곳'), `${file}: cleared HOME tagline remains in fallback content`);
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
assert((decodedApp.match(/\.tt-book-light-stage\{position:absolute/g) || []).length === 1, 'duplicate deep-book CSS returned');
assert((decodedApp.match(/animation-play-state:var\(--tt-motion-play-state,running\)/g) || []).length === 3, 'deep-book CSS animations are not fully tied to viewport lifecycle');
assert(!decodedApp.includes('WORK DETAIL MODAL') && !decodedApp.includes('{{ wOpen }}'), 'removed legacy WORK detail modal returned');
for (const symbol of [
  'drawBridgeMotifs', 'drawBook(', 'updateYouWave', 'bridgePhraseForIndexOld', 'playStory',
  'worksView', '_arcPoll', '_worksInitTimer', 'applyWorksEdit', '_navPeekTimer', 'this.io',
  '_siteFallbacks', '_saveMembers', '_loadMembers', '_savePartners', '_loadPartners',
  'imageHydrator', 'hydrateDeferredImages', '_partnerSlotTimer', 'seoEditMode',
  'SEO_EDITOR_PAGES', 'membersEditMode', 'partnersEditMode', 'TALETONE_TRACK_RECORD',
  "localStorage.getItem('tt-seo-v1')", '_saveSeoLocal',
]) {
  assert(!decodedScriptApp.includes(symbol), `removed embedded legacy code returned: ${symbol}`);
}
assert(decodedScriptApp.includes("window.dispatchEvent(new Event('TALETONE_UI_UPDATED'))"), 'component updates do not explicitly refresh global UI state');

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
const siteLanguages = ['kr', 'en', 'jp'];
const clearedChapterCopy = {
  home: ['tagline'],
  membersMeta: ['subtitle', 'description'],
  worksMeta: ['subtitle', 'description'],
  newsMeta: ['subtitle', 'description'],
  contact: ['subtitle', 'caption'],
};
for (const [section, fields] of Object.entries(clearedChapterCopy)) {
  for (const field of fields) {
    assert(siteJson[section]?.[field] === '', `${section}.${field} must remain empty until edited`);
    for (const language of siteLanguages) {
      assert(siteJson[section]?.translations?.[language]?.[field] === '', `${section}.${field} ${language} must remain empty until edited`);
    }
  }
}
for (const language of siteLanguages) {
  assert(String(siteJson.projects?.translations?.[language]?.subtitle || '').trim(), `Story Types ${language} subtitle was cleared`);
  assert(String(siteJson.projects?.translations?.[language]?.description || '').trim(), `Story Types ${language} description was cleared`);
}
for (const obsoleteField of ['subtitleLine1', 'subtitleLine2', 'descriptionLine1', 'descriptionLine2']) {
  assert(!Object.hasOwn(siteJson.home || {}, obsoleteField), `HOME obsolete field returned: ${obsoleteField}`);
  for (const language of siteLanguages) {
    assert(!Object.hasOwn(siteJson.home?.translations?.[language] || {}, obsoleteField), `HOME ${language} obsolete field returned: ${obsoleteField}`);
  }
}
for (const key of ['home', 'translation', 'projects', 'contact', 'membersMeta', 'worksMeta', 'newsMeta', 'partnersMeta', 'footerMeta', 'uiLabels', 'chapterLabels']) {
  assert(siteJson[key] && typeof siteJson[key] === 'object' && !Array.isArray(siteJson[key]), `site-content missing canonical object: ${key}`);
}
for (const [key, minimum] of Object.entries({ members: 4, news: 1, partners: 1, bridges: 5, trackRecord: 2 })) {
  assert(Array.isArray(siteJson[key]) && siteJson[key].length >= minimum, `site-content missing canonical list: ${key}`);
}
for (const [index, item] of (siteJson.trackRecord || []).entries()) {
  assert(item && item.value && item.label && item.note, `trackRecord ${index + 1}: required fields missing`);
  for (const language of ['kr', 'en', 'jp']) assert(item.translations?.[language], `trackRecord ${index + 1}: ${language} translation missing`);
}
for (const [name, value] of Object.entries({ fontStack: siteJson.typography?.fontStack, fontStackJP: siteJson.typography?.fontStackJP })) {
  assert(value?.includes('var(--tt-noto-primary)') && value?.includes('var(--tt-noto-secondary)'), `site typography ${name} is not language-aware`);
  assert(!/Noto Sans (?:KR|JP)/.test(value || ''), `site typography ${name} contains a fixed CJK order`);
}
const optimizedNewsImagePath = 'assets/works/images/bubblesweet-news-1920.webp';
const legacyNewsImagePath = 'assets/works/images/4K.mp4_20260711_020133.397.png';
const optimizedNewsEntry = (siteJson.news || []).find((item) => item.slotId === 'news-3');
assert(optimizedNewsEntry?.image === optimizedNewsImagePath, 'news-3 does not use the optimized WebP image');
assert(!JSON.stringify(siteJson).replace(/\\/g, '/').includes(legacyNewsImagePath), 'legacy 8.94 MB NEWS PNG is still referenced');
assert(!(await exists(legacyNewsImagePath)), 'removed legacy NEWS source image returned');
const optimizedNewsImage = await readFile(path.join(root, optimizedNewsImagePath));
assert(optimizedNewsImage.toString('ascii', 0, 4) === 'RIFF' && optimizedNewsImage.toString('ascii', 8, 16) === 'WEBPVP8 ', 'optimized NEWS image is not lossy WebP');
assert((optimizedNewsImage.readUInt16LE(26) & 0x3fff) === 1920 && (optimizedNewsImage.readUInt16LE(28) & 0x3fff) === 1080, 'optimized NEWS image must be 1920x1080');
assert(optimizedNewsImage.byteLength <= 300_000, `optimized NEWS image exceeds 300 KB budget: ${optimizedNewsImage.byteLength} bytes`);
assert(Array.isArray(worksJson.works) && worksJson.works.length > 0, 'works data is empty');
assert(new Set(worksJson.works.map((work) => work.id)).size === worksJson.works.length, 'duplicate works IDs');
const normalizedWorksSource = JSON.stringify(worksJson).replace(/\\/g, '/');
const normalizedDecodedApp = decodedApp.replace(/\\/g, '/');
const removedDuplicateWorkImage = 'assets/works/images/asset-mq6aimxx-2c2o-.jpg-a9bb3c69bc18.jpg';
const canonicalDuplicateWorkImage = 'assets/works/images/asset-mq7l26qf-jqvi-.jpg-a9bb3c69bc18.jpg';
assert(!(await exists(removedDuplicateWorkImage)), 'removed byte-identical WORKS image returned');
assert(!normalizedWorksSource.includes(removedDuplicateWorkImage) && !normalizedDecodedApp.includes(removedDuplicateWorkImage), 'removed byte-identical WORKS image is still referenced');
assert(normalizedWorksSource.split(canonicalDuplicateWorkImage).length - 1 === 2, 'canonical WORKS image has unexpected works-data reference count');
assert(!normalizedDecodedApp.includes(canonicalDuplicateWorkImage), 'external WORKS data leaked back into the encoded template');
const optimizedWorkImages = [
  { path: 'assets/works/images/bubblesweet-work-1024.webp', legacy: 'assets/works/images/bubblesweet.png', width: 1024, height: 1024, refs: 1, templateRefs: 0 },
  { path: 'assets/works/images/early-spring-cover-1024-f814379f3b3a-opt1.webp', legacy: 'assets/works/images/asset-mq832pb9-dgmx-early.jpg-f814379f3b3a.jpg', width: 1024, height: 1024, refs: 5, templateRefs: 0 },
  { path: 'assets/works/images/kanism-jp-cover-1024-78517c40b71d-v1.webp', legacy: 'assets/works/images/asset-mq83ztj3-ncy4-.jpg-78517c40b71d.jpg', width: 1024, height: 1024, refs: 1, templateRefs: 0 },
];
for (const image of optimizedWorkImages) {
  assert(normalizedWorksSource.split(image.path).length - 1 === image.refs, `${image.path}: unexpected works-data reference count`);
  assert(!normalizedWorksSource.includes(image.legacy), `${image.legacy}: oversized legacy image is still referenced`);
  assert(normalizedDecodedApp.split(image.path).length - 1 === image.templateRefs, `${image.path}: unexpected encoded-template reference count`);
  assert(!normalizedDecodedApp.includes(image.legacy), `${image.legacy}: oversized legacy image is still referenced by the encoded template`);
  assert(!(await exists(image.legacy)), `${image.legacy}: removed oversized source image returned`);
  const bytes = await readFile(path.join(root, image.path));
  assert(bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 16) === 'WEBPVP8 ', `${image.path}: expected lossy WebP`);
  assert((bytes.readUInt16LE(26) & 0x3fff) === image.width && (bytes.readUInt16LE(28) & 0x3fff) === image.height, `${image.path}: unexpected dimensions`);
  assert(bytes.byteLength <= 300_000, `${image.path}: exceeds 300 KB budget (${bytes.byteLength} bytes)`);
}
const removedLogoMockSource = 'assets/pictures/logomock.png';
assert(!(await exists(removedLogoMockSource)), `${removedLogoMockSource}: removed oversized source image returned`);
for (const removedAsset of [
  'assets/data/track-record.js',
  'assets/icons/favicon.svg',
  'assets/icons/favicon-48.png',
  'assets/fonts/hanken-grotesk-latin-italic-v12.woff2',
  'assets/bundle/946dad72-7af1-419c-a0eb-24bca34317f8.png',
]) {
  assert(!(await exists(removedAsset)), `removed unused asset returned: ${removedAsset}`);
}
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
for (const match of normalizedDecodedApp.matchAll(/["'](assets\/works\/images\/[^"']+)["']/gi)) {
  assetRefs.add(match[1].split(/[?#]/)[0]);
}
const referencedWorkImageHashes = new Map();
for (const file of assetRefs) {
  assert(await exists(file), `missing referenced asset: ${file}`);
  if (/\.mp3$/i.test(file)) {
    const bytes = await readFile(path.join(root, file));
    assert(bytes.byteLength <= 3_200_000, `${file}: referenced MP3 exceeds the current 3.2 MB quality-preserving budget (${bytes.byteLength} bytes)`);
  }
  if (/^assets\/works\/images\//i.test(file)) {
    const bytes = await readFile(path.join(root, file));
    assert(bytes.byteLength <= 300_000, `${file}: referenced WORKS image exceeds 300 KB budget (${bytes.byteLength} bytes)`);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const matches = referencedWorkImageHashes.get(hash) || [];
    matches.push(file);
    referencedWorkImageHashes.set(hash, matches);
  }
}
for (const matches of referencedWorkImageHashes.values()) {
  assert(matches.length === 1, `byte-identical referenced WORKS images: ${matches.join(', ')}`);
}

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
assert(worksJs.includes("var copy = subtitle || description") && worksJs.includes("+ copy + '</div>'"), 'WORKS empty section copy still renders a placeholder paragraph');
assert(!/(?:font-family|font)\s*:[^;}]*'Noto Sans (?:KR|JP)'/i.test(worksCss), 'WORKS CSS contains a fixed CJK font order');
assert((worksCss.match(/var\(--tt-noto-primary\)/g) || []).length === 11 && (worksCss.match(/var\(--tt-noto-secondary\)/g) || []).length === 11, 'WORKS CSS language-aware CJK fallbacks changed');
const homeTaglineRule = worksCss.match(/\.tt-home-tagline \{[\s\S]*?\n\}/)?.[0] || '';
assert(/display:\s*inline-flex;/.test(homeTaglineRule) && /font-size:\s*clamp\(18px, 2vw, 28px\);/.test(homeTaglineRule), 'HOME tagline is no longer visually grouped with the title');
assert(/\.tt-home-tagline::before,[\s\S]*?\.tt-home-tagline::after \{[\s\S]*?radial-gradient/.test(worksCss), 'HOME tagline line-and-dot ornament is missing');
const storyBridgeRule = worksCss.match(/\.tt-gh-story-bridge \{[\s\S]*?\n\}/)?.[0] || '';
assert(/height:\s*100vh;/.test(storyBridgeRule) && /min-height:\s*100vh;/.test(storyBridgeRule), 'WORKS story bridge does not reserve its final height');
assert(!/height:\s*64vh;/.test(storyBridgeRule), 'WORKS story bridge can still expand after first paint');
assert(Buffer.byteLength(worksCss) <= 140_000, 'WORKS CSS exceeds 140 KB source budget');
assert(Buffer.byteLength(worksJs) <= 110_000, 'WORKS JavaScript exceeds 110 KB source budget');
assert(worksJs.includes('var worksDataPromise = null;') && worksJs.includes('if (worksDataPromise) return worksDataPromise;'), 'WORKS data fetch is not single-flight');
assert(!worksJs.includes("if (chapter === 'members')") && worksJs.includes("if (isWorksChapterActive() || window.parent !== window) init();"), 'WORKS data is not limited to the active chapter or editor');
assert((worksJs.match(/fetch\(new URL\('data\/works-data\.json'/g) || []).length === 1, 'WORKS data fetch path must remain singular');
assert(!worksJs.includes('embeddedData') && !worksJs.includes("location.protocol === 'file:'") && !worksJs.includes('tt-works-data'), 'broken embedded WORKS fallback returned');
assert(worksJs.includes('function bindWorksInteractions()') && worksJs.includes('bindWorksInteractions();\n    works = json.works || [];'), 'WORKS interactions are not bound on demand');
const setEditorDataSource = worksJs.match(/function setEditorData\(json\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert(setEditorDataSource.includes('bindWorksInteractions();'), 'editor-supplied WORKS data does not bind interactions');
for (const deadSymbol of ['var rendering =', 'function bindModalCloseHandlers()', 'bindModalCloseHandlers();', 'function onMouseDown(', 'function onMouseMove(', "classList.add('tt-site-dialog')"]) {
  assert(!worksJs.includes(deadSymbol), `removed WORKS JavaScript returned: ${deadSymbol}`);
}
const worksBindingIndex = worksJs.indexOf('function bindWorksInteractions()');
const worksClickListenerIndex = worksJs.indexOf("document.addEventListener('click', onClick, true);");
assert(worksBindingIndex >= 0 && worksClickListenerIndex > worksBindingIndex, 'WORKS listeners returned to unconditional startup');
const resetAudioForContentChangeSource = worksJs.match(/function resetAudioForContentChange\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert(resetAudioForContentChangeSource.includes("audio.removeAttribute('src');") && resetAudioForContentChangeSource.includes('audio.load();'), 'WORKS content changes retain native audio media resources');
assert(resetAudioForContentChangeSource.includes('audioPool.clear();') && resetAudioForContentChangeSource.includes('layeredBufferPool.clear();'), 'WORKS content changes retain audio pools in memory');
const audioReleaseOrder = ['audio.pause();', "audio.removeAttribute('src');", 'audio.load();', 'audioPool.clear();', 'layeredBufferPool.clear();'].map((step) => resetAudioForContentChangeSource.indexOf(step));
assert(audioReleaseOrder.every((index, position) => index >= 0 && (!position || index > audioReleaseOrder[position - 1])), 'WORKS audio resources are not released in pause/src/load/pool order');
for (const symbol of [
  'visibleWorks', 'onWheel', 'onMouseUp', 'cardPreview', 'function segments()',
  'state.start', 'dragState.lastX', 'videoBlock', 'scheduleRouteLandingCorrections',
  'patchContactControls', 'fallbackCopyText', 'globalUxState.observer',
]) {
  assert(!worksJs.includes(symbol), `removed WORKS dead code returned: ${symbol}`);
}
assert((worksJs.match(/window\.addEventListener\('mouseup', onPointerUp, true\);/g) || []).length === 1, 'WORKS mouseup lifecycle must use one onPointerUp listener');
assert((worksJs.match(/window\.addEventListener\('mouseup'/g) || []).length === 1, 'duplicate WORKS mouseup listener returned');
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
const worksChapterGateSource = worksJs.match(/function isWorksChapterActive\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert(worksChapterGateSource.includes("if (activeChapter) return activeChapter === 'works';"), 'WORKS explicit chapter gate is missing');
assert(worksChapterGateSource.includes("return /^\\/works(?:\\/index\\.html)?\\/?$/i.test(location.pathname) || location.hash === '#c-works';"), 'WORKS direct-route fallback is missing');
assert(!worksChapterGateSource.includes('return !activeChapter'), 'blank HOME chapter can trigger hidden WORKS cover requests');
for (const symbol of ['renderTimer', 'scheduleRender']) assert(!worksJs.includes(symbol), `WORKS idle host polling returned: ${symbol}`);
assert(!worksJs.includes("if (mounted && (!app || !app.querySelector('.tt-gh-shell')))"), 'WORKS idle host polling returned');
assert(!/if\s*\(detail\.chapter\)\s*render\(\)/.test(worksJs), 'WORKS unconditional chapter-change render returned');
assert(/pauseAll:\s*function\s*\(\)\s*\{\s*pauseAll\(state\.mode\s*!==\s*'showcase'\s*\|\|\s*!isWorksChapterActive\(\)\);\s*\}/.test(worksJs), 'WORKS external pause API no longer separates visible UI sync from hidden chapters');
assert(/if\s*\(chapter\s*!==\s*'works'\)\s*\{\s*pauseAll\(true\);\s*return;/.test(worksJs), 'WORKS non-active chapters do not return before rendering');
assert(worksJs.includes("if (!mounted || !app || app !== root || !app.querySelector('.tt-gh-shell')) {"), 'WORKS live host integrity guard is missing');
assert(/if\s*\(state\.mode\s*===\s*'showcase'\)\s*updateShowcaseDom\(\);\s*else\s*bindLazyGalleryImages\(\);/.test(worksJs), 'WORKS chapter entry no longer uses incremental hydration');
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
const baseWorksCardRule = worksCss.match(/\.tt-gh-card \{[\s\S]*?\n\}/)?.[0] || '';
assert(!baseWorksCardRule.includes('animation:') && !baseWorksCardRule.includes('will-change:'), 'inactive WORKS cards still allocate animation or compositor state');
assert(/:where\(body\[data-active-chapter="works"\] #c-works \.tt-gh-card\.is-visible\)\s*\{[\s\S]*?animation:\s*tt-card-float 6\.2s ease-in-out infinite;[\s\S]*?animation-delay:\s*var\(--float-delay, 0s\);[\s\S]*?will-change:\s*transform, opacity;[\s\S]*?\}/.test(worksCss), 'WORKS card animation is not limited to visible cards in the active chapter');
assert(/:where\(body\[data-active-chapter="works"\] #c-works\) \.tt-gh-stage\.is-dragging \.tt-gh-card\.is-visible,\s*:where\(body\[data-active-chapter="works"\]\.tt-site-dialog-open #c-works\) \.tt-gh-card\.is-visible\s*\{\s*animation-play-state:\s*paused;\s*\}/.test(worksCss), 'WORKS interaction pause states are missing');
assert(!worksCss.includes('body:not([data-active-chapter="works"]) #c-works .tt-gh-line'), 'dead WORKS line animation pause selector returned');
assert((worksCss.match(/animation-play-state:\s*var\(--tt-bridge-play-state, running\);/g) || []).length === 2, 'WORKS bridge CSS animations are not tied to bridge visibility');
for (const deadSelector of ['.tt-gh-preview', '.tt-gh-info-cover', '.tt-gh-card-date', '.tt-gh-info-meta', '.tt-gh-chip', '.tt-gh-side', '.tt-gh-row', '.tt-gh-select', '.tt-gh-info-video', '.tt-gh-segments', '.tt-bridge-visual--orbs']) {
  assert(!worksCss.includes(deadSelector) && !worksJs.includes(deadSelector), `removed WORKS selector returned: ${deadSelector}`);
}
assert((worksCss.match(/\.tt-mobile-bridge-line\[data-indent=/g) || []).length === 4, 'duplicate mobile bridge indent rules returned');
assert((worksCss.match(/#lang-switcher\.tt-lang-switcher button:focus,\s*#lang-switcher\.tt-lang-switcher button:focus-visible,\s*#lang-switcher\.tt-lang-switcher button:active\s*\{\s*border: 0 !important;\s*outline: 0 !important;\s*box-shadow: none !important;\s*border-radius: 999px !important;\s*\}/g) || []).length === 1, 'duplicate mobile language focus rule returned');
assert((worksCss.match(/body\[data-active-chapter="projects"\] #progress,\s*body\[data-active-chapter="members"\] #progress,\s*body\[data-active-chapter="news"\] #progress,\s*body\[data-active-chapter="contact"\] #progress\s*\{\s*left: 16px !important;\s*top: auto !important;\s*bottom: max\(16px, env\(safe-area-inset-bottom\)\) !important;\s*transform: none !important;\s*transform-origin: left bottom !important;\s*\}/g) || []).length === 1, 'duplicate mobile progress rule returned');
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
