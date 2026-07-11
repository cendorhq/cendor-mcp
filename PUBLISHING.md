# Publishing & deploying cendor-mcp

Three artifacts ship from this repo, **all live since 2026-07-10**:

| Artifact | Registry / host | Entry |
|---|---|---|
| `@cendor/mcp` | npm | `npx @cendor/mcp` (stdio) |
| `cendor-mcp` | PyPI | `uvx cendor-mcp` (stdio) |
| `cendor-mcp` Worker | Cloudflare → `mcp.cendor.ai` | remote Streamable HTTP |

> **Posture: released, gated.** npm + PyPI publish through the `workflow_dispatch`-only
> `release.yml` (`gh workflow run release.yml -f npm=true -f pypi=true`) — nothing publishes on a
> plain push. The Worker redeploys on push to `main` via the Cloudflare Workers-Builds git
> integration. The libraries stay server-free; this is optional dev tooling.

## Build order (always)

The docs index is generated from the sibling docs and is **gitignored** — it must be built before any
package/Worker artifact:

```bash
pnpm install
node scripts/fetch-docs.mjs   # only in CI/cloud; local sibling checkouts are used as-is
pnpm build                    # = build:index (writes data/index.json + src/generated/index.ts
                              #   + python/src/cendor_mcp/_data/index.json) then tsc → dist/
```

## 1. npm — `@cendor/mcp`

Published by the `npm` job of `.github/workflows/release.yml` (gated behind a `workflow_dispatch`
input; the job needs `DOCS_REPOS_TOKEN` to clone the private docs and rebuild the index, and
`NPM_TOKEN` to publish):

```bash
# bump "version" in package.json (+ SERVER_VERSION in src/rpc.ts) + CHANGELOG, push, then:
gh workflow run release.yml -f npm=true
```

`files` ships `dist/` (which includes the inlined docs index) + `README`/`LICENSE`/`NOTICE`. The
package is fully offline once installed. Provenance stays off (`NPM_CONFIG_PROVENANCE=false`) while
the repo is private — flip to `true` (or move to npm OIDC trusted publishing) when the repo goes
public.

## 2. PyPI — `cendor-mcp` (the uvx twin)

Published by the `pypi` job of the same `release.yml` (OIDC trusted publishing, environment `mcp` —
no stored token):

```bash
# bump python/pyproject.toml version + CHANGELOG, push, then:
gh workflow run release.yml -f pypi=true          # or combine: -f npm=true -f pypi=true
```

To build locally for verification (the wheel bundles the generated index — **run the Node index
build first**; it writes `python/src/cendor_mcp/_data/index.json`, which `pyproject.toml`
force-includes via `[tool.hatch.build] artifacts`):

```bash
pnpm build:index         # from the repo ROOT — writes the index into python/…/_data/
cd python
uv build                 # sdist + wheel (bundles _data/index.json)
```

## 3. Cloudflare Worker — `mcp.cendor.ai`

Deployed via the **Cloudflare Workers-Builds git integration** (build command `pnpm build:cf`,
build secret `GH_DOCS_TOKEN` for the private docs repos): every push to `main` rebuilds the index
from fresh sibling docs and redeploys — mirror of cendor-site. The custom domain `mcp.cendor.ai`
is bound (declared in `wrangler.jsonc` `routes`). Local `wrangler deploy` is not the normal path;
use the git integration (or a dashboard retrigger for a docs-only refresh, since the index is
gitignored and a docs change alone doesn't touch this repo).

```bash
pnpm build
wrangler dev             # local workerd — safe, does NOT deploy
```

Smoke-test after a deploy: `curl -s https://mcp.cendor.ai -X POST -H 'content-type: application/json'
-d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` returns the five tools.

**Deploy order (docs changes):** push the docs repos first (so the index builds from fresh docs),
then retrigger/redeploy mcp + push the site.

## After every release — sync version surfaces

The server stamps answers with the published versions. Keep `data/versions.json` (the committed
fallback) in step with the site `/releases` source of truth — this is part of the org-wide
"sync all version surfaces after every release" checklist in the root `CLAUDE.md`.
