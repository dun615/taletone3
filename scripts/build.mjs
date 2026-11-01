// Builds every generated file from its editable source:
//   src/page.html + assets/data/*.json             -> route pages for KR (/), EN (/en/) and JP (/ja/)
//   src/app/template.html, src/app/component.js + src/app/parts/*.js -> assets/app/app.js (shared by every route page)
//   assets/data/*-content.json                     -> assets/data/*-content.js
//   assets/data/seo-content.json + the above       -> sitemap.xml
//
//   node scripts/build.mjs          rewrite generated files
//   node scripts/build.mjs --check  fail if any generated file is out of date
//   node scripts/build.mjs --list   print the generated files (they are built in CI, not committed)
//
// Pages load the app from assets/app/app.js and the data as window globals
// from the .js files. Edit the sources, never the generated output.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanumCharacters, PREVIEW_SOURCES } from './font-coverage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const listOnly = process.argv.includes('--list');
const previewSource = (file) => file.replace(/^preview-src\/app\//, 'src/app/').replace(/^preview-src\/data\//, 'assets/data/').replace(/^preview-src\/(js|css)\//, 'assets/$1/').replace(/^preview-src\/support.js$/, 'support.js');
const read = (file) => readFile(path.join(root, previewSource(file)), 'utf8');
const readJson = async (file) => JSON.parse(await read(file));

// Content keys stay kr/en/jp; URLs and html lang use ISO codes.
const languages = [
  { key: 'kr', html: 'ko', prefix: '', locale: 'ko_KR', label: '한국어' },
  { key: 'en', html: 'en', prefix: '/en', locale: 'en_US', label: 'English' },
  { key: 'jp', html: 'ja', prefix: '/ja', locale: 'ja_JP', label: '日本語' },
];

const labels = {
  kr: { nav: '주요 페이지', languages: '언어', storyTypes: 'Approach', trackRecord: 'Track Record', members: '소개', works: '디스코그래피', contact: '프로젝트 문의' },
  en: { nav: 'Main pages', languages: 'Language', storyTypes: 'Approach', trackRecord: 'Track Record', members: 'About', works: 'Discography', contact: 'Project Inquiry' },
  jp: { nav: '主要ページ', languages: '言語', storyTypes: 'Approach', trackRecord: 'Track Record', members: '紹介', works: 'ディスコグラフィー', contact: 'プロジェクトのご相談' },
};

const [shell, template, component, siteJsonText, seoJsonText, works] = await Promise.all([
  read('src/page.html'),
  readFile(path.join(root, 'src/app/template.html')),
  readFile(path.join(root, 'src/app/component.js')),
  read('assets/data/site-content.json'),
  read('assets/data/seo-content.json'),
  readJson('assets/data/works-data.json'),
]);
const site = JSON.parse(siteJsonText);
const seo = JSON.parse(seoJsonText);
const baseUrl = seo.baseUrl.replace(/\/+$/, '');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paragraphs = (value) => String(value ?? '').trim().split(/\n{2,}/).filter(Boolean)
  .map((block) => `<p>${block.split('\n').map(esc).join('<br>')}</p>`).join('\n');
const localized = (item, lang) => ({ ...item, ...((item && item.translations && item.translations[lang]) || {}) });
const urlFor = (lang, pagePath) => `${baseUrl}${lang.prefix}${pagePath}`;
const fileFor = (lang, pagePath) => `${lang.prefix.slice(1)}${pagePath}index.html`.replace(/^\//, '');
// Nanum Gothic via Google Fonts `text=`: one small file per weight holding only the characters the site uses.
const nanumUrl = (chars) => `https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&amp;display=swap&amp;text=${encodeURIComponent(chars)}`;
const nanumFontUrl = nanumUrl(await nanumCharacters(root));

// Cloudflare Web Analytics: set seo-content.json → analytics.cloudflareToken to switch it on.
const analyticsToken = String(seo.analytics?.cloudflareToken || '').trim();
const analyticsTag = analyticsToken
  ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: analyticsToken })}'></script>`
  : '';
