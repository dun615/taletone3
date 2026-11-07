// The link page a business card's QR code opens (/link/): a name, a role and a column of buttons, on its own dark
// page, apart from the journey. Its content is assets/data/links.json (add a button there: { "label", "url" }).
const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function renderLinkPage({ name, role, links }) {
  if (!name || !Array.isArray(links) || !links.length) throw new Error('links.json needs a name and at least one link');
  for (const link of links) if (!link.label || !/^https:\/\//.test(link.url || '')) throw new Error(`links.json: a link needs a label and an https url (${JSON.stringify(link)})`);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0e0e12">
<title>${esc(name)}</title>
<link rel="icon" href="/assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<style>
:root{color-scheme:dark}
body{margin:0;min-height:100vh;display:flex;justify-content:center;background:#0e0e12;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif}
.w{box-sizing:border-box;width:100%;max-width:420px;padding:56px 20px calc(56px + env(safe-area-inset-bottom,0px));text-align:center}
h1{margin:0 0 6px;font-size:26px}
p{margin:0 0 36px;color:#9a9aa6;letter-spacing:.08em}
a{display:block;margin:12px 0;padding:16px;border-radius:14px;background:#1b1b24;color:#fff;text-decoration:none;font-weight:600;border:1px solid #2b2b38}
a:active{background:#2b2b38}
a:focus-visible{outline:2px solid #fff;outline-offset:2px}
</style>
</head>
<body>
<main class="w">
<h1>${esc(name)}</h1>
<p>${esc(role || '')}</p>
${links.map((link) => `<a href="${esc(link.url)}">${esc(link.label)}</a>`).join('\n')}
</main>
</body>
</html>
`;
}
