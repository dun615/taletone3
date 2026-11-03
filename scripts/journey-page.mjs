// Renders the TALETONE journey (the new home under /preview/) for one language and one route.
//
// One document serves two layouts. Without JS, on phones and for search engines it reads top to bottom: each
// chapter is a section of phone messages, the featured works, the steps, the full discography as a list, the
// contact form and the profile. On desktop, src/journey/journey.js pins the chapters onto a fixed stage and plays
// them by scroll. Copy comes from assets/data/site-content.json (journey, projects, contact, members, partners,
// trackRecord) and assets/data/works-data.json; nothing here is hard-coded per language.

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const lines = (value) => esc(value).replace(/\n/g, '<br>');
const plain = (value) => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const merge = (base, lang) => {
  const own = (base && base.translations && base.translations[lang]) || {};
  return { ...base, ...own };
};

// Each work localized, with only the fields the page and its script use.
const ytId = (url) => { const m = String(url || '').match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/) || String(url || '').match(/^([\w-]{11})$/); return m ? m[1] : ''; };

export function journeyWorks(worksData, lang) {
  const local = (item) => (lang === 'kr' ? item : merge(item, lang));
  const unit = (item) => {
    const u = local(item);
    return { title: plain(u.title || item.title), artist: plain(u.artist || item.artist), type: plain(u.type || item.type), description: plain(u.description || item.description), credits: String(u.credits || item.credits || ''), image: item.image || '', thumb: item.thumb || item.image || '', audio: item.audio || '', youtube: item.youtube || '', yt: ytId(item.youtube), date: item.date || '', roles: item.roles || [], fit: item.fit || 'cover', pos: `${item.posX || '50%'} ${item.posY || '50%'}` };
  };
  const gains = (worksData.loudness && worksData.loudness.files) || {};
  const gainOf = (src) => (src && gains[src] && typeof gains[src].gain === 'number' ? gains[src].gain : 0);
  return worksData.works.map((w) => {
    const u = unit(w);
    const versions = (w.versions || []).map((v) => ({ language: v.language || '', audio: v.audio || '', gain: gainOf(v.audio) })).filter((v) => v.audio);
    const tracks = (w.tracks || []).map((t) => { const tu = unit(t); return { title: tu.title, description: tu.description, audio: tu.audio, gain: gainOf(tu.audio), roles: tu.roles, thumb: t.thumb || '', credits: tu.credits, yt: tu.yt }; });
    const covers = (w.officialCovers || []).map((c) => ({ artist: (lang === 'en' && c.artistEn) || (lang === 'jp' && c.artistJp) || c.artist || '', yt: ytId(c.youtube) })).filter((c) => c.yt);
    const roles = [...new Set([...(w.roles || []), ...(w.tracks || []).flatMap((t) => t.roles || [])])];
    return { slug: w.slug, ...u, roles, gain: gainOf(w.audio), field: w.field || 'original', kind: w.kind || 'single', format: w.format || '', versions, tracks, titleTrack: w.titleTrackIndex || 0, pinned: w.pinned || 0, covers };
    // the featured works (pinned 1, 2, 3) open the record in their order; the rest follow, newest first
  }).sort((a, b) => (a.pinned || 1e3) - (b.pinned || 1e3) || b.date.localeCompare(a.date));
}

export function journeyCopy(site, lang) {
  const j = merge(site.journey, lang);
  const projects = merge(site.projects, lang);
  const contact = merge(site.contact, lang);
  const form = merge(contact.form || {}, lang);
  const rows = ((projects.proof && projects.proof.rows) || []).map((row, i) => ({ label: plain((site.projects.proof.rows[i] || {}).label || row.label), title: plain(row.steps && row.steps[0] && row.steps[0].text), text: plain(row.result) }));
  const members = merge(site.membersMeta, lang), footer = merge(site.footerMeta, lang);
  const intro = { hello: plain(members.subtitle), typesLabel: plain(members.typesLabel), types: [projects.audienceGameTitle, projects.audienceCreatorTitle, projects.audienceAnimationTitle].map(plain), creed: plain(String(footer.tagline || '').split(' · ')[0]).replace(/, /, ',\n') };
  const record = (site.trackRecord || [])[0];
  const fact = record ? merge(record, lang) : null;
  const cs = (projects.proof && projects.proof.case) || null;
  return { ...j, intro, caseStudy: cs, rail: j.rail || site.journey.rail, fields: j.fields || site.journey.fields, roles: j.roles || site.journey.roles, chapterLabels: site.journey.chapterLabels, notifyFrom: site.journey.notifyFrom, steps: rows, fact, form, mail: { email: contact.email, formKey: contact.formKey, mailSubject: contact.mailSubject } };
}