const version = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12);
// The site component: the class core (component.js) plus its method groups (parts/*.js), attached to the
// prototype. Each part defines `var Component<Name> = { ...methods }`.
const COMPONENT_PARTS = ['content', 'intro', 'scene', 'bridges', 'routing'];
const composeComponent = async (dir) => {
  const core = await read(`${dir}/component.js`);
  const parts = await Promise.all(COMPONENT_PARTS.map((p) => read(`${dir}/parts/${p}.js`)));
  const names = COMPONENT_PARTS.map((p) => 'Component' + p[0].toUpperCase() + p.slice(1));
  return `${core}\n${parts.join('\n')}\nObject.assign(Component.prototype, ${names.join(', ')});\n`;
};

// The runtime in support.js boots on DOMContentLoaded from two <script type="application/octet-stream">
// blocks this bundle inserts: the template (data-dc-template) and the component script (data-dc-script), as plain text.
const makeAppBundle = (template, component) => `// GENERATED by scripts/build.mjs from src/app/ — do not edit.
(function (app) {
  var here = document.currentScript;
  function insert(attributes, text) {
    var el = document.createElement('script');
    el.type = 'application/octet-stream';
    for (var name in attributes) el.setAttribute(name, attributes[name]);
    el.textContent = text;
    here.parentNode.insertBefore(el, here);
  }
  insert({ 'data-dc-template': '' }, app.template);
  insert({ 'data-dc-script': '', 'data-props': app.props }, app.script);
})(${JSON.stringify({ template: String(template), script: String(component), props: '{"$preview":{"width":"100%","height":"100vh"}}' })});
`;
// cache keys come from content, so a changed stylesheet or script always reaches visitors
const sharedCss = (await Promise.all(['src/styles/site-and-dialogs.css','src/styles/discography.css','src/styles/story-journey.css'].map(read))).join('\n');
// Preserve stylesheet order exactly; production serves one cache-versioned file.

const [supportJs, responsiveCss, worksCssText, worksJsText, worksDataText] = await Promise.all(
  ['support.js', 'assets/css/responsive.css', 'assets/css/works.css', 'assets/js/works.js', 'assets/data/works-data.json'].map((f) => f === 'assets/css/works.css' ? Promise.resolve(sharedCss) : read(f)));
const siteUxJs = await read('assets/js/site-ux.js');
const imageSlotJs = await read('assets/js/image-slot.js');
const liveTemplate = String(template)
  .replace(/assets\/js\/image-slot\.js\?v=[\w-]+/, `assets/js/image-slot.js?v=${version(imageSlotJs)}`)
  .replace(/assets\/css\/works\.css\?v=[\w-]+/, `assets/css/works.css?v=${version(worksCssText)}`)
  .replace(/assets\/js\/works\.js\?v=[\w-]+/, `assets/js/works.js?v=${version(worksJsText + worksDataText)}`)
  .replace(/assets\/css\/responsive\.css\?v=[\w-]+/, `assets/css/responsive.css?v=${version(responsiveCss)}`)
  .replace(/assets\/js\/site-ux\.js\?v=[\w-]+/, `assets/js/site-ux.js?v=${version(siteUxJs)}`);
const appBundle = makeAppBundle(liveTemplate, await composeComponent('src/app'));

const dataScript = (data, name, aliases = []) =>
  [`window.${name} = ${JSON.stringify(data, null, 2)};`, ...aliases.map((alias) => `window.${alias} = window.${name};`)].join('\n') + '\n';
