// The link page a business card's QR code opens (/link/): the mark in the CD light (the designer's file for a dark
// ground), the name, the role and a column of buttons, on its own dark page, apart from the journey. Its content is assets/data/links.json (add a
// button there: { "label", "url", "icon" (one of ICONS), "primary": true for the one to stand out }).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
// a file's address with its content in it, so a browser drops its old copy when the file changes
const hashed = (file) => `/${file}?v=${createHash('sha256').update(readFileSync(new URL(`../${file}`, import.meta.url))).digest('hex').slice(0, 12)}`;
const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// line icons, drawn in the button's own colour (24 x 24)
const ICONS = {
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none"/>',
  x: '<path d="M5 4.5l14 15M19 4.5l-14 15"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.2 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none"/>',
  home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6.5 9.5V19h11V9.5"/><path d="M10.2 19v-4.6h3.6V19"/>',
  chat: '<path d="M12 4.5c4.7 0 8.5 3 8.5 6.7s-3.8 6.7-8.5 6.7c-.8 0-1.6-.1-2.4-.3L5.6 19.5l1-3.4c-1.9-1.2-3.1-3-3.1-4.9 0-3.7 3.8-6.7 8.5-6.7z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const icon = (name) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.link}</svg>`;
const arrow = '<svg class="go" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h8M8.5 4.5L12 8l-3.5 3.5"/></svg>';

export function renderLinkPage({ name, role, links }) {
  if (!name || !Array.isArray(links) || !links.length) throw new Error('links.json needs a name and at least one link');
  for (const link of links) if (!link.label || !/^https:\/\//.test(link.url || '')) throw new Error(`links.json: a link needs a label and an https url (${JSON.stringify(link)})`);
  // "노사무엘 (TALETONE)": the person's name large, the studio's as the wordmark under it
  const m = /^(.*?)\s*\((.+)\)\s*$/.exec(name), person = m ? m[1] : name, studio = m ? m[2] : '';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0e0e12">
<title>${esc(name)}</title>
<link rel="icon" href="${hashed('assets/icons/favicon-32.png')}" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${hashed('assets/icons/apple-touch-icon.png')}">
<link rel="preload" href="/assets/fonts/nanum-square-round-700.woff2" as="font" type="font/woff2" crossorigin>
<style>
@font-face{font-family:NanumSquareRound;font-weight:400;font-display:swap;src:url(/assets/fonts/nanum-square-round-400.woff2) format("woff2")}
@font-face{font-family:NanumSquareRound;font-weight:700;font-display:swap;src:url(/assets/fonts/nanum-square-round-700.woff2) format("woff2")}
@font-face{font-family:Manjari;font-weight:700;font-display:swap;src:url(/assets/fonts/manjari-700.woff2) format("woff2")}
:root{color-scheme:dark;--bg:#0e0e12;--card:#1b1b24;--line:#2b2b38;--ink:#fefefe;--muted:#a3a8b5}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100dvh;display:flex;justify-content:center;background:var(--bg);color:var(--ink);font-family:NanumSquareRound,Manjari,sans-serif;letter-spacing:-.01em;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.w{position:relative;width:100%;max-width:420px;padding:calc(56px + env(safe-area-inset-top,0px)) 20px calc(48px + env(safe-area-inset-bottom,0px));text-align:center}
.mark{display:block;width:64px;height:auto;margin:0 auto 32px}
h1{margin:0;font-size:28px;font-weight:700;letter-spacing:-.02em}
.studio{display:block;margin:10px 0 0;font-family:Manjari,sans-serif;font-weight:700;font-size:13px;letter-spacing:.16em;margin-right:-.16em;color:var(--ink)}
.role{margin:8px 0 36px;font-family:Manjari,sans-serif;font-size:14px;color:var(--muted);letter-spacing:.01em}
nav{display:flex;flex-direction:column;gap:12px}
a{position:relative;display:flex;align-items:center;gap:14px;min-height:58px;padding:0 18px;border-radius:14px;background:var(--card);border:1px solid var(--line);color:var(--ink);text-decoration:none;font-weight:700;font-size:16px;text-align:left;transition:transform .16s cubic-bezier(.23,1,.32,1),background-color .2s,border-color .2s}
a .i{width:22px;height:22px;flex:none;color:var(--muted)}
a span{flex:1}
a .go{width:16px;height:16px;flex:none;color:var(--muted);transition:transform .2s cubic-bezier(.23,1,.32,1)}
a:active{transform:scale(.98);background:var(--line)}
a:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
@media (hover:hover) and (pointer:fine){a:hover{background:#22222d;border-color:#3a3a4b}a:hover .go{transform:translateX(3px)}}
/* the one to reach out by: the paper-coloured one (the CD light is never a button's) */
a.primary{background:var(--ink);border-color:var(--ink);color:var(--bg)}
a.primary .i,a.primary .go{color:var(--bg)}
a.primary:active{background:#e5e6e8}
@media (hover:hover) and (pointer:fine){a.primary:hover{background:#fafafa;border-color:#fafafa}}
footer{margin-top:40px;font-family:Manjari,sans-serif;font-weight:700;font-size:11px;letter-spacing:.16em;color:#6b7080}
@media (prefers-reduced-motion:reduce){a,a .go{transition:none}}
</style>
</head>
<body>
<main class="w">
<img class="mark" src="/assets/logo/logo-holo-on-dark.svg" alt="TALETONE" width="64" height="70">
<h1>${esc(person)}</h1>
${studio ? `<span class="studio">${esc(studio)}</span>` : ''}
<p class="role">${esc(role || '')}</p>
<nav aria-label="${esc(name)}">
${links.map((link) => `<a href="${esc(link.url)}"${link.primary ? ' class="primary"' : ''}>${icon(link.icon)}<span>${esc(link.label)}</span>${arrow}</a>`).join('\n')}
</nav>
<footer>TALETONE MUSIC</footer>
</main>
</body>
</html>
`;
}