const markInk = '/assets/logo/mark-ink.svg';
const markPaper = '/assets/logo/mark-paper.svg';
const avatar = (size = 40) => `<span class="jy-av" style="--av:${size}px"><img src="${markInk}" alt=""></span>`;
const bubble = (id, html, extra = '') => `<div class="jy-say${extra}" id="${id}">${avatar()}<p class="jy-bub"><span class="jy-tx">${html}</span></p></div>`;
const signal = '<span class="jy-signal" aria-hidden="true"><i></i><i></i></span>';
const charm = (id = '') => `<span class="jy-charm" aria-hidden="true"><svg width="20" height="44" viewBox="0 0 20 44"><circle cx="10" cy="5" r="4" fill="none" stroke="#9fa1a6" stroke-width="1.6"/><ellipse cx="10" cy="12" rx="3.4" ry="5" fill="none" stroke="#9fa1a6" stroke-width="1.5"/><ellipse cx="10" cy="20" rx="2.6" ry="5" fill="none" stroke="#9fa1a6" stroke-width="1.5"/><ellipse cx="10" cy="28" rx="3.4" ry="5" fill="none" stroke="#9fa1a6" stroke-width="1.5"/><ellipse cx="10" cy="36" rx="2.6" ry="5" fill="none" stroke="#9fa1a6" stroke-width="1.5"/></svg><span class="jy-dia"><span class="jy-cd"${id ? ` id="${id}"` : ''}></span></span></span>`;

// The back of the phone: a case drawn in silver lines, a camera, stars, a little keyboard.
const caseBack = () => {
  const star = (x, y, r) => `<path d="M${x - r} ${y} Q${x - r * .18} ${y - r * .18} ${x} ${y - r} Q${x + r * .18} ${y - r * .18} ${x + r} ${y} Q${x + r * .18} ${y + r * .18} ${x} ${y + r} Q${x - r * .18} ${y + r * .18} ${x - r} ${y}Z" fill="#fefefe" stroke="#9fa1a6" stroke-width="1.4" stroke-linejoin="round"/>`;
  const keys = Array.from({ length: 8 }, (_, i) => `<rect x="${26 + i * 22.75}" y="312" width="22.75" height="52" fill="#fefefe" stroke="#9fa1a6" stroke-width="1.2"/>`).join('')
    + [1, 2, 4, 5, 6].map((k) => `<rect x="${26 + k * 22.75 - 5.75}" y="312" width="11.5" height="31" rx="1.5" fill="#141c30"/>`).join('');
  return `<svg viewBox="0 0 234 416" aria-hidden="true"><rect x="1" y="1" width="232" height="414" rx="29" fill="#dfe2f4" stroke="#9fa1a6" stroke-width="1.5"/><rect x="5" y="5" width="224" height="406" rx="25" fill="none" stroke="#fefefe" stroke-width="1.5"/><rect x="18" y="18" width="48" height="66" rx="13" fill="#eceef8" stroke="#9fa1a6" stroke-width="1.4"/><circle cx="42" cy="40" r="11" fill="#b0b2b8" stroke="#797c85" stroke-width="1.4"/><circle cx="42" cy="40" r="5" fill="#797c85"/><circle cx="39" cy="37" r="2" fill="#fefefe"/><circle cx="42" cy="66" r="6" fill="#b0b2b8" stroke="#797c85" stroke-width="1.2"/><circle cx="58" cy="28" r="2.4" fill="#fefefe" stroke="#9fa1a6"/>${star(178, 70, 26)}${star(206, 38, 8)}${star(46, 186, 16)}${star(190, 262, 6)}<circle cx="140" cy="228" r="4" fill="#fefefe" stroke="#9fa1a6"/><g>${keys}</g><rect x="26" y="312" width="182" height="52" fill="none" stroke="#797c85" stroke-width="1.4"/></svg>`;
};

const lp = (work, cls = 'jy-lp') => `<span class="${cls}" aria-hidden="true"><img class="jy-vinyl" src="/${esc(work.thumb)}" alt="" loading="lazy" decoding="async"><span class="jy-groove"></span><img class="jy-art" src="/${esc(work.thumb)}" alt="" loading="lazy" decoding="async"><span class="jy-hole"></span></span>`;

const grain = `<svg class="jy-grain" aria-hidden="true" focusable="false"><filter id="jy-pg" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" stitchTiles="stitch" result="a"/><feColorMatrix in="a" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.11  0 0 0 0 0.19  0.32 0 0 0 -0.13" result="A"/><feTurbulence type="fractalNoise" baseFrequency="0.035 0.22" numOctaves="2" seed="3" result="b"/><feColorMatrix in="b" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.11  0 0 0 0 0.19  0.18 0 0 0 -0.08" result="B"/><feMerge><feMergeNode in="B"/><feMergeNode in="A"/></feMerge></filter><rect width="100%" height="100%" filter="url(#jy-pg)"/></svg>`;