// The newest work rides along with the site content, so the home page can show it without loading Works.
const latestWorkOf = (list) => {
  const work = [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!work) return null;
  const tr = work.translations || {};
  const pick = (lang) => ({ title: (tr[lang] && tr[lang].title) || work.title, artist: (tr[lang] && tr[lang].artist) || work.artist });
  return { slug: work.slug, title: work.title, artist: work.artist, thumb: work.thumb || work.image, translations: { en: pick('en'), jp: pick('jp') } };
};
// A work card (title, artist, cover) for a slug the site copy points at, so home and How We Work need no Works data
const workCardOf = (slug, list) => {
  const work = slug && list.find((item) => item.slug === slug);
  if (!work) return null;
  const tr = work.translations || {};
  const pick = (lang) => ({ title: (tr[lang] && tr[lang].title) || work.title, artist: (tr[lang] && tr[lang].artist) || work.artist });
  return { slug: work.slug, title: work.title, artist: work.artist, thumb: work.thumb || work.image, translations: { en: pick('en'), jp: pick('jp') } };
};
// home's featured song (home.listen) and How We Work's case (projects.proof.case)
const siteExtras = (siteData, worksData) => ({
  latestWork: latestWorkOf(worksData.works),
  listenWork: workCardOf(((siteData.home || {}).listen || {}).slug, worksData.works),
  caseWork: workCardOf((((siteData.projects || {}).proof || {}).case || {}).slug, worksData.works),
});
const siteScript = dataScript({ ...site, ...siteExtras(site, works) }, 'TALETONE_CONTENT');
const seoScript = dataScript(seo, 'TALETONE_SEO_CONTENT', ['TALETONE_SEO']);

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

function noscriptBody(page, lang) {
  const t = labels[lang.key];
  const copy = pageCopy(page, lang);
  const home = localized(site.home, lang.key);
  const sections = [];
  const section = (heading, body) => sections.push(`<section>\n<h2>${esc(heading)}</h2>\n${body}\n</section>`);

  if (page.key === 'home') {
    const projects = localized(site.projects, lang.key);
    section(t.storyTypes, `<p>${esc(projects.subtitle)}</p>\n<p>${esc(projects.description)}</p>`);
    const featured=works.works.find(work=>work.slug===home.listen?.slug);
    if(featured){const work=localized(featured,lang.key);section(home.listen.label, '<p>'+esc(work.title)+' — '+esc(work.artist)+'</p>');}
    section(t.trackRecord, `<ul>\n${site.trackRecord.map((item) => localized(item, lang.key))
      .map((item) => `<li>${esc(item.value)} · ${esc(item.label)} (${esc(item.note)})</li>`).join('\n')}\n</ul>`);
  }
  if (page.key === 'projects') {
    const projects = localized(site.projects, lang.key);
    section(t.storyTypes, `<p>${esc(projects.subtitle)}</p>\n<p>${esc(projects.description)}</p>`);
    const proof=projects.proof||{};
    for(const row of proof.rows||[]) section(row.label, '<p>'+esc((row.steps||[]).map(step=>step.text).join(' → '))+'</p>'+paragraphs(row.result));
    if(proof.closing) sections.push(paragraphs(proof.closing));
    if(proof.case?.title){ const item=proof.case;section(item.title,'<dl>'+(item.steps||[]).map(step=>'<dt>'+esc(step.label)+'</dt><dd>'+esc(step.text)+'</dd>').join('')+'</dl>'+paragraphs(item.lesson)); }
    for (const card of projects.cards.map((item) => localized(item, lang.key))) {
      sections.push(`<article>\n<h3>${esc(card.label)} · ${esc(card.title)}</h3>\n<p>${esc(card.description)}</p>\n</article>`);
    }
  }
  if (page.key === 'members') {
    const about=localized(site.membersMeta,lang.key);section(about.titleAccent,paragraphs(about.subtitle));
    for (const member of site.members.map((item) => localized(item, lang.key))) {
      sections.push(`<article>\n<h2>${esc(member.name)} — ${esc(member.role)}</h2>\n${member.tagline ? `<p>${esc(member.tagline)}</p>\n` : ''}${paragraphs(member.creditsText)}\n</article>`);
    }
  }
  if (page.key === 'works') {
    section(t.works, `<ul>\n${worksByDate
      .map((item) => localized(item, lang.key))
      .map((item) => `<li><strong>${esc(item.title)}</strong> — ${esc(item.artist)} · ${esc(item.type)} (${esc(item.date)})${item.description ? `<br>${esc(String(item.description).trim())}` : ''}</li>`)
      .join('\n')}\n</ul>`);
  }

  if (page.key === 'contact') {
    const contact = localized(site.contact, lang.key);
    section(`${contact.titleLine1} ${contact.titleAccent}`, `<p>${esc(contact.subtitle)}</p>\n<p>${esc(contact.caption)}</p><ul>${(contact.guideItems||[]).map(item=>'<li>'+esc(item)+'</li>').join('')}</ul>`);
  }

  const nav = seo.pages.map((p) => `<a href="${lang.prefix}${p.path}">${esc(p.label)}</a>`).join('\n');
  const switcher = languages.map((l) => `<a href="${l.prefix}${page.path}" hreflang="${l.html}" lang="${l.html}">${esc(l.label)}</a>`).join('\n');
  return `<main class="tt-noscript">
<style>.tt-noscript{font-family:'Nanum Gothic',system-ui,sans-serif;max-width:860px;padding:48px 22px;line-height:1.7;color:#141C30;background:#eef6f4}.tt-noscript a{color:#0E6E7D;font-weight:800;margin-right:10px}</style>
<h1>${esc(copy.title)}</h1>
<p><strong>${esc(home.tagline)}</strong></p>
<p>${esc(copy.description)}</p>
${sections.join('\n')}
<nav aria-label="${esc(t.nav)}">
${nav}
</nav>
<nav aria-label="${esc(t.languages)}">
${switcher}
</nav>
<p><a href="${esc(inquiryMailto(lang))}">${esc(site.contact.email)}</a></p>
</main>`;
}

