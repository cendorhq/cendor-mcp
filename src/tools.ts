import { searchDocs } from './search.js';
import type { DocIndex, Example, Lang, ToolDef, TrapRow } from './types.js';

// ---------- shared helpers ----------

/** Normalize a `lang` arg. Returns undefined when unspecified → callers show both languages. */
function normLang(x: unknown): Lang | undefined {
  if (x == null || x === '') return undefined;
  const s = String(x).toLowerCase();
  if (s.startsWith('py')) return 'python';
  if (s.startsWith('ts') || s.startsWith('type') || s.startsWith('js') || s.startsWith('java'))
    return 'ts';
  return undefined;
}

function versionFooter(index: DocIndex): string {
  const v = index.versions;
  return `\n---\nCall-shapes are verified against the current published release${v.asOf ? ` (as of ${v.asOf})` : ''}. Exact per-package versions (PyPI \`cendor-*\` / npm \`@cendor/*\`): ${index.meta.site}/releases · Full trap table & examples: ${index.meta.site}/docs/for-ai-assistants`;
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- trap matching (get_api) ----------

function scoreTrap(row: TrapRow, symbol: string): number {
  const q = symbol.toLowerCase();
  const qc = norm(symbol);
  let score = 0;
  for (const sym of row.symbols) {
    if (sym === q) score = Math.max(score, 100);
    else if (norm(sym) === qc) score = Math.max(score, 90);
    else if (sym.includes(q) || q.includes(sym)) score = Math.max(score, 60);
    else if (norm(sym).includes(qc) && qc.length >= 3) score = Math.max(score, 40);
  }
  if (score === 0) {
    // fall back to matching the human task description
    const task = norm(row.task);
    if (task.includes(qc) && qc.length >= 3) score = 20;
  }
  return score;
}

function exampleFor(index: DocIndex, symbol: string): Example | undefined {
  const qc = norm(symbol);
  return index.examples.find((e) => e.keywords.some((k) => norm(k) === qc || norm(k).includes(qc)));
}

function renderTrap(index: DocIndex, row: TrapRow, lang: Lang | undefined): string {
  const out: string[] = [`### ${row.task}`];
  if (!lang || lang === 'python') out.push(`- **Python** — ${row.python}`);
  if (!lang || lang === 'ts') out.push(`- **TypeScript** — ${row.typescript}`);
  out.push(`- **Trap** — ${row.trap}`);
  return out.join('\n');
}

// ---------- example matching (example) ----------

function scoreExample(ex: Example, task: string): number {
  const terms = task
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
  let score = 0;
  const hay = `${ex.title} ${ex.keywords.join(' ')}`.toLowerCase();
  for (const t of terms) {
    if (ex.keywords.some((k) => k.toLowerCase() === t)) score += 5;
    else if (hay.includes(t)) score += 2;
  }
  return score;
}

function renderExample(ex: Example, lang: Lang | undefined): string {
  const out: string[] = [`### ${ex.title}`];
  if ((!lang || lang === 'python') && ex.python) out.push(`\`\`\`python\n${ex.python}\n\`\`\``);
  if ((!lang || lang === 'ts') && ex.typescript) out.push(`\`\`\`ts\n${ex.typescript}\n\`\`\``);
  return out.join('\n\n');
}

// ---------- get_page ----------

function findPage(index: DocIndex, rawSlug: string) {
  let slug = rawSlug
    .trim()
    .replace(/^\/?docs\//, '')
    .replace(/^\//, '')
    .replace(/\/$/, '');
  let productHint: string | undefined;
  const m = slug.match(/^(libraries|libs|sdk|parity)[:/](.+)$/);
  if (m) {
    productHint = m[1] === 'libs' ? 'libraries' : m[1];
    slug = m[2] ?? slug;
  }
  if (slug === '' || slug === 'docs') slug = 'index';
  const matches = index.pages.filter(
    (p) => p.slug === slug && (!productHint || p.product === productHint),
  );
  return { slug, matches };
}

// ---------- the tool registry ----------

export function buildTools(index: DocIndex): ToolDef[] {
  return [
    {
      name: 'search_docs',
      title: 'Search Cendor docs',
      description:
        'Full-text search over the Cendor documentation (the seven libraries, the SDK, and the ' +
        'TypeScript parity matrix). Returns the top matching sections with their titles and ' +
        'canonical https://cendor.ai URLs. Use this to discover which library/API to reach for.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural-language or keyword query.' },
          limit: {
            type: 'number',
            description: 'Max results (default 6, max 15).',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: (args) => {
        const query = String(args.query ?? '').trim();
        if (!query) return 'Provide a non-empty `query`.';
        const limit = Math.max(1, Math.min(15, Number(args.limit) || 6));
        const hits = searchDocs(index, query, limit);
        if (hits.length === 0)
          return `No matches for "${query}". Try broader terms (e.g. a library name: tokenguard, guardrails, cassette).`;
        const body = hits
          .map((h) => `- **${h.title}** _(${h.product})_\n  ${h.url}\n  ${h.snippet}`)
          .join('\n');
        return `Top ${hits.length} matches for "${query}":\n\n${body}${versionFooter(index)}`;
      },
    },
    {
      name: 'get_page',
      title: 'Get a Cendor docs page',
      description:
        'Return a full Cendor documentation page as markdown, given its slug (e.g. "tokenguard", ' +
        '"getting-started", or an SDK page as "sdk/agents"). Slugs that exist in both the libraries ' +
        'and SDK docs default to the libraries page; prefix with "sdk/" for the SDK version.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'Page slug, e.g. "core", "for-ai-assistants", "sdk/agents", "parity".',
          },
        },
        required: ['slug'],
        additionalProperties: false,
      },
      handler: (args) => {
        const raw = String(args.slug ?? '').trim();
        if (!raw)
          return 'Provide a `slug` (try `search_docs` first, or "index" for the docs home).';
        const { slug, matches } = findPage(index, raw);
        if (matches.length === 0) {
          const known = index.pages
            .map((p) => (p.product === 'sdk' ? `sdk/${p.slug}` : p.slug))
            .join(', ');
          return `No page "${slug}". Known slugs: ${known}.`;
        }
        // Prefer libraries when a slug exists in both products; mention the alternative.
        const page = matches.find((p) => p.product === 'libraries') ?? matches[0];
        if (!page) return `No page "${slug}".`;
        const others = matches.filter((p) => p !== page).map((p) => `${p.product}/${p.slug}`);
        const alt = others.length ? `\n\n> Also available: ${others.join(', ')}` : '';
        const src = page.url ? `Source: ${page.url}\n\n` : '';
        return `# ${page.title}\n${src}${page.body}${alt}`;
      },
    },
    {
      name: 'get_api',
      title: 'Get the correct Cendor call-shape',
      description:
        'The anti-hallucination tool. Given a Cendor symbol (e.g. "budget", "prices.estimate", ' +
        '"instrument", "SqliteSessionStore", "keyword_deny") return its CURRENT correct call-shape ' +
        'and the common wrong shape to avoid, from the maintained trap registry. Optionally scope ' +
        'to a language ("python" or "ts"); omit to get both.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'A Cendor API symbol, e.g. "budget", "prices.estimate", "instrument".',
          },
          lang: {
            type: 'string',
            enum: ['python', 'ts'],
            description: 'Optional language filter. Omit to show both.',
          },
        },
        required: ['symbol'],
        additionalProperties: false,
      },
      handler: (args) => {
        const symbol = String(args.symbol ?? '').trim();
        if (!symbol) return 'Provide a `symbol`, e.g. "budget" or "prices.estimate".';
        const lang = normLang(args.lang);
        const ranked = index.traps
          .map((row) => ({ row, score: scoreTrap(row, symbol) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score);
        if (ranked.length === 0) {
          return (
            `No trap-table entry matches "${symbol}". Try \`search_docs("${symbol}")\`, or one of ` +
            `these tasks with \`get_api\`/\`example\`: ${index.traps.map((t) => t.task).join('; ')}.`
          );
        }
        const top = ranked[0];
        if (!top) return `No match for "${symbol}".`;
        const parts: string[] = [renderTrap(index, top.row, lang)];
        // If the top match is confident, offer a runnable canonical example when one fits.
        if (top.score >= 60) {
          const ex = exampleFor(index, symbol);
          if (ex)
            parts.push(`\n**Canonical example — ${ex.title}:**\n\n${renderExample(ex, lang)}`);
        }
        // Surface near-matches so an ambiguous symbol still points somewhere useful.
        const more = ranked.slice(1, 4).filter((r) => r.score >= 40);
        if (more.length) parts.push(`\n_Related:_ ${more.map((r) => r.row.task).join('; ')}.`);
        return `${parts.join('\n')}${versionFooter(index)}`;
      },
    },
    {
      name: 'example',
      title: 'Get a runnable Cendor snippet',
      description:
        'Return a runnable, CI-typechecked Cendor snippet for a task ("budget a loop", "gate ' +
        'input", "assemble context", "record a test", "count tokens", "instrument a client"). ' +
        'Optionally scope to a language ("python" or "ts"); omit to get both.',
      inputSchema: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'What you want to do, in plain words.' },
          lang: {
            type: 'string',
            enum: ['python', 'ts'],
            description: 'Optional language filter. Omit to show both.',
          },
        },
        required: ['task'],
        additionalProperties: false,
      },
      handler: (args) => {
        const task = String(args.task ?? '').trim();
        if (!task) return 'Provide a `task`, e.g. "budget a loop" or "gate unsafe input".';
        const lang = normLang(args.lang);
        const ranked = index.examples
          .map((ex) => ({ ex, score: scoreExample(ex, task) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score);
        const best = ranked[0];
        if (!best) {
          return (
            `No canonical example matches "${task}". Available: ` +
            `${index.examples.map((e) => e.title).join('; ')}.`
          );
        }
        const others = ranked.slice(1, 4).map((r) => r.ex.title);
        const alt = others.length ? `\n\n_Other examples:_ ${others.join('; ')}.` : '';
        return `${renderExample(best.ex, lang)}${alt}${versionFooter(index)}`;
      },
    },
    {
      name: 'list_recipes',
      title: 'List Cendor cookbook recipes',
      description:
        'Link out to the Cendor cookbook — copy-paste recipes that run offline (recorded with ' +
        'cassette, no API key). Recipes live in the cendor-cookbook repo; this returns the index ' +
        'and the recipe categories.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: () => {
        const r = index.recipes;
        const cats = r.categories.length ? `\n\nCategories: ${r.categories.join(', ')}.` : '';
        return `Cendor cookbook — copy-paste recipes, offline (cassette-recorded, no API key):\n- Browse: ${r.url}\n- Source: ${r.github}${cats}`;
      },
    },
  ];
}