export function renderJourney({ lang, route, seoPage, site, worksData, assets, base }) {
  const c = journeyCopy(site, lang.key);
  const works = journeyWorks(worksData, lang.key);
  const extras = journeyExtras(site, worksData, lang.key);
  const wm = merge(site.worksMeta || {}, lang.key);
  const html = lang.html;
  const prefix = `${base}${lang.prefix}`; // e.g. /preview or /preview/en
  const href = (p) => `${prefix}${p}`;
  const member = merge((site.members || [])[0] || {}, lang.key);
  const partners = (site.partners || []).map((p) => merge(p, lang.key));
  const logos = worksData.clientLogos || [];
  const pageTitle = plain(seoPage.title);
  const description = plain(seoPage.description);
  const labels = c.chapterLabels;
  const field = (f) => (c.fields && c.fields[f]) || f;
  const roleText = (roles) => roles.map((r) => c.roles[r]).filter(Boolean).join(' · ');
  const year = (w) => (w.date || '').slice(0, 4);
  const formOpts = (c.form.songOptions || []).map((o) => `<label class="jy-chip"><input type="checkbox" name="song" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('');
  const field2 = (id, label, input) => `<div class="jy-field"><label for="${id}">${esc(label)}</label>${input}</div>`;
  // the history, as the live sheet reads it: '| 2026' opens a year, '* work — roles' an entry, an indented '* track'
  // belongs to the entry above, '[text](url)' links it, '#tags' lines are dropped
  const creditLines = String(member.creditsText || '').split('\n').filter((line) => line.trim() && !/^\s*#/.test(line)).map((line) => {
    const t = line.trim(), link = t.match(/^\[(.+)\]\((https?:[^)]+)\)$/);
    if (link) return `<li class="jy-cr-link"><a href="${esc(link[2])}" target="_blank" rel="noopener">${esc(link[1])} ↗</a></li>`;
    if (t.startsWith('|')) return `<li class="jy-cr-year">${esc(t.replace(/^\|\s*/, ''))}</li>`;
    const [work, roles] = t.replace(/^\*\s*/, '').split(/\s+—\s+/);
    return `<li${/^\s/.test(line) ? ' class="jy-cr-sub"' : ''}><b>${esc(work)}</b>${roles ? `<span>${esc(roles)}</span>` : ''}</li>`;
  }).join('');
  const langLinks = [['kr', '', 'KR', '한국어'], ['en', '/en', 'EN', 'English'], ['jp', '/ja', 'JP', '日本語']]
    .map(([key, p, short, name]) => `<a href="${base}${p}${route}" hreflang="${key === 'kr' ? 'ko' : key === 'jp' ? 'ja' : 'en'}" lang="${key === 'kr' ? 'ko' : key === 'jp' ? 'ja' : 'en'}"${key === lang.key ? ' aria-current="true"' : ''} aria-label="${esc(name)}">${short}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="${html}" class="jy-doc">
<head>
<meta charset="utf-8">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light only">
<meta name="theme-color" content="#fefefe">
<link rel="icon" href="/assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/line-seed-kr-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/line-seed-kr-700.woff2" as="font" type="font/woff2" crossorigin>
${lang.key === 'jp' ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${assets.lineSeedJp}">\n` : ''}<link rel="stylesheet" href="${assets.css}">
<script>document.documentElement.classList.add('jy-js')</script>
</head>
<body data-route="${esc(route)}" data-lang="${lang.key}" data-base="${esc(prefix)}" data-assets="/">
<a class="jy-skip" href="#journey">${esc(c.skip)}</a>
<header class="jy-top">
  <a class="jy-mark" href="${href('/')}" aria-label="${esc(c.home)}"><img src="${markInk}" alt="" data-paper="${markPaper}" data-ink="${markInk}"></a>
  <button class="jy-mchap" type="button" id="jy-mchap" aria-controls="jy-menu" aria-label="${esc(c.chapters)}">${esc(c.rail.pro)}</button>
  <span class="jy-mprog" aria-hidden="true"><i id="jy-mprog"></i></span>
  <nav class="jy-langtog" aria-label="${esc(c.languages)}">${langLinks}</nav>
  <nav class="jy-menu" id="jy-menu" aria-label="${esc(c.chapters || c.menu)}">
    <ul>
${['pro', 'tale', 'tone', 'record', 'epi'].map((k) => `      <li><a href="${href({ pro: '/', tale: '/about/', tone: '/approach/', record: '/discography/', epi: '/contact/' }[k])}" data-go="${k}">${esc(c.rail[k])}</a></li>`).join('\n')}
      <li><a href="${href('/about/')}" data-go="profile">${esc(c.profile)}</a></li>
    </ul>
  </nav>
</header>
<nav class="jy-rail" aria-label="${esc(c.chapters || c.menu)}"><ol>${['pro', 'tale', 'tone', 'record', 'epi'].map((k) => `<li><a href="${href({ pro: '/', tale: '/about/', tone: '/approach/', record: '/discography/', epi: '/contact/' }[k])}" data-go="${k}"><span>${esc(c.rail[k])}</span><i aria-hidden="true"></i></a></li>`).join('') + `<li class="jy-rail-pf"><a href="${href('/about/')}" data-go="profile"><span>${esc(c.profile)}</span><i aria-hidden="true"></i></a></li>`}</ol></nav>
<div class="jy-track" id="jy-track" aria-hidden="true"></div>
<main class="jy" id="journey">
<div class="jy-stage" id="jy-stage">
${grain}
<canvas class="jy-cv" id="jy-cv" aria-hidden="true"></canvas>
<div class="jy-room" id="jy-room"><div class="jy-room-h" aria-hidden="true"><span class="jy-room-av"><img src="${markInk}" alt=""></span><span class="jy-room-n"><b id="jy-room-t"></b><small id="jy-room-s"></small></span><i class="jy-room-on"></i></div></div>

<section class="jy-ch" data-ch="pro" aria-labelledby="jy-h-pro">
  <h2 class="jy-chl" id="jy-h-pro">${esc(labels[0])}</h2>
  <button class="jy-phone" id="jy-phone" type="button" aria-label="${esc(c.enterLabel)}"><span class="jy-card" id="jy-card"><span class="jy-face jy-back">${caseBack()}<img class="jy-caselogo" src="${markPaper}" alt=""></span><span class="jy-face jy-front"><span class="jy-screen" id="jy-screen"><span class="jy-lock" id="jy-lock"><span class="jy-clock" id="jy-clock">9:41</span><span class="jy-date" id="jy-date"></span><span class="jy-noti">${avatar(26)}<span class="jy-nt"><span class="jy-nh"><b>${esc(c.notifyFrom)}</b>${signal}<em>${esc(c.notifyNow)}</em></span><span class="jy-nb">${esc(c.notify)}</span></span></span></span></span></span></span>${charm()}</button>
  <div class="jy-lead" id="jy-lead">
    <h1>${esc(merge(site.home, lang.key).tagline)}</h1>
    <p class="jy-service">${esc(c.service)}</p>
    <p class="jy-cta"><a class="jy-btn jy-btn-ink" href="${href('/discography/')}" data-go="record">${esc(c.listenNow)}</a><a class="jy-btn" href="${href('/contact/')}" data-go="epi">${esc(merge(site.home, lang.key).contactCtaLabel)}</a></p>
    <p class="jy-scrollhint" aria-hidden="true"><span>${esc(c.scrollHint)}</span><i></i></p>
  </div>
</section>

<section class="jy-ch" data-ch="tale" id="intro" aria-labelledby="jy-h-tale">
  <h2 class="jy-chl" id="jy-h-tale">${esc(c.rail.tale)}</h2>
  <div class="jy-chat jy-voice" aria-live="polite">
    ${bubble('jy-hello', lines(c.intro.hello))}
    <div class="jy-say jy-card-say" id="jy-pcard">${avatar()}<div class="jy-bub jy-pcard"><span class="jy-tx"><span class="jy-pc-head">${avatar(52)}<span><b>${esc(member.name)}</b><small>${esc(member.role)}${member.aka ? ` · ${esc(member.aka)}` : ''}</small></span></span><span class="jy-pc-tag">${esc(member.tagline || '')}</span><button type="button" class="jy-btn jy-btn-ink jy-pc-btn" data-profile="">${esc(c.profileOpen)}</button></span></div></div>
    ${bubble('jy-types', `<b>${esc(c.intro.typesLabel)}</b><small>${c.intro.types.map(esc).join('<br>')}</small>`)}
    ${logos.length ? bubble('jy-clients', `<b>${esc(c.clients)}</b><span class="jy-logo-row">${logos.map((l) => `<img src="/${esc(l.src)}" alt="${esc(l.alt)}" width="${l.width}" height="${l.height}" loading="lazy">`).join('')}</span>`) : ''}
  </div>
</section>

<section class="jy-ch" data-ch="tone" id="approach" aria-labelledby="jy-h-tone">
  <h2 class="jy-chl" id="jy-h-tone">${esc(c.rail.tone)}</h2>
  <div class="jy-chat jy-trail jy-voice" aria-live="polite">
    ${bubble('jy-creed', lines(c.intro.creed))}
${c.steps.map((s, i) => `    ${bubble(`jy-step-${i}`, `<span class="jy-step-l">${esc(s.label)}</span><b>${esc(s.title)}</b><small>${esc(s.text)}</small>`, ' jy-step')}`).join('\n')}
  </div>
</section>

<section class="jy-ch" data-ch="case" aria-labelledby="jy-h-case">
  <h2 class="jy-chl" id="jy-h-case">${esc(c.caseStudy ? c.caseStudy.eyebrow : '')}</h2>
${c.caseStudy ? (() => {
    // a real project: her request comes in on the right, our answer goes out on the left, and the pen draws the
    // way between them, leaving her strength and our question on the line
    const cs = c.caseStudy, w = works.find((x) => x.slug === cs.slug), st = Object.fromEntries(cs.steps.map((x) => [x.kind, x]));
    const face = w ? `<span class="jy-av jy-av-them"><img src="/${esc(w.thumb)}" alt=""></span>` : avatar();
    return `  <div class="jy-case jy-voice" aria-live="polite">
    <div class="jy-say jy-them jy-case-req" id="jy-case-req">${face}<p class="jy-bub"><span class="jy-tx"><span class="jy-step-l">${esc(cs.eyebrow)} · ${esc(cs.title)}</span><span class="jy-case-who">${esc(st.request.label)}</span>${esc(st.request.text)}</span></p></div>
    <ol class="jy-case-marks">
      <li class="jy-case-mark" id="jy-case-m0"><span>${esc(st.strength.label)}</span>${esc(st.strength.text)}</li>
      <li class="jy-case-mark" id="jy-case-m1"><span>${esc(st.question.label)}</span><b>${esc(st.question.text)}</b></li>
    </ol>
    <div class="jy-say jy-case-ans" id="jy-case-ans">${avatar()}<div class="jy-bub"><span class="jy-tx"><span class="jy-case-who">${esc(st.answer.label)}</span><b>${esc(st.answer.text)}</b><small>${esc(cs.lesson)}</small>${w ? `<button type="button" class="jy-btn jy-btn-ink jy-case-btn" data-open="${esc(w.slug)}">${esc(cs.listenLabel)}</button>` : ''}</span></div></div>
  </div>`;
  })() : ''}
</section>

<section class="jy-ch" data-ch="music" aria-labelledby="jy-h-music">
  <h2 class="jy-chl" id="jy-h-music">${esc(labels[3])}</h2>
</section>

<section class="jy-ch" data-ch="record" id="discography" aria-labelledby="jy-h-record">
  <h2 class="jy-chl" id="jy-h-record">${esc(labels[4])}</h2>
  <div class="jy-voice" aria-live="polite">${bubble('jy-found', lines(c.found))}</div>
  <p class="jy-hint" id="jy-hint">${esc(c.turnHint)}</p>
  <button type="button" class="jy-fbtn" id="jy-fbtn" aria-expanded="false" aria-controls="jy-filters">${esc(c.filter)}</button>
  <div class="jy-filters" id="jy-filters">
    <p class="jy-fhead"><b>${esc(c.filter)}</b><button class="jy-x jy-fclose" type="button" id="jy-fclose" aria-label="${esc(c.close)}"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button></p>
    <div class="jy-frow" role="group" aria-label="${esc(c.fieldCaption)}"><span class="jy-fcap" aria-hidden="true">${esc(c.fieldCaption)}</span>${['all', 'game', 'artist', 'original'].map((f) => `<button type="button" class="jy-fchip" data-field="${f}" aria-pressed="${f === 'all'}">${esc(f === 'all' ? c.all : field(f))}</button>`).join('')}</div>
    <div class="jy-frow jy-frow-sub" role="group" aria-label="${esc(c.roleCaption)}"><span class="jy-fcap" aria-hidden="true">${esc(c.roleCaption)}</span>${['all', 'produce', 'compose', 'arrange', 'lyrics'].map((r) => `<button type="button" class="jy-fchip" data-role="${r}" aria-pressed="${r === 'all'}">${esc(r === 'all' ? c.all : c.roles[r])}</button>`).join('')}</div>
  </div>
  <div class="jy-record" id="jy-record">
    <div class="jy-tracks" id="jy-tracks"></div>
    <ol class="jy-spiral" id="jy-spiral" aria-label="${esc(c.discography)}">
${works.map((w, i) => `      <li class="jy-sw${w.pinned ? ' pin' : ''}" data-i="${i}" data-slug="${esc(w.slug)}" data-field="${esc(w.field)}" data-roles="${esc(w.roles.join(' '))}"${w.tracks.length > 1 ? ' data-album=""' : ''}><button type="button" class="jy-sw-btn" data-open="${esc(w.slug)}"><span class="jy-vy" aria-hidden="true"><img src="/${esc(w.thumb)}" alt="" loading="lazy" decoding="async"></span><span class="jy-sw-t"><b>${esc(w.title)}</b><span>${esc(w.artist)} · ${esc(year(w))}</span></span>${w.pinned ? `<span class="jy-pin">✦ ${esc(c.featuredLabel)} ${String(w.pinned).padStart(2, '0')}</span>` : ''}</button></li>`).join('\n')}
    </ol>
  </div>
  <div class="jy-readout" id="jy-readout" aria-live="polite">
    <p class="jy-ro-pin" id="jy-ro-pin" hidden></p>
    <p class="jy-ro-n"><span id="jy-ro-i">01</span> / ${String(works.length).padStart(2, '0')}<span id="jy-ro-c"></span></p>
    <p class="jy-ro-t" id="jy-ro-t"></p>
    <p class="jy-ro-a" id="jy-ro-a"></p>
    <p class="jy-ro-m" id="jy-ro-m"></p>
    <p class="jy-ro-r" id="jy-ro-r"></p>
    <div class="jy-ro-vers jy-s-vers" id="jy-ro-vers" role="group" aria-label="${esc(c.versionLabel)}" hidden></div>
    <div class="jy-ro-trk" id="jy-ro-trk" role="group" hidden></div>
    <div class="jy-ro-btns"><button type="button" class="jy-btn jy-btn-ink" id="jy-ro-play">${esc(c.listen)}</button><button type="button" class="jy-btn" id="jy-ro-open">${esc(c.detail)}</button></div>
    <div class="jy-ro-nav"><button type="button" class="jy-round" id="jy-ro-prev" aria-label="${esc(c.prev)}"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M9 2L4 7l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" class="jy-round" id="jy-ro-next" aria-label="${esc(c.next)}"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 2l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" class="jy-btn jy-btn-quiet" id="jy-view" aria-pressed="false" data-on="${esc(c.recordView)}" data-off="${esc(c.listView)}">${esc(c.listView)}</button></div>
  </div>
  <div class="jy-tabs" id="jy-tabs" role="tablist" aria-label="${esc(c.discography)}">${[['songs', works.reduce((n, w) => n + (w.tracks.length > 1 ? w.tracks.length : 1), 0)], ['mix', extras[0].items.length], ['etc', extras[1].items.length]].map(([k, n], i) => `<button type="button" role="tab" class="jy-tab" data-tab="${k}" aria-selected="${i === 0}"${i ? ' aria-controls="jy-shelf"' : ''}>${esc(c.tabs[k])}<small>${n}</small></button>`).join('')}<button type="button" class="jy-hist" data-history="">${esc(wm.historyLabel || c.history)}</button></div>
  <section class="jy-shelf" id="jy-shelf" aria-labelledby="jy-shelf-h" hidden>
    <button class="jy-x" type="button" id="jy-shelf-x" aria-label="${esc(c.close)}"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
    <div class="jy-shelf-in"><p class="jy-shelf-k" id="jy-shelf-k"></p><h3 id="jy-shelf-h"></h3><p class="jy-shelf-n" id="jy-shelf-n"></p><div class="jy-shelf-roles" id="jy-shelf-roles" role="group"></div><ul class="jy-cards" id="jy-cards"></ul><button type="button" class="jy-btn jy-more-btn" id="jy-more" hidden></button></div>
  </section>
  <div class="jy-extra">${extras.map((g) => `<details><summary>${esc(g.label)} · ${g.items.length}</summary><p>${esc(g.note)}</p><ul>${g.items.map((it) => `<li><b>${esc(it.title)}</b> — ${esc(it.artist)}${it.cover ? ` · ${esc(g.coverTag)}` : ''}${it.own ? ` · ${esc(c.ownSong)}` : ''} · ${esc(it.roles)}${it.dateText ? ` · <time datetime="${esc(it.date)}">${esc(it.dateText)}</time>` : ''}${it.yt ? ` <a href="https://www.youtube.com/watch?v=${esc(it.yt)}" target="_blank" rel="noopener">YouTube ↗</a>` : ''}</li>`).join('')}</ul></details>`).join('')}</div>
</section>

<section class="jy-ch" data-ch="done" aria-labelledby="jy-h-done">
  <h2 class="jy-chl" id="jy-h-done">${esc(labels[4])} · ${esc(labels[5])}</h2>
  <div class="jy-voice" aria-live="polite">${bubble('jy-letter', lines(c.letter))}</div>
</section>

<section class="jy-ch" data-ch="epi" id="contact" aria-labelledby="jy-h-epi">
  <h2 class="jy-chl" id="jy-h-epi">${esc(labels[5])}</h2>
  <div class="jy-voice" aria-live="polite">${bubble('jy-empty', lines(c.empty))}</div>
  <div class="jy-contact" id="jy-contact">
    <button class="jy-x jy-cclose" type="button" id="jy-cclose" aria-label="${esc(c.close)}"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
    <h3 class="jy-ct">${lines(c.contactTitle)}</h3>
    <p class="jy-form-note">${esc(c.form.mailNote)}</p>
    <button type="button" class="jy-btn jy-fopen" id="jy-fopen" aria-controls="jy-form" aria-expanded="false">${esc(c.writeUs)}</button>
    <form class="jy-form" id="jy-form" novalidate>
      ${field2('jy-f-project', c.form.projectLabel, `<input id="jy-f-project" name="project" required="required" maxlength="60" autocomplete="off" placeholder="${esc(c.form.projectPlaceholder)}">`)}
      ${field2('jy-f-reply', c.form.contactLabel, `<input id="jy-f-reply" name="reply" type="email" required="required" autocomplete="email" inputmode="email">`)}
      <details class="jy-more"><summary>${esc(c.more)}</summary>
        ${field2('jy-f-name', c.form.nameLabel, '<input id="jy-f-name" name="name" autocomplete="organization">')}
        <fieldset class="jy-field"><legend>${esc(c.form.songLabel)}</legend><div class="jy-chips">${formOpts}</div></fieldset>
        ${field2('jy-f-budget', c.form.budgetLabel, `<input id="jy-f-budget" name="budget" placeholder="${esc(c.form.budgetPlaceholder)}">`)}
        ${field2('jy-f-schedule', c.form.scheduleLabel, `<input id="jy-f-schedule" name="schedule" placeholder="${esc(c.form.schedulePlaceholder)}">`)}
        ${field2('jy-f-message', c.form.messageLabel, '<textarea id="jy-f-message" name="message" rows="3"></textarea>')}
      </details>
      <button class="jy-send" type="submit">${esc(c.send)}</button>
      <p class="jy-note" id="jy-note" role="status"></p>
      <p class="jy-mail"><a href="mailto:${esc(c.mail.email)}">${esc(c.mail.email)}</a></p>
      <button class="jy-rewind" id="jy-rewind" type="button" hidden><svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><path d="M8 1L2 6l6 5zM16 1l-6 5 6 5z" fill="currentColor"/></svg>${esc(c.rewind)}</button>
    </form>
  </div>
</section>

<div class="jy-frame" id="jy-frame" aria-hidden="true"><div class="jy-scr"><div class="jy-rec" id="jy-rec"><span class="jy-rwash" id="jy-rwash"></span><span class="jy-groove"></span><span class="jy-rec-label" id="jy-rec-label"></span><span class="jy-core">${signal}</span></div></div>${charm('jy-charm-cd')}</div>
<div class="jy-np" id="jy-np" role="region" aria-label="${esc(c.playerLabel)}" hidden><button type="button" class="jy-np-play" id="jy-np-play" aria-label="${esc(c.listen)}"><span class="jy-npd" id="jy-npd"></span><svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path id="jy-np-i" d="M6 4l10 6-10 6z" fill="currentColor"/></svg></button><button type="button" class="jy-npt" id="jy-np-open"><b id="jy-npt"></b><span id="jy-npa"></span></button><span class="jy-eq" aria-hidden="true"><i></i><i></i></span><input type="range" class="jy-vol" id="jy-vol" min="0" max="100" value="100" aria-label="${esc(c.volume)}"></div>
<div class="jy-scrim" id="jy-scrim" hidden></div>
<div class="jy-ask" id="jy-ask" role="status" aria-live="polite"><span>${esc(c.askNext)}</span><button type="button" class="jy-btn jy-btn-ink" id="jy-ask-go" tabindex="-1">${esc(c.goOn)}<svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7l5 5 5-5"/></svg></button></div>
<div class="jy-cue" id="jy-cue" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l5 5 5-5"/></svg></div>
<div class="jy-banner" id="jy-banner" role="status">${avatar(34)}<div><b>${esc(c.notifyFrom)}</b><p>${esc(c.received)}</p></div></div>
</div>
</main>

<section class="jy-profile" id="about" aria-labelledby="jy-p-name" tabindex="-1">
  <div class="jy-sheet">
    <button class="jy-x" type="button" id="jy-p-close" aria-label="${esc(c.close)}"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
    <header class="jy-p-head">${avatar(72)}<div><h2 id="jy-p-name">${esc(member.name)}</h2><p class="jy-p-role">${esc(member.role)}${member.aka ? ` · ${esc(merge(member, lang.key).aka || member.aka)}` : ''}</p></div></header>
    ${member.tagline ? `<p class="jy-p-tag">${esc(member.tagline)}</p>` : ''}
    <h3>${esc(c.featured)}</h3><ul class="jy-p-list">${(member.featuredCredits || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>${esc(c.people)}</h3><ul class="jy-people">${partners.map((p) => `<li><img src="/${esc(p.image)}" alt="" loading="lazy"><span><b>${esc(p.name)}</b><span>${esc(p.role)}</span></span></li>`).join('')}</ul>
    <h3>${esc(c.clients)}</h3><ul class="jy-logos">${logos.map((l) => `<li><img src="/${esc(l.src)}" alt="${esc(l.alt)}" width="${l.width}" height="${l.height}" loading="lazy"></li>`).join('')}</ul>
    ${member.education ? `<h3>${esc(c.education)}</h3><p class="jy-p-edu">${lines(member.education)}</p>` : ''}
    ${member.iglink ? `<p class="jy-p-sns"><a href="${esc(member.iglink)}" target="_blank" rel="noopener">${esc(c.sns)} ↗</a></p>` : ''}
    <details class="jy-p-all"><summary>${esc(c.allCredits)}</summary><ul class="jy-p-credits">${creditLines}</ul></details>
  </div>
</section>

<div class="jy-story" id="jy-story" hidden>
  <div class="jy-box" role="dialog" aria-modal="true" aria-labelledby="jy-s-title">
    <button class="jy-x" id="jy-s-close" type="button" aria-label="${esc(c.close)}"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
    <div class="jy-in">
      <div class="jy-artside"><img class="jy-s-bg" id="jy-s-bg" alt=""><figure class="jy-s-cover"><span class="jy-lp jy-s-lp" id="jy-s-lp"><img class="jy-vinyl" id="jy-s-v" alt=""><span class="jy-groove"></span><span class="jy-hole"></span></span><img class="jy-art" id="jy-s-a" alt=""></figure><div class="jy-s-video" id="jy-s-video" hidden></div><button type="button" class="jy-btn jy-s-vbtn" id="jy-s-vbtn" hidden><svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg>${esc(c.video)}</button></div>
      <div class="jy-info">
        <p class="jy-s-fmt" id="jy-s-fmt"></p><h3 id="jy-s-title"></h3><p class="jy-s-meta" id="jy-s-meta"></p><p class="jy-s-desc" id="jy-s-desc"></p><p class="jy-s-roles" id="jy-s-roles"></p>
        <dl class="jy-s-facts" id="jy-s-facts" data-date="${esc(wm.yearLabel || '')}" data-format="${esc(wm.typeLabel || '')}" data-type="${esc(wm.releaseLabel || '')}"></dl>
        <div class="jy-s-vers" id="jy-s-vers" role="group" aria-label="${esc(c.versionLabel)}" hidden></div>
        <ol class="jy-s-tracks" id="jy-s-tracks" aria-label="${esc(c.tracks)}"></ol>
        <section class="jy-s-cr" id="jy-s-cr" hidden><p class="jy-s-crh" id="jy-s-crh"></p><div class="jy-s-crl" id="jy-s-credits" tabindex="0"></div></section>
        <section class="jy-s-covers" id="jy-s-covers" hidden><p class="jy-s-crh">${esc(c.covers)}</p><ul id="jy-s-covl"></ul></section>
        <p class="jy-s-yt"><a id="jy-s-yt" target="_blank" rel="noopener">${esc(c.youtube)} ↗</a></p>
        <div class="jy-player"><button class="jy-play" id="jy-play" type="button" aria-pressed="false" aria-label="${esc(c.listen)}"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path id="jy-pi" d="M6 4l10 6-10 6z" fill="currentColor"/></svg></button><svg class="jy-prog" viewBox="0 0 360 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6 C 60 6, 120 2, 180 6 S 300 10, 358 6" fill="none" stroke="#e5e6e8" stroke-width="1.5" stroke-linecap="round"/><path id="jy-pg" d="M2 6 C 60 6, 120 2, 180 6 S 300 10, 358 6" fill="none" stroke="#141c30" stroke-width="3" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg></div>
      </div>
    </div>
  </div>
</div>
<script src="${assets.data}"></script>
<script src="${assets.js}" defer></script>
</body>
</html>
`;
}

// The other work, built as the live Discography's Sound Engineering and ETC tabs: Sound Engineering lists
// mixWorks, plus the studio's own songs and tracks credited with recording, editing, mixing or mastering (with a
// video or audio), plus ETC cards with those credits; duplicates go, newest video first. ETC lists bgmWorks.
const POST = { rec: 'Rec', edit: 'Edit', mix: 'Mix', master: 'Master' };
export function journeyExtras(site, worksData, lang) {
  const c = journeyCopy(site, lang), cardRoles = c.cardRoles || {}, dates = site.videoDates || {};
  const titleKey = { en: 'titleEn', jp: 'titleJp' }[lang];
  const keysOf = (roles) => String(roles || '').split(/\s*·\s*/).map((w) => w.replace(/\s*\(.*\)$/, '')).filter(Boolean);
  const roleText = (roles) => String(roles || '').split(/\s*·\s*/).filter(Boolean).map((word) => { const m = word.match(/^(.*?)(\s*\(.*\))?$/); return (cardRoles[m[1]] || m[1]) + (m[2] || ''); }).join(' · ');
  const dateText = (d) => { const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return String(d); return lang === 'en' ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1]} ${+m[3]}, ${m[1]}` : `${m[1]}.${m[2]}.${m[3]}`; };
  const gains = (worksData.loudness && worksData.loudness.files) || {};
  const card = (it, extra = {}) => {
    const yt = ytId(it.youtube), shown = String((yt && dates[yt]) || it.date || '');
    return { title: (titleKey && it[titleKey]) || it.title, artist: it.artist || '', roles: roleText(it.roles), keys: keysOf(it.roles), yt, audio: yt ? '' : (it.audio || ''), gain: (it.audio && gains[it.audio] && gains[it.audio].gain) || 0, date: shown, dateText: dateText(shown), cover: !!it.cover, ...extra };
  };
  const own = [];
  for (const w of worksData.works) {
    const album = lang === 'kr' ? w : merge(w, lang);
    const units = (w.kind === 'album' && (w.tracks || []).length) ? w.tracks : [w];
    for (const u of units) {
      const post = Object.keys(POST).filter((r) => (u.roles || []).includes(r));
      const yt = ytId(u.youtube || (u === w ? w.youtube : ''));
      if (!post.length || !(yt || u.audio)) continue;
      const lu = lang === 'kr' ? u : merge(u, lang);
      own.push({ title: plain(lu.title || u.title), artist: plain(album.artist || w.artist), roles: post.map((r) => POST[r]).join(' · '), youtube: yt, audio: yt ? '' : u.audio, date: String(u.date || w.date || '').replace(/\./g, '-'), own: true });
    }
  }
  const etcPost = ((site.bgmWorks || {}).items || []).filter((it) => keysOf(it.roles).some((k) => Object.values(POST).includes(k)));
  const group = (key, items, roles) => {
    const g = merge(site[key] || {}, lang), seen = new Set();
    const list = items.filter((it) => { const k = ytId(it.youtube) || it.audio; if (!k || seen.has(k)) return false; seen.add(k); return true; })
      .map((it) => card(it, it.own ? { own: true } : {})).sort((a, b) => b.date.localeCompare(a.date));
    return { key, label: g.label || '', note: g.note || '', coverTag: g.coverTag || '', roles, items: list };
  };
  return [
    group('mixWorks', [...((site.mixWorks || {}).items || []), ...own, ...etcPost], [['Rec', c.roleRec], ['Edit', c.roleEdit], ['Mix', c.roleMix], ['Master', c.roleMaster]]),
    group('bgmWorks', (site.bgmWorks || {}).items || [], null),
  ];
}

export function journeyData(site, worksData, lang) {
  const c = journeyCopy(site, lang);
  const works = journeyWorks(worksData, lang);
  const extras = journeyExtras(site, worksData, lang);
  const drop = ({ chapterLabels, translations, ...rest }) => rest;
  return `window.TT_JOURNEY=${JSON.stringify({ copy: drop(c), works, extras }).replace(/</g, '\\u003c')};\n`;
}