function renderPage(page, lang, overrides = {}) {
  const copy = pageCopy(page, lang);
  const hreflang = [
    ...languages.map((l) => `<link rel="alternate" hreflang="${l.html}" href="${urlFor(l, page.path)}">`),
    `<link rel="alternate" hreflang="x-default" href="${urlFor(languages[0], page.path)}">`,
  ].join('\n');
  const ogLocale = [
    `<meta property="og:locale" content="${lang.locale}">`,
    ...languages.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${l.locale}">`),
  ].join('\n');
  const values = {
    HTML_LANG: lang.html,
    TITLE: esc(copy.title),
    DESCRIPTION: esc(copy.description),
    URL: urlFor(lang, page.path),
    HREFLANG: hreflang,
    OG_LOCALE: ogLocale,
    SEO_VERSION: version(seoScript),
    SITE_VERSION: version(siteScript),
    JSON_LD: jsonLd(page, lang),
    NOSCRIPT: noscriptBody(page, lang),
    APP_VERSION: version(appBundle),
    SUPPORT_VERSION: version(supportJs),
    ANALYTICS: analyticsTag,
    NANUM_FONT_URL: nanumFontUrl,
    ...overrides,
  };
  return shell.replace(/%%([A-Z_]+)%%/g, (match, key) => {
    if (!(key in values)) throw new Error(`src/page.html: unknown placeholder ${match}`);
    return values[key];
  });
}

const worksByDate = [...works.works].sort((a, b) => String(b.date).localeCompare(String(a.date)));
const missingSlug = works.works.find((item) => !/^[a-z0-9-]+$/.test(item.slug || ''));
if (missingSlug) throw new Error(`Every work needs a lowercase "slug": ${missingSlug.id || missingSlug.slotId}`);

// Inquiry mail prefilled with the visitor's language template.
function inquiryMailto(lang) {
  const contact = localized(site.contact, lang.key);
  return `mailto:${site.contact.email}?subject=${encodeURIComponent(contact.mailSubject)}&body=${encodeURIComponent(contact.mailTemplate)}`;
}

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

