/** Shared shapes for the generated docs index (see scripts/build-index.mjs) and the tool layer. */

export type Product = 'libraries' | 'sdk' | 'parity';
export type Lang = 'python' | 'ts';

export interface DocPage {
  slug: string;
  product: Product;
  route: string; // '/docs', '/docs/sdk', or '' (parity → GitHub)
  url: string; // canonical URL
  title: string;
  body: string; // full markdown, H1 stripped
  headings: string[]; // H2/H3 texts
}

export interface DocChunk {
  id: string;
  pageSlug: string;
  product: Product;
  url: string;
  title: string; // "core — Quickstart"
  heading: string;
  text: string;
}

export interface TrapRow {
  task: string;
  python: string; // correct Python call-shape (markdown)
  typescript: string; // correct TypeScript call-shape (markdown)
  trap: string; // the gotcha
  symbols: string[]; // lowercased identifiers, for matching
}

export interface Example {
  title: string;
  slug: string;
  python: string; // code
  typescript: string; // code
  keywords: string[];
}

export interface VersionRow {
  name: string;
  pypi: string;
  pypiVer: string;
  npm: string; // short npm name (e.g. 'core') or ''
  npmVer: string;
  // Cendor Monitor is an IMAGE, not a PyPI/npm package. Its devtooling row leaves pypi/npm empty
  // and carries these instead (additive/optional — package rows omit them). See SC-D10.
  image?: string; // e.g. 'ghcr.io/cendorhq/cendor-monitor'
  tag?: string; // e.g. '0.3.0'
}

export interface Versions {
  libraries: VersionRow[];
  sdk: VersionRow[];
  devtooling: VersionRow[]; // @cendor/mcp · @cendor/init · the monitor image (own release cadence)
  asOf: string;
  source: string;
}

/**
 * The cookbook link-out index. It is TWO repos since 2026-07-31 — Python in `cendor-cookbook`,
 * TypeScript in `cendor-cookbook-js` — and a recipe folder name means the same thing in both.
 * `categories` is the merged, deduped list; `repos` says which tree each name came from. `github`
 * stays the Python repo so an older client reading only that field still gets a working link.
 */
export interface RecipeIndex {
  url: string;
  github: string;
  githubTypescript?: string;
  categories: string[];
  repos?: {
    python: { github: string; categories: string[] };
    typescript: { github: string; categories: string[] };
  };
}

export interface DocIndex {
  meta: {
    site: string;
    generatedNote: string;
    builtFrom: string[];
    pageCount: number;
    chunkCount: number;
    trapCount: number;
    exampleCount: number;
  };
  pages: DocPage[];
  chunks: DocChunk[];
  traps: TrapRow[];
  examples: Example[];
  recipes: RecipeIndex;
  versions: Versions;
}

/** A single MCP tool: JSON-Schema input + a pure handler returning MCP text content. */
export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (args: Record<string, unknown>) => string;
}
