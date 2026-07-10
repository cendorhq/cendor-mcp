#!/usr/bin/env node
/**
 * Build the read-only docs search index that the MCP server serves.
 *
 * SOURCE OF TRUTH = the LIBRARY repos (never copied into this repo). We read the SAME sibling
 * checkouts the cendor-site content collection reads (DOCS_PATH / SDK_DOCS_PATH), applying the SAME
 * `specs/**` exclusion, plus the TypeScript parity doc from cendor-libs-js. From that markdown we
 * derive:
 *   - pages       — one per docs .md, with canonical https://cendor.ai URL + H2/H3 headings
 *   - chunks      — per-section splits for search_docs()
 *   - traps       — the call-shape trap table from docs/for-ai-assistants.md (the get_api() source)
 *   - examples    — the canonical Python/TS snippets from the same page (the example() source)
 *   - recipes     — a link-out index of the cookbook (recipes stay in cendor-cookbook)
 *   - versions    — the published versions from the site /releases source of truth (never teach a
 *                   shape newer than what's on PyPI/npm)
 *
 * Outputs (all GITIGNORED — generated, never committed):
 *   - data/index.json                                (canonical artifact / debug)
 *   - src/generated/index.ts                         (bundled into the npm package + Cloudflare Worker)
 *   - python/src/cendor_mcp/_data/index.json         (bundled into the uvx twin's wheel)
 *
 * Run: `pnpm build:index` (invoked by `pnpm build`). In CI/cloud, `node scripts/fetch-docs.mjs`
 * sparse-clones the sibling docs first (see fetch-docs.mjs), so the same generator runs there.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://cendor.ai';

// Mirror cendor-site content.config.ts: libs docs → /docs/<slug> (index → /docs); sdk docs →
// /docs/sdk/<slug> (index → /docs/sdk). `specs/**` is excluded, same as the site.
const SOURCES = [
  {
    dir: process.env.DOCS_PATH || '../cendor-libs/docs',
    route: '/docs',
    product: 'libraries',
    label: 'Libraries',
  },
  {
    dir: process.env.SDK_DOCS_PATH || '../cendor-sdk/docs',
    route: '/docs/sdk',
    product: 'sdk',
    label: 'SDK',
  },
];

// The TypeScript parity matrix lives in the JS repo and has no cendor.ai route — link it to GitHub.
const PARITY = {
  file: process.env.JS_DOCS_PATH || '../cendor-libs-js/docs',
  name: 'parity.md',
  url: 'https://github.com/cendorhq/cendor-libs-js/blob/main/docs/parity.md',
  product: 'parity',
};

const COOKBOOK_DIR = process.env.COOKBOOK_PATH || '../cendor-cookbook/recipes';

// ---------- markdown helpers (shared shape with cendor-site/scripts/gen-llms-full.mjs) ----------

/** Flat *.md files at the docs root, excluding the specs/ subtree. Deterministic order. */
function docFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) continue; // specs/** and any nested dir are not flat pages
    if (!name.endsWith('.md')) continue;
    if (name === 'README.md') continue;
    out.push(full);
  }
  // index first (the section landing page), then the rest alphabetically — stable across builds.
  return out.sort((a, b) => {
    const ai = basename(a) === 'index.md' ? 0 : 1;
    const bi = basename(b) === 'index.md' ? 0 : 1;
    return ai - bi || basename(a).localeCompare(basename(b));
  });
}

/** First markdown H1 → the page title; strip it from the body. */
function titleAndBody(md, slug) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const i = lines.findIndex((l) => /^#\s+\S/.test(l));
  if (i === -1) return { title: slug, body: md.trim() };
  const title = lines[i].replace(/^#\s+/, '').trim();
  const body = [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n').trim();
  return { title, body };
}

/** H2/H3 heading texts (skip fenced code so a commented "## x" inside a block isn't a heading). */
function headings(body) {
  const out = [];
  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^```/.test(line.trim())) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^(#{2,3})\s+(.*)$/);
    if (m) out.push(m[2].trim());
  }
  return out;
}

/** Split a page body into { heading, text } sections on top-level (##) headings. */
function sections(body) {
  const lines = body.split('\n');
  const out = [];
  let cur = { heading: '', lines: [] };
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line.trim())) inFence = !inFence;
    const m = !inFence && line.match(/^##\s+(.*)$/);
    if (m) {
      if (cur.heading || cur.lines.join('').trim()) out.push(cur);
      cur = { heading: m[1].trim(), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  if (cur.heading || cur.lines.join('').trim()) out.push(cur);
  return out
    .map((s) => ({ heading: s.heading, text: s.lines.join('\n').trim() }))
    .filter((s) => s.text.length > 0);
}

// ---------- trap table + canonical examples (from for-ai-assistants.md) ----------

/** Split a markdown table row on UNescaped pipes (cells contain literal `\|` inside code spans). */
function splitRow(line) {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

/** Identifier-ish tokens found inside `code spans` — the searchable symbols for a trap row. */
function extractSymbols(text) {
  const set = new Set();
  for (const span of text.match(/`[^`]+`/g) || []) {
    const inner = span.slice(1, -1);
    for (const tok of inner.match(/[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?/g) || []) {
      const t = tok.toLowerCase();
      if (t.length > 1) set.add(t);
    }
  }
  return [...set];
}

function parseTraps(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^\|\s*Task\s*\|/.test(l));
  if (start === -1) return [];
  const rows = [];
  for (let i = start + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) break;
    const cells = splitRow(line);
    if (cells.length < 4) continue;
    const [task, python, typescript, trap] = cells;
    rows.push({
      task,
      python,
      typescript,
      trap,
      symbols: extractSymbols(`${python} ${typescript}`),
    });
  }
  return rows;
}

