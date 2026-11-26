#!/usr/bin/env node
// Builds ../BuildOS-Guide.html from ../content/*.md.
//
//   node tools/build-guide.mjs
//
// No install needed. The markdown parser (marked, MIT) is vendored in ./vendor.
// Everything ends up in ONE self-contained HTML file with no external requests.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from './vendor/marked.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const contentDir = path.join(root, 'content');
const outFile = path.join(root, 'BuildOS-Guide.html');
const SITE_TITLE = 'BuildOS Guide';

// ---------------------------------------------------------------- helpers
const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescapeHtml = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// GitHub-style heading ids: lowercase, drop punctuation, spaces -> hyphens.
function slugify(text) {
  return unescapeHtml(text).trim().toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/\s+/g, '-');
}

// Plain text of an inline token list (for ids, TOC labels, titles).
function plainText(tokens) {
  let out = '';
  for (const t of tokens || []) {
    if (t.tokens && t.type !== 'codespan') out += plainText(t.tokens);
    else if (t.type === 'codespan' || t.type === 'text' || t.type === 'escape') out += t.text;
    else if (t.raw) out += t.raw;
  }
  return unescapeHtml(out);
}

const warnings = [];
const warn = (m) => warnings.push(m);

const files = fs.readdirSync(contentDir).filter((f) => f.endsWith('.md')).sort();
const docSlugs = new Set(files.map((f) => f.slice(0, -3)));

// Callout icons (16px, stroke = currentColor)
const svg = (inner) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  note: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>'),
  tip: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/>'),
  important: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>'),
  warning: svg('<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17.5h.01"/>'),
  caution: svg('<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17.5h.01"/>'),
  notbuilt: svg('<path d="M4 6h16v12H4z" stroke-dasharray="3 3"/><path d="M8 12h8"/>'),
};

// ---------------------------------------------------------------- renderer
let cur = null; // per-document state while rendering

const marked = new Marked({
  renderer: {
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      const text = plainText(tokens);
      const base = slugify(text) || 'section';
      let id = base, n = 1;
      while (cur.ids.has(id)) id = `${base}-${n++}`;
      cur.ids.add(id);
      if (depth === 2 || depth === 3) cur.toc.push({ id, text, level: depth });
      return `<h${depth} id="${id}"><span>${inner}</span><a class="h-anchor" href="#/${cur.slug}/${id}" aria-label="Link to this section">#</a></h${depth}>\n`;
    },

    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      let m;
      if ((m = href.match(/^(?:\.\/)?([A-Za-z0-9._-]+)\.md(?:#(.+))?$/))) {
        const slug = m[1];
        if (!docSlugs.has(slug)) {
          warn(`${cur.slug}: link to a file outside the guide ("${href}") kept as plain text`);
          return inner;
        }
        cur.links.push({ href, slug, anchor: m[2] || null });
        return `<a href="#/${slug}${m[2] ? '/' + m[2] : ''}"${t}>${inner}</a>`;
      }
      if (href.startsWith('#')) {
        const anchor = href.slice(1);
        cur.links.push({ href, slug: cur.slug, anchor });
        return `<a href="#/${cur.slug}/${anchor}"${t}>${inner}</a>`;
      }
      const external = /^[a-z][a-z0-9+.-]*:/i.test(href);
      return `<a href="${escapeHtml(href)}"${t}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inner}</a>`;
    },

    code({ text, lang, escaped }) {
      const l = (lang || '').trim().split(/\s+/)[0];
      const cls = l ? ` class="language-${escapeHtml(l)}"` : '';
      const label = l ? ` data-lang="${escapeHtml(l)}"` : '';
      const body = escaped ? text : escapeHtml(text);
      return `<div class="code-block"${label}><button class="copy-btn" type="button">Copy</button><pre><code${cls}>${body}\n</code></pre></div>\n`;
    },

    blockquote({ tokens }) {
      let body = this.parser.parse(tokens);
      let kind = null, title = null, m;
      if ((m = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][^\n<]*\n?/i))) {
        kind = m[1].toLowerCase();
        title = kind[0].toUpperCase() + kind.slice(1);
        body = body.replace(m[0], '<p>');
      } else if ((m = body.match(/^<p><strong>(Watch out|Not available yet)\.?<\/strong>\s*/))) {
        kind = m[1] === 'Watch out' ? 'warning' : 'notbuilt';
        title = m[1];
        body = body.replace(m[0], '<p>');
      }
      body = body.replace(/^<p>\s*<\/p>\s*/, '');
      if (!kind) return `<blockquote>\n${body}</blockquote>\n`;
      return `<aside class="callout callout-${kind}"><p class="callout-title">${ICONS[kind]}<span>${title}</span></p><div class="callout-body">\n${body}</div></aside>\n`;
    },
  },
});

// ---------------------------------------------------------------- documents
const docs = {};
const order = [];

