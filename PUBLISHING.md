# Publishing & deploying cendor-mcp

Three artifacts ship from this repo, **all held for the launch gate**:

| Artifact | Registry / host | Entry |
|---|---|---|
| `@cendor/mcp` | npm | `npx @cendor/mcp` (stdio) |
| `cendor-mcp` | PyPI | `uvx cendor-mcp` (stdio) |
| `cendor-mcp` Worker | Cloudflare → `mcp.cendor.ai` | remote Streamable HTTP |

> **Posture: HOLD.** Do not publish or deploy until the owner opens the launch gate. New packages must
> exist (a first *manual* publish) before any automated/OIDC-trusted publish. The libraries stay
> server-free; this is optional dev tooling.

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

Uses Changesets like the other cendor JS repos, but **publish is manual first**:

```bash
# FIRST publish (launch gate) — makes the name exist:
pnpm build
pnpm publish --access public --no-git-checks     # pnpm rewrites any workspace ranges

# thereafter (matching cendor-libs-js / cendor-sdk-js): add a changeset, then at launch flip
# .github/workflows/release.yml's `push: branches: [main]` trigger back on so `changeset publish`
# runs on push. Provenance stays off (NPM_CONFIG_PROVENANCE=false) while the repo is private.
```

`files` ships `dist/` (which includes the inlined docs index) + `README`/`LICENSE`/`NOTICE`. The
package is fully offline once installed.

## 2. PyPI — `cendor-mcp` (the uvx twin)

The wheel bundles the generated index. **Run the Node index build first** (it writes
`python/src/cendor_mcp/_data/index.json`, which `pyproject.toml` force-includes via
`[tool.hatch.build] artifacts`):

```bash
pnpm build:index         # from the repo ROOT — writes the index into python/…/_data/
cd python
uv build                 # sdist + wheel (bundles _data/index.json)
uv publish               # launch gate only
```

## 3. Cloudflare Worker — `mcp.cendor.ai`

Reuses the site's Workers pattern (see cendorhq MEMORY: `cendor-site-hosting-decision`,
`cendor-site-deploy-state`). `wrangler.jsonc` points `main` at the compiled `dist/worker.js` (build
first) and declares the `mcp.cendor.ai` custom-domain route.

```bash
pnpm build
wrangler dev             # local workerd — safe, does NOT deploy
# LAUNCH GATE ONLY:
wrangler deploy          # deploys the Worker
```

**Deploy steps captured for the launch gate (do NOT run now):**

1. `wrangler deploy` (Cloudflare account holding the `cendor.ai` zone; `CLOUDFLARE_API_TOKEN`).
   Prefer the Workers-Builds git integration (build command `pnpm build:cf`, needs `GH_DOCS_TOKEN`
   for the private docs repos) so pushes rebuild from fresh sibling docs — mirror cendor-site.
2. Bind the custom domain **`mcp.cendor.ai`** (dashboard → Worker → Triggers → Custom Domains, or via
   the `routes` entry in `wrangler.jsonc`). DNS is already on Cloudflare.
3. Smoke-test: `curl -s https://mcp.cendor.ai -X POST -H 'content-type: application/json' -d
   '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` returns the five tools.

**Deploy order at launch:** push the docs repos first (so the index builds from fresh docs), then
mcp + site.

## After every release — sync version surfaces

The server stamps answers with the published versions. Keep `data/versions.json` (the committed
fallback) in step with the site `/releases` source of truth — this is part of the org-wide
"sync all version surfaces after every release" checklist in the root `CLAUDE.md`.
