// Builds every generated file from its editable source:
//   src/page.html + src/app/* + assets/data/*.json -> route pages for KR (/), EN (/en/) and JP (/ja/)
//   assets/data/*-content.json                     -> assets/data/*-content.js
//   assets/data/seo-content.json                   -> sitemap.xml
//
//   node scripts/build.mjs          rewrite generated files
//   node scripts/build.mjs --check  fail if any generated file is out of date
//
// The dc-runtime in support.js reads the app from two base64 <script> blocks
// in each page, and the pages load the data as window globals from the .js
// files. Edit the sources, never the generated output.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const read = (file) => readFile(path.join(root, file), 'utf8');
const readJson = async (file) => JSON.parse(await read(file));

// Content keys stay kr/en/jp; URLs and html lang use ISO codes.
const languages = [
  { key: 'kr', html: 'ko', prefix: '', locale: 'ko_KR', label: '한국어' },
  { key: 'en', html: 'en', prefix: '/en', locale: 'en_US', label: 'English' },
  { key: 'jp', html: 'ja', prefix: '/ja', locale: 'ja_JP', label: '日本語' },
];

const labels = {
  kr: { nav: '주요 페이지', languages: '언어', storyTypes: '어떤 이야기와 일하는가', trackRecord: 'Track Record', latestNews: '최신 소식', members: '멤버', works: '작업물', news: '소식', contact: '프로젝트 문의' },
  en: { nav: 'Main pages', languages: 'Language', storyTypes: 'Stories we work with', trackRecord: 'Track Record', latestNews: 'Latest News', members: 'Members', works: 'Works', news: 'News', contact: 'Project Inquiry' },
  jp: { nav: '主要ページ', languages: '言語', storyTypes: '私たちが向き合う物語', trackRecord: 'Track Record', latestNews: '最新ニュース', members: 'メンバー', works: '制作実績', news: 'ニュース', contact: 'プロジェクトのご相談' },
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
const version = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12);

// Same layout as the original export: 76-column base64 lines between leading and trailing newlines.
const encode = (buffer) => `\n${buffer.toString('base64').match(/.{1,76}/g).join('\n')}\n`;

const dataScript = (data, name, aliases = []) =>
  [`window.${name} = ${JSON.stringify(data, null, 2)};`, ...aliases.map((alias) => `window.${alias} = window.${name};`)].join('\n') + '\n';
const siteScript = dataScript(site, 'TALETONE_CONTENT');
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
    email: 'contact@taletone.net',
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
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [organization, website, webPage] }).replace(/</g, '\\u003c');
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
    section(t.trackRecord, `<ul>\n${site.trackRecord.map((item) => localized(item, lang.key))
      .map((item) => `<li>${esc(item.value)} · ${esc(item.label)} (${esc(item.note)})</li>`).join('\n')}\n</ul>`);
    section(t.latestNews, `<ul>\n${site.news.map((item) => localized(item, lang.key))
      .map((item) => `<li>${esc(item.date)} · ${esc(item.title)}</li>`).join('\n')}\n</ul>`);
  }
  if (page.key === 'projects') {
    const projects = localized(site.projects, lang.key);
    section(t.storyTypes, `<p>${esc(projects.subtitle)}</p>\n<p>${esc(projects.description)}</p>`);
    for (const card of projects.cards.map((item) => localized(item, lang.key))) {
      sections.push(`<article>\n<h3>${esc(card.label)} · ${esc(card.title)}</h3>\n<p>${esc(card.description)}</p>\n</article>`);
    }
  }
  if (page.key === 'members') {
    for (const member of site.members.map((item) => localized(item, lang.key))) {
      sections.push(`<article>\n<h2>${esc(member.name)} — ${esc(member.role)}</h2>\n${member.tagline ? `<p>${esc(member.tagline)}</p>\n` : ''}${paragraphs(member.creditsText)}\n</article>`);
    }
  }
  if (page.key === 'works') {
    section(t.works, `<ul>\n${[...works.works].sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((item) => localized(item, lang.key))
      .map((item) => `<li><strong>${esc(item.title)}</strong> — ${esc(item.artist)} · ${esc(item.type)} (${esc(item.date)})${item.description ? `<br>${esc(String(item.description).trim())}` : ''}</li>`)
      .join('\n')}\n</ul>`);
  }
  if (page.key === 'news') {
    for (const item of site.news.map((news) => localized(news, lang.key))) {
      sections.push(`<article>\n<h2>${esc(item.date)} · ${esc(item.title)}</h2>\n${paragraphs(item.body || item.summary)}\n</article>`);
    }
  }
  if (page.key === 'contact') {
    const contact = localized(site.contact, lang.key);
    section(`${contact.titleLine1} ${contact.titleAccent}`, `<p>${esc(contact.subtitle)}</p>\n<p>${esc(contact.caption)}</p>`);
  }

  const nav = seo.pages.map((p) => `<a href="${lang.prefix}${p.path}">${esc(p.label)}</a>`).join('\n');
  const switcher = languages.map((l) => `<a href="${l.prefix}${page.path}" hreflang="${l.html}" lang="${l.html}">${esc(l.label)}</a>`).join('\n');
  return `<main class="tt-noscript">
<style>.tt-noscript{font-family:system-ui,sans-serif;max-width:860px;padding:48px 22px;line-height:1.7;color:#141C30;background:#eef6f4}.tt-noscript a{color:#0E6E7D;font-weight:800;margin-right:10px}</style>
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
<p><a href="${esc(site.contact.link)}">contact@taletone.net</a></p>
</main>`;
}

function renderPage(page, lang) {
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
    TEMPLATE: encode(template),
    SCRIPT: encode(component),
  };
  return shell.replace(/%%([A-Z_]+)%%/g, (match, key) => {
    if (!(key in values)) throw new Error(`src/page.html: unknown placeholder ${match}`);
    return values[key];
  });
}

function sitemap() {
  const urls = seo.pages.flatMap((page) => languages.map((lang) => [
    '  <url>',
    `    <loc>${urlFor(lang, page.path)}</loc>`,
    ...languages.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.html}" href="${urlFor(l, page.path)}"/>`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(languages[0], page.path)}"/>`,
    '  </url>',
  ].join('\n')));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

const outputs = [
  ...seo.pages.flatMap((page) => languages.map((lang) => [fileFor(lang, page.path), renderPage(page, lang)])),
  ['assets/data/site-content.js', siteScript],
  ['assets/data/seo-content.js', seoScript],
  ['sitemap.xml', sitemap()],
];

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
