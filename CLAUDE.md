# CLAUDE.md — cendor-mcp

Project **constitution** for the Cendor MCP server. Always in effect. The org constitution is the
workspace-root `cendorhq/CLAUDE.md`; this repo obeys it and adds the rules below. Read the root
`MEMORY.md` for org state; deep design lives in `../plan/PLAN-AI-ONBOARDING-P3-MCP.md`.

## What this is

A **read-only Model Context Protocol server** that serves Cendor's docs + correct call-shapes to
agent-mode AI assistants. It is **optional developer tooling**, not part of the product — no Cendor
library may depend on it, and it must never weaken the "local-first, no servers" brand line for the
libraries themselves.

- **Two entry points, one index.** Local `npx @cendor/mcp` (TS, stdio) + `uvx cendor-mcp` (Python,
  stdio, small twin); remote Cloudflare Worker at `mcp.cendor.ai` (Streamable HTTP, stateless).
- **TypeScript is the canonical server** (`src/`). Python is a small twin (`python/`) that reuses the
  SAME generated index — don't grow it into a second full implementation.

## Cardinal rules — DO NOT BREAK

1. **Never copy docs into this repo.** The docs source of truth is the library repos. `scripts/
   build-index.mjs` reads sibling checkouts (`../cendor-libs/docs`, `../cendor-sdk/docs`,
   `../cendor-libs-js/docs`) and generates the index. Committing any docs `.md` here (or an in-repo
   clone of a docs repo) is forbidden — `.gitignore` guards against it. Fix docs in the library repos.
2. **One index generator.** `scripts/build-index.mjs` is the single builder. It emits three gitignored
   outputs from one in-memory object: `data/index.json`, `src/generated/index.ts` (bundled into the
   npm package + Worker), and `python/src/cendor_mcp/_data/index.json` (bundled into the wheel). The
   Python server only *reads* the JSON — it has no builder of its own.
3. **Read-only. Pull-based.** Tools answer queries; the server never initiates `sampling`/
   `elicitation`, never writes to the client, and never receives the user's codebase — only the tool
   arguments the assistant sends. Keep it that way.
4. **Never teach a shape newer than what's published.** Version stamps come from the site `/releases`
   source of truth (`../cendor-site/src/pages/releases.astro`, parsed at build; `data/versions.json`
   is the committed fallback — keep it synced after every release).
5. **Honest claims.** State call *shapes*, never performance numbers. Point at
   `cendor.ai/docs/for-ai-assistants` and `/releases` for the maintained truth.
6. **No `Co-Authored-By` trailer** on commits (org-wide rule). Conventional-ish messages.

## Release / deploy posture — LIVE, GATED

- **All three artifacts are live** (npm `@cendor/mcp`, PyPI `cendor-mcp`, Worker `mcp.cendor.ai`,
  first published 2026-07-10). Packages publish ONLY through the `workflow_dispatch`-gated
  `release.yml` (`gh workflow run release.yml -f npm=true -f pypi=true`) — a plain push never
  publishes. The Worker redeploys on every push to `main` via the Cloudflare Workers-Builds git
  integration, so **pushing this repo IS a deploy of mcp.cendor.ai** — push docs repos first.
- Runbook: `PUBLISHING.md`. Build order for the Python wheel: `pnpm build:index` **before** `uv build`.

## Verify (offline)

```bash
pnpm build:index && pnpm build && pnpm test && pnpm lint   # TS: index + tsc + vitest + biome
pnpm dev:worker                                            # workerd locally (never `wrangler deploy`)
```

Exercise the tools with any MCP client (the MCP Inspector, or a scripted stdio client):
`get_api("budget","ts")` must return the curried shape; `search_docs("guardrails")` real chunks.

## Keep in sync when docs change

Editing a docs `.md` in a library repo, or the trap table in `cendor-libs/docs/for-ai-assistants.md`,
requires a **rebuild** here (`pnpm build:index`) for the change to reach the server — same as the site
needs a rebuild. At the launch gate, the deploy order is **docs repos → mcp/site**.

## Versioning — the org standard (see the workspace `CLAUDE.md`)

1. **A MAJOR bump needs Raghav's explicit approval. Never autonomous.** Propose it, say what breaks,
   wait. **Minor and patch need no approval** — ship them. Enforced by
   `node scripts/check-major-bump.mjs` (in CI and in `verify-hold`), which reads an in-band
   `Approved-Major:` line in the changeset, or an `APPROVED-MAJOR` file listing the exact version.
2. **All libraries in one language share ONE major** — `@cendor/*` move together, `cendor-*` move
   together. Minors and patches stay independent per package.
3. **Majors are NOT coupled across languages.** The parity matrix is the contract, not matching
   numbers.
4. **Use minors.** A new capability is a **minor**; a fix is a **patch**. Do not drift into
   patch-patch-patch-then-a-surprise-major — the version number has to carry information.