const kebab = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const STOP = new Set(['the', 'and', 'a', 'an', 'to', 'it', 'of', 'in', 'for', 'once', 'within']);

// Hand-tuned task synonyms per example slug so example("budget a loop") resolves well.
const EXAMPLE_SYNONYMS = {
  'instrument-once': ['instrument', 'wrap', 'client', 'core'],
  'count-tokens-and-estimate-cost-offline': ['tokens', 'count', 'price', 'estimate', 'cost'],
  'cap-spend-and-attribute-it': [
    'budget',
    'spend',
    'cost',
    'cap',
    'track',
    'report',
    'limit',
    'loop',
    'tokenguard',
  ],
  'assemble-context-within-a-budget': [
    'context',
    'assemble',
    'contextkit',
    'prompt',
    'fit',
    'window',
  ],
  'gate-unsafe-input-and-output': [
    'guardrails',
    'gate',
    'block',
    'redact',
    'safety',
    'input',
    'output',
    'unsafe',
  ],
  'make-runs-testable-and-audited': [
    'cassette',
    'record',
    'replay',
    'test',
    'audit',
    'acttrace',
    'evidence',
  ],
};

function matchFence(text, lang) {
  const m = text.match(new RegExp(`\`\`\`${lang}\\n([\\s\\S]*?)\`\`\``));
  return m ? m[1].replace(/\n+$/, '') : '';
}

function parseExamples(md) {
  const at = md.indexOf('\n## Canonical examples');
  if (at === -1) return [];
  let sec = md.slice(at + 1);
  const nextH2 = sec.indexOf('\n## ', 3);
  if (nextH2 !== -1) sec = sec.slice(0, nextH2);
  const out = [];
  for (const part of sec.split(/\n### /).slice(1)) {
    const title = part.split('\n')[0].trim();
    const python = matchFence(part, 'python');
    const typescript = matchFence(part, 'ts');
    if (!python && !typescript) continue;
    const slug = kebab(title);
    const titleWords = title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOP.has(w));
    out.push({
      title,
      slug,
      python,
      typescript,
      keywords: [...new Set([...titleWords, ...(EXAMPLE_SYNONYMS[slug] || [])])],
    });
  }
  return out;
}

// ---------- versions (from the site /releases source of truth, with a committed fallback) ----------

function parseReleasesAstro(src) {
  const arr = (name) => {
    const m = src.match(new RegExp(`const ${name}:\\s*Row\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\];`));
    if (!m) return [];
    const rows = [];
    const re =
      /name:\s*'([^']+)'[^\n]*?pypi:\s*'([^']*)'[^\n]*?pypiVer:\s*'([^']*)'[^\n]*?npm:\s*'([^']*)'[^\n]*?npmVer:\s*'([^']*)'/g;
    for (let r = re.exec(m[1]); r !== null; r = re.exec(m[1])) {
      rows.push({ name: r[1], pypi: r[2], pypiVer: r[3], npm: r[4], npmVer: r[5] });
    }
    return rows;
  };
  return { libraries: arr('libraries'), sdk: arr('sdk') };
}

function loadVersions() {
  const astro = resolve(ROOT, '../cendor-site/src/pages/releases.astro');
  if (existsSync(astro)) {
    const parsed = parseReleasesAstro(readFileSync(astro, 'utf8'));
    if (parsed.libraries.length) {
      const dateMatch = readFileSync(astro, 'utf8').match(/as of the (\d{4}-\d{2}-\d{2})/);
      console.log('[build-index] versions ← cendor-site/src/pages/releases.astro (live SoT)');
      return { ...parsed, asOf: dateMatch ? dateMatch[1] : '', source: 'releases.astro' };
    }
  }
  const fallback = JSON.parse(readFileSync(join(ROOT, 'data', 'versions.json'), 'utf8'));
  console.log('[build-index] versions ← data/versions.json (committed fallback)');
  return {
    libraries: fallback.libraries,
    sdk: fallback.sdk,
    asOf: fallback.asOf || '',
    source: 'versions.json',
  };
}

// ---------- cookbook (link-out index only; recipes stay in cendor-cookbook) ----------

