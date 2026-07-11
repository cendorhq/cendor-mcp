# cendor-mcp changelog

`@cendor/mcp` (npm) and `cendor-mcp` (PyPI) are versioned together.

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
