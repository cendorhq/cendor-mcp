<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/cendor-mcp-banner-dark.png">
    <img alt="cendor-mcp" src=".github/assets/cendor-mcp-banner-light.png" width="820">
  </picture>
</p>

<!-- The header block is centred as one unit, to line up with the banner above. That means HTML, not
     markdown: GitHub does not process markdown inside an HTML block, so `**bold**` and `[a](b)` would
     render literally inside a <p align="center">. Verified against the GitHub markdown API. -->

<p align="center">
  <strong>A read-only MCP docs server — correct Cendor call-shapes for your AI assistant, not a plausible guess.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cendor/mcp"><img alt="npm version" src="https://img.shields.io/npm/v/@cendor/mcp.svg"></a>
  <a href="https://pypi.org/project/cendor-mcp/"><img alt="PyPI version" src="https://img.shields.io/pypi/v/cendor-mcp.svg"></a>
  <a href="https://github.com/cendorhq/cendor-mcp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/cendorhq/cendor-mcp/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://opensource.org/licenses/Apache-2.0"><img alt="License: Apache 2.0" src="https://img.shields.io/badge/License-Apache_2.0-blue.svg"></a>
</p>

<!-- cendor:downloads:start — self-hosted badges from cendor.ai (no third party in the render path).
     The numbers live inside the SVGs, regenerated daily from the committed ledger, so this file
     never goes stale. PyPI excludes index mirrors; npm publishes no mirror filter, which is why the
     two are shown separately and never summed. Method: https://cendor.ai/downloads -->
<p align="center">
  <a href="https://cendor.ai/downloads"><img alt="cendor-mcp downloads" src="https://cendor.ai/badge/downloads/cendor-mcp.svg"></a>
  <a href="https://cendor.ai/downloads"><img alt="all Cendor · PyPI" src="https://cendor.ai/badge/downloads/pypi.svg"></a>
  <a href="https://cendor.ai/downloads"><img alt="all Cendor · npm" src="https://cendor.ai/badge/downloads/npm.svg"></a>
</p>
<!-- cendor:downloads:end -->

