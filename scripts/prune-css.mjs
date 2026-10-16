// Removes CSS declarations that can never apply because a later rule with the
// same selector, in the same @media/@supports context, sets the same property
// with equal or higher importance. Conservative on purpose: vendor-prefixed
// properties/values and new viewport units are kept, since those are often
// deliberate fallbacks.
//
//   node scripts/prune-css.mjs assets/css/works.css          report only
//   node scripts/prune-css.mjs assets/css/works.css --write  rewrite the file
import { readFile, writeFile } from 'node:fs/promises';

const [file, flag] = process.argv.slice(2);
if (!file) { console.error('usage: node scripts/prune-css.mjs <file.css> [--write]'); process.exit(1); }

// Minimal scanner: rules with their source ranges, skipping comments and strings.
function parseRules(css) {
  const skipComment = (i) => (css.startsWith('/*', i) ? css.indexOf('*/', i + 2) + 2 : i);
  const blockEnd = (open) => {
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      const next = skipComment(i);
      if (next !== i) { i = next - 1; continue; }
      const c = css[i];
      if (c === '"' || c === "'") { i = css.indexOf(c, i + 1); continue; }
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return i;
    }
    throw new Error(`unbalanced braces at ${open}`);
  };
  const declarations = (bodyStart, bodyEnd) => {
    const out = [];
    let start = bodyStart, paren = 0;
    for (let i = bodyStart; i <= bodyEnd; i++) {
      const next = skipComment(i);
      if (next !== i) { i = next - 1; continue; }
      const c = css[i];
      if (c === '"' || c === "'") { i = css.indexOf(c, i + 1); continue; }
      if (c === '(') paren++;
      else if (c === ')') paren--;
      if ((c === ';' && paren === 0) || i === bodyEnd) {
        const text = css.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, '').trim();
        const colon = text.indexOf(':');
        if (colon > 0) {
          const value = text.slice(colon + 1).trim();
          out.push({ prop: text.slice(0, colon).trim().toLowerCase(), value, important: /!\s*important$/i.test(value), start, end: c === ';' ? i + 1 : i });
        }
        start = i + 1;
      }
    }
    return out;
  };
  const rules = [];
  const walk = (from, to, context) => {
    let i = from;
    while (i < to) {
      const next = skipComment(i);
      if (next !== i) { i = next; continue; }
      if (/\s/.test(css[i])) { i++; continue; }
      const open = css.indexOf('{', i);
      if (open === -1 || open >= to) break;
      const prelude = css.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      const close = blockEnd(open);
      if (/^@(media|supports)/i.test(prelude)) walk(open + 1, close, `${context}|${prelude.replace(/\s+/g, ' ')}`);
      else if (!prelude.startsWith('@')) rules.push({ selector: prelude.replace(/\s+/g, ' '), context, start: i, open, close, decls: declarations(open + 1, close) });
      i = close + 1;
    }
  };
  walk(0, css.length, '');
  return rules;
}

// Cut [start, end) plus the indentation before it and the line break after it.
function cut(text, start, end) {
  while (start > 0 && /[ \t]/.test(text[start - 1])) start--;
  while (/[ \t]/.test(text[end] || '')) end++;
  if (text[end] === '\n') end++;
  return text.slice(0, start) + text.slice(end);
}

const original = await readFile(file, 'utf8');
const fallbackish = (d) => d.prop.startsWith('-') || /-webkit-|-moz-|-ms-|\b\d*\.?\d+(dvh|svh|lvh|dvw|svw|lvw)\b/.test(d.value);
const rules = parseRules(original);
const dead = [];
rules.forEach((rule, r) => {
  for (const d of rule.decls) {
    if (fallbackish(d)) continue;
    const overridden = rules.slice(r + 1).some((later) => later.selector === rule.selector && later.context === rule.context
      && later.decls.some((l) => l.prop === d.prop && !fallbackish(l) && (l.important || !d.important)));
    if (overridden) dead.push(d);
  }
});

let output = original;
for (const d of [...dead].sort((a, b) => b.start - a.start)) output = cut(output, d.start, d.end);
// Drop rules left with an empty body (whole selector list through the closing brace).
for (const rule of parseRules(output).filter((r) => !output.slice(r.open + 1, r.close).replace(/\/\*[\s\S]*?\*\//g, '').trim()).reverse()) {
  output = cut(output, rule.start, rule.close + 1);
}
output = output.replace(/\n[ \t]*@(?:media|supports)[^{}]*\{\s*\}[ \t]*(?=\n)/g, '').replace(/\n{3,}/g, '\n\n');
parseRules(output); // throws if the result is unbalanced

console.log(`${file}: ${dead.length} dead declarations, ${(original.match(/!important/g) || []).length} -> ${(output.match(/!important/g) || []).length} !important, ${original.length} -> ${output.length} bytes`);
if (flag === '--write') await writeFile(file, output);