for (const file of files) {
  const slug = file.slice(0, -3);
  const src = fs.readFileSync(path.join(contentDir, file), 'utf8');
  cur = { slug, ids: new Set(), toc: [], links: [] };

  const tokens = marked.lexer(src);
  let title = slug, lede = '';
  const i = tokens.findIndex((t) => t.type === 'heading' && t.depth === 1);
  if (i >= 0) {
    title = plainText(tokens[i].tokens);
    tokens.splice(i, 1);
    while (tokens[i] && tokens[i].type === 'space') tokens.splice(i, 1);
    if (tokens[i] && tokens[i].type === 'paragraph') {
      lede = marked.parser([tokens[i]]).trim().replace(/^<p>/, '').replace(/<\/p>$/, '');
      tokens.splice(i, 1);
    }
  } else {
    warn(`${file}: no "# Title" heading found, using the file name`);
  }

  let html = marked.parser(tokens);
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');

  const num = (slug.match(/^(\d+)-/) || [])[1] || '';
  docs[slug] = { slug, num, title, lede, html, toc: cur.toc, _ids: cur.ids, _links: cur.links };
  order.push(slug);
}

// Check that every "#anchor" link points at a real heading.
for (const d of Object.values(docs)) {
  for (const l of d._links) {
    if (l.anchor && !docs[l.slug]._ids.has(l.anchor)) {
      warn(`${d.slug}: link "${l.href}" points at a heading id that does not exist in ${l.slug}`);
    }
  }
}

// ---------------------------------------------------------------- navigation
// Groups come from the "## The articles" section of the start page.
function parseGroups(src) {
  const groups = [];
  let g = null, inArticles = false;
  for (const line of src.split('\n')) {
    if (/^## /.test(line)) { inArticles = /^## The articles/i.test(line); continue; }
    if (!inArticles) continue;
    if (/^### /.test(line)) { g = { title: line.replace(/^### /, '').trim(), docs: [] }; groups.push(g); continue; }
    const m = line.match(/\]\(([A-Za-z0-9._-]+)\.md\)/);
    if (m && g && docSlugs.has(m[1]) && !g.docs.includes(m[1])) g.docs.push(m[1]);
  }
  return groups.filter((x) => x.docs.length);
}

const startFile = files.find((f) => /start-here/.test(f)) || files[0];
const groups = parseGroups(fs.readFileSync(path.join(contentDir, startFile), 'utf8'));
const grouped = new Set(groups.flatMap((g) => g.docs));
const firstGrouped = order.findIndex((s) => grouped.has(s));
const lead = order.filter((s, i) => !grouped.has(s) && (firstGrouped < 0 || i < firstGrouped));
const trail = order.filter((s, i) => !grouped.has(s) && firstGrouped >= 0 && i > firstGrouped);
const nav = [];
if (lead.length) nav.push({ title: null, docs: lead });
nav.push(...groups);
if (trail.length) nav.push({ title: 'More', docs: trail });

// ---------------------------------------------------------------- assemble
const data = {
  title: SITE_TITLE,
  built: new Date().toISOString().slice(0, 10),
  order,
  nav,
  docs: Object.fromEntries(order.map((s) => {
    const { _ids, _links, ...rest } = docs[s];
    return [s, rest];
  })),
};

const css = fs.readFileSync(path.join(here, 'app.css'), 'utf8');
const js = fs.readFileSync(path.join(here, 'app.js'), 'utf8');
const json = JSON.stringify(data).replace(/<\//g, '<\\/');

const favicon = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#3b5bdb"/><path d="M9 9h9a4 4 0 0 1 0 8H9zM9 17h10a4 4 0 0 1 0 8H9z" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>'
);

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(SITE_TITLE)}</title>
<link rel="icon" href="${favicon}">
<script>(function(){try{var t=localStorage.getItem('buildos-guide-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
<style>
${css}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="Open navigation" aria-controls="nav" aria-expanded="false">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
  </button>
  <a class="brand" href="#/${order[0]}">
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#3b5bdb"/><path d="M9 9h9a4 4 0 0 1 0 8H9zM9 17h10a4 4 0 0 1 0 8H9z" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>
    <span>${escapeHtml(SITE_TITLE)}</span>
  </a>
  <div class="search" id="search">
    <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="search-input" type="search" placeholder="Search the guide" autocomplete="off" spellcheck="false" aria-label="Search the guide" aria-controls="search-results" aria-expanded="false">
    <kbd class="kbd" aria-hidden="true">/</kbd>
    <div class="search-results" id="search-results" role="listbox"></div>
  </div>
  <button class="icon-btn theme-btn" id="theme-btn" type="button" aria-label="Change theme"></button>
</header>
<div class="layout">
  <nav class="sidebar" id="nav" aria-label="Guide sections"></nav>
  <main id="main" class="content" tabindex="-1">
    <article id="article"></article>
  </main>
  <aside class="toc" id="toc" aria-label="On this page"></aside>
</div>
<div class="scrim" id="scrim"></div>
<script id="docs-data" type="application/json">${json}</script>
<script>
${js}
</script>
</body>
</html>
`;

fs.writeFileSync(outFile, page);

const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
console.log(`Wrote ${path.relative(process.cwd(), outFile) || outFile} (${kb} KB) from ${order.length} documents.`);
for (const w of warnings) console.log(`  warning: ${w}`);