**A read-only [Model Context Protocol](https://modelcontextprotocol.io) server that hands your
AI coding assistant Cendor's live docs and correct call-shapes.** Connect it once and, in agent
mode, your assistant can look up the right way to call Cendor instead of guessing — Cendor is new,
and a few of its shapes are non-obvious (`budget(cfg)(fn)` is curried in TypeScript; `prices.estimate`
is positional in Python; the SQLite session store is spelled differently in each language).

- **Local** — `npx @cendor/mcp` (Node, stdio) or `uvx cendor-mcp` (Python, stdio). Fully offline;
  the docs are bundled. Nothing leaves your machine — only the tool arguments your assistant sends.
- **Remote** — a Cloudflare Worker at `https://mcp.cendor.ai` (Streamable HTTP). Zero-install; always
  current.

It is **pull-based and read-only**: your assistant calls a tool, the server answers, your assistant
writes the code. The server never pushes into your editor and your codebase never flows to us. No
`sampling`/`elicitation` (server→client) calls.

> **The libraries need no server.** Cendor is local-first — this MCP server is optional developer
> tooling for wiring an assistant up. No Cendor library requires it (or any server) at runtime.

## What it exposes (five read-only tools)

| Tool | What it does |
|---|---|
| `search_docs(query, limit?)` | Full-text search over the docs → matching sections with `cendor.ai` URLs. |
| `get_page(slug)` | A full docs page as markdown (`"tokenguard"`, `"getting-started"`, `"sdk/agents"`, `"monitor"`, …). |
| `get_api(symbol, lang?)` | **The anti-hallucination tool** — the current correct call-shape + the common wrong one, for a symbol. `lang` is `"python"` or `"ts"` (`py` / `js` aliased); omit for both. |
| `example(task, lang?)` | A runnable, CI-typechecked snippet for a task (`"budget a loop"`, `"gate input"`, …). Same `lang` values as `get_api`. |
| `list_recipes()` | The cookbook index, grouped by category (recipes live in `cendor-cookbook`). |

Answers are stamped with the current published package versions, so the server never teaches a shape
newer than what's on PyPI/npm. They come from the org-wide version single source,
`cendor-site/src/data/versions.json` — read as JSON at build from that sibling checkout, published
publicly as [`/releases.json`](https://cendor.ai/releases.json) (and rendered for humans at
[`/releases`](https://cendor.ai/releases)), with a generated committed fallback at
[`data/versions.json`](data/versions.json) for builds with no site sibling.

## Connect your assistant

Full walkthrough (all four assistants, remote + local, screenshots): **<https://cendor.ai/mcp>**.

> **Honest limit — agent mode only.** MCP tools are called by *agent* modes (Claude Code, Cursor
> Composer/agent, Copilot agent, Windsurf Cascade). Inline autocomplete does **not** call MCP — for
> that path, Cendor ships types + `@example`s inside every package ("Type Teach"); see
> [`/docs/for-ai-assistants`](https://cendor.ai/docs/for-ai-assistants).

**Claude Code**

```bash
# remote (recommended — always current)
claude mcp add --transport http cendor https://mcp.cendor.ai
# or local, offline
claude mcp add cendor -- npx -y @cendor/mcp
```

**Cursor** → `.cursor/mcp.json`

```json
{ "mcpServers": { "cendor": { "url": "https://mcp.cendor.ai" } } }
```

**GitHub Copilot (agent mode, VS Code)** → `.vscode/mcp.json`

```json
{ "servers": { "cendor": { "type": "http", "url": "https://mcp.cendor.ai" } } }
```

**Windsurf** → `~/.codeium/windsurf/mcp_config.json`

```json
{ "mcpServers": { "cendor": { "serverUrl": "https://mcp.cendor.ai" } } }
```

**Local / offline** (any client) — swap the remote URL for a stdio command:

```json
{ "mcpServers": { "cendor": { "command": "npx", "args": ["-y", "@cendor/mcp"] } } }
```

```json
{ "mcpServers": { "cendor": { "command": "uvx", "args": ["cendor-mcp"] } } }
```

## How it's built (docs are never copied here)

The server's content is **built from the docs source of truth** — the sibling library repos, exactly
like [cendor.ai](https://cendor.ai) itself does:

- `../cendor-libs/docs` (the seven libraries + the `for-ai-assistants.md` trap registry)
- `../cendor-sdk/docs` (the governed agent SDK)
- `../cendor-libs-js/docs` (the TypeScript parity matrix)
- `../cendor-cookbook/recipes` (category names only, for `list_recipes()` — optional link-out data)

`scripts/build-index.mjs` reads that markdown and emits a small searchable index (`data/index.json`,
inlined into the npm/Worker bundle via `src/generated/index.ts` and bundled into the Python wheel).
**No docs are ever copied into this repo** — fix docs in the library repos, rebuild, and both the site
and this server reflect the change. In CI/cloud, `scripts/fetch-docs.mjs` sparse-clones the sibling
docs (and the cookbook's `recipes/` tree) first (same mechanism as the site).

## Develop

```bash
pnpm install
pnpm build:index      # read sibling docs → data/index.json + src/generated/index.ts
pnpm build            # build:index + tsc → dist/
pnpm test             # vitest (offline)
pnpm lint             # biome
node dist/cli.js      # run the stdio server locally
pnpm dev:worker       # wrangler dev → local Streamable-HTTP endpoint (does NOT deploy)
```

Python twin: `cd python && uv build` (run `pnpm build:index` from the repo root **first** — it writes
the index the wheel bundles). See [`PUBLISHING.md`](PUBLISHING.md).

## Status

Live. `@cendor/mcp` (npm), `cendor-mcp` (PyPI), and the `mcp.cendor.ai` Worker are published/deployed —
see [`PUBLISHING.md`](PUBLISHING.md). Apache-2.0.

Contributions: [`CONTRIBUTING.md`](CONTRIBUTING.md) · Security reports:
[`SECURITY.md`](SECURITY.md) (never a public issue) · [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
