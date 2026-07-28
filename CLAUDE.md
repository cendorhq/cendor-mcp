# CLAUDE.md — cendor-mcp

Project **constitution** for the Cendor MCP server. Always in effect. This file is written to stand
alone — a checkout of this repo by itself must still see every rule below.

> **Maintainers working inside the full `cendorhq` workspace** additionally obey the workspace-root
> `cendorhq/CLAUDE.md` (org constitution) and read the workspace `MEMORY.md` for current org state.
> Those files, and the design notes under `plan/`, are **unversioned and workspace-local** — they are
> not part of this repository and cannot be resolved from a clone of it.

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
4. **Never teach a shape newer than what's published.** Version stamps come from the org-wide version
   single source, `cendor-site/src/data/versions.json`, read **as JSON** at build when that sibling
   checkout is present. `data/versions.json` here is the **generated committed fallback** used when it
   is not (cloud builds) — regenerate it with `npm run sync-versions` in cendor-site, never by hand,
   and keep it synced after every release.
   ⚠️ The predecessor was a **line-anchored regex over `releases.astro`'s source**, retired in 0.1.6:
   on a CRLF checkout it matched **nothing** and shipped **0 canonical examples instead of 8** inside
   this package. The JSON parse is deliberately **not** wrapped in `try/catch` — malformed data must
   fail the build loudly rather than degrade to a stale fallback that looks fine.
5. **Honest claims.** State call *shapes*, never performance numbers. Point at
   `cendor.ai/docs/for-ai-assistants` and `/releases` for the maintained truth.
6. **No `Co-Authored-By` trailer** on commits (org-wide rule). Conventional-ish messages.

## Release / deploy posture — LIVE, GATED

- **All three artifacts are live** (npm `@cendor/mcp`, PyPI `cendor-mcp`, Worker `mcp.cendor.ai`,
  first published 2026-07-10). Packages publish ONLY through the `workflow_dispatch`-gated
  `release.yml` (`gh workflow run release.yml -f npm=true -f pypi=true`) — a plain push never
  publishes. The Worker redeploys on every push to `main` via the Cloudflare Workers-Builds git
  integration, so **pushing this repo IS a deploy of mcp.cendor.ai** — push docs repos first.
- **Four version surfaces move in one commit**: `package.json`, `python/pyproject.toml`,
  `src/rpc.ts` `SERVER_VERSION`, and the `CHANGELOG.md` entry. `SERVER_VERSION` drifted once and the
  live Worker introduced itself as `0.1.4` for three releases. CHANGELOG counts are **measured** from
  `data/index.json` `meta` after a rebuild — never copied from prose.
- ⚠️ **The docs-clone PAT (`DOCS_REPOS_TOKEN` / `GH_DOCS_TOKEN`) expires 2026-08-09.** It gates CI,
  BOTH release jobs, and the Cloudflare Worker build. Rotate it or flip the docs repos public — see
  `PUBLISHING.md`.
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

## Versioning — the org standard (reproduced so it travels with the repo)

1. **A MAJOR bump needs Raghav's explicit approval. Never autonomous.** Propose it, say what breaks,
   wait. **Minor and patch need no approval** — ship them.
   Enforcement note: the org gates `check-major-bump.mjs` / `check-versions.mjs` live in the
   **workspace** `cendorhq/scripts/`, are run by the workspace `verify-hold.sh`, and are **not** in
   this repo and **not** invoked by any workflow here. In a clone of this repo the rule is honoured by
   hand — do not assume something will stop you.
2. **All libraries in one language share ONE major** — `@cendor/*` move together, `cendor-*` move
   together. Minors and patches stay independent per package.
3. **Majors are NOT coupled across languages.** The parity matrix is the contract, not matching
   numbers.
4. **Use minors.** A new capability is a **minor**; a fix is a **patch**. Do not drift into
   patch-patch-patch-then-a-surprise-major — the version number has to carry information.
5. **Dev tooling versions on its own cadence** — `@cendor/mcp` / `cendor-mcp` (like `@cendor/init` /
   `cendor-init` and the `cendor-monitor` image) sit **outside rules 2 and 4**: this server is not a
   library, shares no major with the `@cendor/*` or `cendor-*` families, and a docs-index refresh is
   legitimately a patch. **Rule 1 still applies.**
