# cendor-mcp changelog

`@cendor/mcp` (npm) and `cendor-mcp` (PyPI) are versioned together.

## 0.1.6 — 2026-07-27

- **Retire the `releases.astro` regex scraper.** Versions were read out of the site page's *source*
  with a line-anchored regex. That failed silently in two measured ways: on a Windows checkout
  (`core.autocrlf=true`) it matched **nothing** and wrote **0 canonical examples instead of 8** into
  an index that ships inside this package, and any reformatting of the page's array literals would
  have done the same. cendor-site now keeps the versions in `src/data/versions.json` and renders
  `/releases` from it, so `build-index.mjs` reads that JSON directly — and deliberately does **not**
  wrap the parse in `try/catch`: malformed data must fail the build loudly rather than degrade to a
  stale fallback that looks fine and teaches an old version.
- **`SERVER_VERSION` is gated.** It drifted behind `package.json` once and `mcp.cendor.ai` introduced
  itself as `0.1.4` for three releases. The workspace `scripts/check-versions.mjs` now asserts it
  against the version source, along with the built index's own version stamp.
- Bundled index refreshed to the 2026-07-27 shelf: `cendor-core` 1.14.2 / `@cendor/core` 0.16.2,
  `cendor-cassette` 1.1.1, `cendor-guardrails` 1.6.1, `cendor-init` / `@cendor/init` 0.3.0, Cendor
  Monitor 0.15.0. 38 pages / 275 chunks / 46 traps / 8 examples. The hosted Worker already tracked
  this (it redeploys on push); this brings the offline `npx` / `uvx` bundle in step.

## 0.1.4 — 2026-07-19

- **Refresh the bundled docs index for the zod 4 shelf.** Picks up `@cendor/sdk 0.11.0` (TypeScript
  tool and output schemas migrated to zod 4 — native `z.toJSONSchema`, drops `zod-to-json-schema`;
  a zod 3 schema is now rejected with a clear error instead of silently producing an empty schema)
  and the new trap row "Tool / output schema version (SDK)" (32 trap rows), plus the current
  published versions across both languages. The hosted Worker (`mcp.cendor.ai`) already tracked this;
  this release brings the offline `npx @cendor/mcp` / `uvx cendor-mcp` bundle in step.
- `SERVER_VERSION` bumped to 0.1.4 to match.

## 0.1.3 — 2026-07-11

- **MCP protocol-version negotiation is now spec-compliant.** `initialize` clamps: the server
  responds with the requested `protocolVersion` only when it actually supports it, otherwise with
  the latest supported revision (previously it echoed back any requested version). Default is now
  `2025-11-25`.
- **Refresh the bundled docs index** (29 trap rows — adds the `instrument()` capture-gaps row —
  and the current published versions, including core 1.5.2 / 0.5.2 with the regenerated price
  snapshot).
- The self-reported server version had drifted (0.1.2 shipped reporting 0.1.1); `SERVER_VERSION`
  is caught up and the committed versions fallback is synced.

## 0.1.2 — 2026-07-11

- **Refresh the bundled docs index.** Picks up the SDK docs revamp and the site/docs UX round-2 work:
  the new SDK `architecture.md` (the two-layer story + per-library "where it's used in the SDK"
  tables), the styled diagrams, the enlarged SDK `for-ai-assistants` trap sheet, and the added
  canonical SDK trap rows + governed-agent example. Local `npx @cendor/mcp` / `uvx cendor-mcp` users
  were serving the 0.1.1 snapshot; this brings the bundled index level with `mcp.cendor.ai`. No tool
  or transport changes — index content only.

## 0.1.1 — 2026-07-11

- **Refresh the bundled docs index.** 0.1.0 shipped a stale index (built before the 2026-07-11 patch
  and before the docs were reorganized). This rebuild picks up the new AI-assistant docs pages
  (`assistant-rules`, `assistant-mcp`, `assistant-init`, and the SDK `for-ai-assistants` pointer) and
  the current published versions.
- **`list_recipes()` works in the cloud build.** `scripts/fetch-docs.mjs` now sparse-clones the
  `cendor-cookbook` `recipes/` tree alongside the docs repos, so the deployed Worker returns the
  cookbook categories instead of an empty list (the clone is optional — a failure degrades to an empty
  index, never breaking the docs server).
- **README:** document the `lang` accepted values (`"python"` / `"ts"`, with `py` / `js` aliases) for
  `get_api` / `example`.

## 0.1.0 — 2026-07-10

- First release. A read-only MCP docs server (local `npx @cendor/mcp` / `uvx cendor-mcp`, remote
  `mcp.cendor.ai`) with five tools — `search_docs`, `get_page`, `get_api`, `example`, `list_recipes` —
  built from the sibling docs source of truth, answers stamped with published versions.
