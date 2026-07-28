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

## ⚠️ The docs-clone PAT expires **2026-08-09**

Nothing in this repo can be built in the cloud without it. `scripts/fetch-docs.mjs` sparse-clones the
sibling docs repos, which are **private**, so it needs a **fine-grained personal access token** with
read-only **Contents** on `cendor-libs`, `cendor-sdk`, `cendor-libs-js` and `cendor-cookbook`. The
same token value is stored in **three** places, each under its own name:

| Where | Name | Breaks if it lapses |
|---|---|---|
| GitHub Actions secret | `DOCS_REPOS_TOKEN` | `.github/workflows/ci.yml` — the `build-test` job (it now **fails loudly**; it used to self-skip and report green) |
| GitHub Actions secret | `DOCS_REPOS_TOKEN` | `.github/workflows/release.yml` — **both** the `npm` and `pypi` jobs; a release cannot build its index, so **no publish is possible** |
| Cloudflare Workers-Builds build secret | `GH_DOCS_TOKEN` | `mcp.cendor.ai` — every push to `main` rebuilds the index; the build fails and the Worker keeps serving the previously deployed index (stale docs, silently) |

**Who must act: Raghav** (org owner — only he can mint a token with access to `cendorhq` private repos
and write the Actions secret + the Cloudflare build secret). Two ways to close it, either is enough:

1. **Flip the docs repos public** (planned — FLIP-CHECKLIST rows C1–C4/C6). Then the sparse clones
   need **no token at all**, both secrets become dead weight, and this whole row disappears. This is
   the preferred fix.
2. **Rotate the PAT** — mint a new fine-grained token with the same four repos + read Contents, then
   update the GitHub secret `DOCS_REPOS_TOKEN` *and* the Cloudflare build secret `GH_DOCS_TOKEN`.
   Updating only one leaves the other half broken, and the Cloudflare half fails **quietly** (the
   previous Worker deployment keeps answering).

The token is shared with `cendor-site` and `cendor-sdk-js` (same value, `GH_DOCS_TOKEN` /
`DOCS_REPOS_TOKEN`), so a rotation is an org-wide task tracked in the workspace `FLIP-CHECKLIST.md` —
not a cendor-mcp-only chore. Local development is unaffected: sibling checkouts are read from disk
and never need a token.

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
# bump ALL FOUR version surfaces together (see "Version surfaces" below), push, then:
gh workflow run release.yml -f npm=true
```

Versioning is hand-bumped here even though `.changeset/` exists: this repo has never carried a
changeset, `changeset version` is a no-op with none present, and `changeset publish` ships whatever
`package.json` says. Dev tooling versions on its own cadence (org versioning rule 5), and a MAJOR
still needs Raghav's explicit approval (rule 1).

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

## Version surfaces — all four move together

`SERVER_VERSION` drifted behind `package.json` once and `mcp.cendor.ai` introduced itself as `0.1.4`
for three releases. Bump these in one commit:

| Surface | What it is |
|---|---|
| `package.json` `"version"` | what `changeset publish` ships to npm |
| `python/pyproject.toml` `version` | what `uv build` stamps on the wheel/sdist |
| `src/rpc.ts` `SERVER_VERSION` | what the server calls itself in the `initialize` handshake |
| `CHANGELOG.md` | the entry — record the **measured** index counts, read from `data/index.json` `meta` (`pageCount` / `chunkCount` / `trapCount` / `exampleCount`) after `pnpm build:index`. Never copy counts from prose. |

## Version surfaces — sync the shelf BEFORE the dispatch

The server stamps every answer with the published versions, from the version table baked into the
built index. The org-wide single source is `cendor-site/src/data/versions.json`; `data/versions.json`
here is a **generated committed fallback**, read only when no `cendor-site` sibling checkout is
present — regenerate it with `npm run sync-versions` in cendor-site, **never by hand**.

⚠️ **This includes cendor-mcp's own `devtooling` `mcp` row, and it has to move first.** Editing
`data/versions.json` here does nothing when a `cendor-site` sibling checkout exists — `build-index.mjs`
deliberately prefers the live source, so the bundled index takes the mcp version from cendor-site, not
from this repo. Bumping only this repo's four surfaces therefore ships a package that introduces itself
as `0.1.7` while its own version table says the latest mcp is `0.1.6`. Pre-dispatch order:

1. In **cendor-site**: bump the `devtooling` `mcp` row (`pypiVer` + `npmVer` + its `note`) in
   `src/data/versions.json` to the version about to be published, then `npm run sync-versions` —
   which rewrites `cendor-mcp/data/versions.json` and the other generated mirrors.
2. Back **here**: `pnpm build:index` (the index is gitignored, so this is what actually re-stamps the
   bundle), then `pnpm lint && pnpm test`. Commit the regenerated `data/versions.json`.
3. Push (this redeploys the `mcp.cendor.ai` Worker), then dispatch `release.yml`.

Until step 1 happens, the workspace gate `node scripts/check-versions.mjs` reports `SERVER_VERSION` as
ahead of the source. On a prepared-but-unpublished release that reading is **correct, not a defect** —
it is the gate saying "this version is not published yet". Do not silence it by hand-editing a mirror.

Part of the org-wide "sync all version surfaces after every release" checklist in the root `CLAUDE.md`.