function loadRecipes() {
  const dir = resolve(ROOT, COOKBOOK_DIR);
  let categories = [];
  if (existsSync(dir)) {
    categories = readdirSync(dir)
      .filter((n) => statSync(join(dir, n)).isDirectory())
      .sort();
  }
  return {
    url: `${SITE}/cookbook/`,
    github: 'https://github.com/cendorhq/cendor-cookbook',
    categories,
  };
}

// ---------- build ----------

function build() {
  const pages = [];
  const chunks = [];
  let traps = [];
  let examples = [];

  for (const { dir, route, product, label } of SOURCES) {
    const abs = resolve(ROOT, dir);
    if (!existsSync(abs)) {
      console.warn(
        `[build-index] ${dir} not found — skipping ${label}. (run scripts/fetch-docs.mjs)`,
      );
      continue;
    }
    for (const file of docFiles(abs)) {
      const slug = basename(file, '.md');
      const url = slug === 'index' ? `${SITE}${route}` : `${SITE}${route}/${slug}`;
      const md = readFileSync(file, 'utf8');
      const { title, body } = titleAndBody(md, slug);
      pages.push({ slug, product, route, url, title, body, headings: headings(body) });
      for (const s of sections(body)) {
        chunks.push({
          id: `${product}:${slug}#${kebab(s.heading) || 'intro'}`,
          pageSlug: slug,
          product,
          url,
          title: s.heading ? `${title} — ${s.heading}` : title,
          heading: s.heading,
          text: s.text,
        });
      }
      // The trap registry + canonical examples live on for-ai-assistants.md (libraries product).
      if (product === 'libraries' && slug === 'for-ai-assistants') {
        traps = parseTraps(md);
        examples = parseExamples(md);
      }
    }
  }

  // TypeScript parity doc (cendor-libs-js/docs/parity.md → GitHub, no site route).
  const parityFile = resolve(ROOT, PARITY.file, PARITY.name);
  if (existsSync(parityFile)) {
    const md = readFileSync(parityFile, 'utf8');
    const { title, body } = titleAndBody(md, 'parity');
    pages.push({
      slug: 'parity',
      product: PARITY.product,
      route: '',
      url: PARITY.url,
      title: `${title} (TypeScript parity)`,
      body,
      headings: headings(body),
    });
    for (const s of sections(body)) {
      chunks.push({
        id: `parity:parity#${kebab(s.heading) || 'intro'}`,
        pageSlug: 'parity',
        product: PARITY.product,
        url: PARITY.url,
        title: s.heading ? `${title} — ${s.heading}` : title,
        heading: s.heading,
        text: s.text,
      });
    }
  } else {
    console.warn(`[build-index] ${PARITY.file}/${PARITY.name} not found — parity doc skipped.`);
  }

  const index = {
    meta: {
      site: SITE,
      generatedNote:
        'Generated by cendor-mcp/scripts/build-index.mjs from the docs source of truth (cendor-libs, cendor-sdk, cendor-libs-js). Docs are never copied into this repo. Do not hand-edit.',
      builtFrom: SOURCES.map((s) => s.dir).concat(`${PARITY.file}/${PARITY.name}`),
      pageCount: pages.length,
      chunkCount: chunks.length,
      trapCount: traps.length,
      exampleCount: examples.length,
    },
    pages,
    chunks,
    traps,
    examples,
    recipes: loadRecipes(),
    versions: loadVersions(),
  };
  return index;
}

const index = build();

// data/index.json — canonical artifact (gitignored).
const dataDir = join(ROOT, 'data');
mkdirSync(dataDir, { recursive: true });
writeFileSync(join(dataDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);

// src/generated/index.ts — bundled into the npm package + the Cloudflare Worker (gitignored).
// A JSON.parse of an escaped string literal loads faster than a giant object literal and sidesteps
// NodeNext JSON-import-attribute friction across tsc / esbuild / the Workers runtime.
const genDir = join(ROOT, 'src', 'generated');
mkdirSync(genDir, { recursive: true });
const ts = `// AUTO-GENERATED by scripts/build-index.mjs — DO NOT EDIT. Gitignored.\n// Built from the sibling docs source of truth (cendor-libs, cendor-sdk, cendor-libs-js).\n// Regenerate with \`pnpm build:index\`.\nimport type { DocIndex } from '../types.js';\n\nexport const INDEX: DocIndex = JSON.parse(${JSON.stringify(JSON.stringify(index))});\n`;
writeFileSync(join(genDir, 'index.ts'), ts);

// python/src/cendor_mcp/_data/index.json — bundled into the uvx twin's wheel (gitignored).
const pyDataDir = join(ROOT, 'python', 'src', 'cendor_mcp', '_data');
if (existsSync(dirname(pyDataDir))) {
  mkdirSync(pyDataDir, { recursive: true });
  writeFileSync(join(pyDataDir, 'index.json'), `${JSON.stringify(index)}\n`);
}

console.log(
  `[build-index] wrote index: ${index.meta.pageCount} pages, ${index.meta.chunkCount} chunks, ` +
    `${index.meta.trapCount} traps, ${index.meta.exampleCount} examples ` +
    `(versions asOf ${index.versions.asOf || '?'} via ${index.versions.source}).`,
);