// ---- Preview of work in progress (taletone.net/preview/, not indexed) ----
// Preview shares the approved production sources and keeps isolated URLs/noindex metadata.
const [pSupport, pResponsiveCss, pSiteUx] = await Promise.all([read('preview-src/support.js'), read('assets/css/responsive.css'), read('preview-src/js/site-ux.js')]);
const [pTemplate, pComponent, pSiteText, pWorksText, pWorksJs, pWorksCss] = await Promise.all([
  read('preview-src/app/template.html'), composeComponent('preview-src/app'),
  read('preview-src/data/site-content.json'), read('preview-src/data/works-data.json'),
  read('preview-src/js/works.js'), Promise.resolve(sharedCss),
]);
const previewTemplate = pTemplate
  .replace(/assets\/js\/image-slot\.js\?v=[\w-]+/, `assets/js/image-slot.js?v=${version(imageSlotJs)}`)
  .replace(/assets\/css\/works\.css\?v=[\w-]+/, `preview/assets/css/works.css?v=${version(pWorksCss)}`)
  .replace(/assets\/js\/works\.js\?v=[\w-]+/, `preview/assets/js/works.js?v=${version(pWorksJs + pWorksText)}`)
  .replace(/assets\/css\/responsive\.css\?v=[\w-]+/, `assets/css/responsive.css?v=${version(pResponsiveCss)}`)
  .replace(/assets\/js\/site-ux\.js\?v=[\w-]+/, `preview/assets/js/site-ux.js?v=${version(pSiteUx)}`);
const previewApp = makeAppBundle(previewTemplate, pComponent);
const previewSiteData = JSON.parse(pSiteText);
const previewSiteScript = dataScript({ ...previewSiteData, ...siteExtras(previewSiteData, JSON.parse(pWorksText)) }, 'TALETONE_CONTENT');
const previewNanum = nanumUrl(await nanumCharacters(root, PREVIEW_SOURCES));
// every route of the live site exists under /preview/ too, so a reload or a shared link stays in the preview
const previewPage = (page, lang) => renderPage(page, lang, {
  APP_VERSION: version(previewApp),
  SITE_VERSION: version(previewSiteScript),
  NANUM_FONT_URL: previewNanum,
}).replace(/href="(\/(?:en\/|ja\/)?discography\/[^"]*)"/g,'href="/preview$1"').replace(/<html lang="([^"]+)">/, '<html lang="$1" data-intro-v2>')
  .replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex, nofollow">')
  .replaceAll('"assets/app/app.js?v=', '"preview/assets/app/app.js?v=')
  .replace('"assets/data/site-content.js?v=', '"preview/assets/data/site-content.js?v=')
  .replace(/\.\/support\.js\?v=[\w-]+/, `preview/support.js?v=${version(pSupport)}`);
const previewOutputs = [
  ...seo.pages.flatMap((page) => languages.map((lang) => [`preview/${fileFor(lang, page.path)}`, previewPage(page, lang)])),
  ['preview/support.js', pSupport],
  ['preview/assets/app/app.js', previewApp],
  ['preview/assets/data/site-content.js', previewSiteScript],
  ['preview/assets/data/works-data.json', pWorksText],
  ['preview/assets/js/works.js', pWorksJs],
  ['preview/assets/js/site-ux.js', pSiteUx],
  ['preview/assets/css/works.css', pWorksCss],
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
const legacyOutputs = ['', '/preview'].flatMap(preview => languages.flatMap(lang => {
  const prefix=preview+lang.prefix;
  const pairs=[['/members/','/about/'],['/story-types/','/approach/'],['/projects/','/approach/'],['/works/','/discography/']];
  return pairs.map(([from,to])=>[(prefix+from+'index.html').slice(1),redirectPage(prefix+to,lang)]);
}));
const outputs = [
  ...legacyOutputs,
  ...seo.pages.flatMap((page) => languages.map((lang) => [fileFor(lang, page.path), renderPage(page, lang)])),
  ['assets/app/app.js', appBundle],
  ['assets/css/works.css', sharedCss],
  ...previewOutputs,
  ['assets/data/site-content.js', siteScript],
  ['assets/data/seo-content.js', seoScript],
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
