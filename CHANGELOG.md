# cendor-mcp changelog

`@cendor/mcp` (npm) and `cendor-mcp` (PyPI) are versioned together.

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
