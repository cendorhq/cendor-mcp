<!-- Thanks for the PR. Keep it focused and green. Full contract: CONTRIBUTING.md -->

## What & why

<!-- What does this change, and what problem does it solve? Link the related issue. Explain the *why* —
     that is the part a reviewer cannot reconstruct from the diff. -->

Touches: <!-- TS server (src/) / Worker / index builder (scripts/) / Python twin (python/) / docs -->

## Gates — run each one bare and read its exit code

<!-- Node ≥ 20, pnpm 9.14.2. `build:index` needs the sibling docs repos checked out next to this one;
     without them it fails loudly on purpose — a server that silently indexed nothing would answer
     with confident nonsense. Never pipe a gate into `tail`/`grep` and chain the next step off `&&`:
     a pipeline's exit code is the last command's, so a failing check reads as a pass. -->

```bash
pnpm install
pnpm lint            # biome
pnpm build:index     # sibling docs → data/index.json + src/generated/index.ts + the wheel's copy
pnpm build           # build:index + tsc → dist/
pnpm test            # vitest — offline
```

- [ ] `pnpm lint`
- [ ] `pnpm build:index` — built against my sibling docs checkouts, not a stale index
- [ ] `pnpm build`
- [ ] `pnpm test` — green, and **offline**: no API key, no network
- [ ] Exercised the change against a real MCP client where it matters (`node dist/cli.js` for stdio, `pnpm dev:worker` for the Worker — never `wrangler deploy`)

## Checklist

- [ ] Tests added or updated in this PR for the new behavior
- [ ] Index count assertions in `test/tools.test.ts` are still **exact** — if the docs legitimately grew, I updated the number rather than loosening the assertion (`pages > 20` once let the page set collapse from 38 to 21 with a green suite)
- [ ] `README.md` / `PUBLISHING.md` updated if this changes how the server is run, built, or released
- [ ] **No version bump and no release** — publishing is maintainer-only and manually gated (`workflow_dispatch`); a plain push never publishes to npm or PyPI

## The rules this repo will not bend

- [ ] **No docs `.md` committed here**, and no in-repo clone of a docs repo — the source of truth is the library repos, and `.gitignore` guards this. A docs fix belongs upstream; a rebuild here picks it up
- [ ] Still **one** index generator (`scripts/build-index.mjs`) — the Python twin only *reads* the generated JSON and did not grow a builder of its own
- [ ] Still **read-only and pull-based** — no server-initiated `sampling`/`elicitation`, no writes to the client, and the user's codebase is never received (only the tool arguments the assistant sends)
- [ ] Nothing here teaches a call shape newer than what is published, and version stamps still come from the version single source (with `data/versions.json` as the generated committed fallback — never hand-edited)
- [ ] No Cendor library was made to depend on this server, and the libraries' local-first "no servers" line still holds
- [ ] Money is `decimal.js`, never a float, anywhere a cost is handled
- [ ] Commit messages are conventional-ish with a body, and carry **no `Co-Authored-By` trailer**

> ⚠️ On a PR **from a fork**, CI's build/test job is skipped — GitHub does not expose the secret used
> to clone the private docs repos, so the index cannot be built there. Only `lint` runs. Expect a
> maintainer to run the full Node 20 + 22 matrix before merge.
