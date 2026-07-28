# Contributing to cendor-mcp

Thanks for your interest in contributing. This repo holds the **read-only MCP docs server** — optional
developer tooling that hands an AI coding assistant Cendor's docs and correct call-shapes. It is not
part of the product, and no Cendor library depends on it.

## Ground rules

- **Honest claims.** Every number in docs, READMEs, or answers must be reproducible. This server
  states call *shapes*, never performance numbers — point at
  [`/docs/for-ai-assistants`](https://cendor.ai/docs/for-ai-assistants) and
  [`/releases`](https://cendor.ai/releases) for the maintained truth.
- **Local-first stays true.** The Cendor libraries require no account, network, or running server.
  Nothing here may weaken that: this server is opt-in tooling, and the local entry points are fully
  offline once installed.
- Be respectful and constructive — see the [Code of Conduct](CODE_OF_CONDUCT.md).

### Two rules specific to this repo

1. **Docs are never copied here.** The source of truth is the library repos. `scripts/build-index.mjs`
   reads sibling checkouts (`../cendor-libs/docs`, `../cendor-sdk/docs`, `../cendor-libs-js/docs`, and
   `../cendor-cookbook/recipes` for category names) and generates the index. Committing a docs `.md`
   here — or an in-repo clone of a docs repo — is forbidden, and `.gitignore` guards against it.
   **A docs fix belongs in the library repo**, after which a rebuild here picks it up.
2. **Read-only, pull-based.** Tools answer queries. The server never initiates `sampling` /
   `elicitation`, never writes to the client, and never receives the user's codebase — only the tool
   arguments the assistant sends. Please keep it that way.

## Getting set up

Node ≥ 20 and [pnpm](https://pnpm.io/) 9.14.2. The index is **generated and gitignored**, so a fresh
clone has to build it before anything works:

```bash
pnpm install
pnpm build:index      # reads the sibling docs → data/index.json + src/generated/index.ts + the wheel's copy
pnpm build            # build:index + tsc → dist/
pnpm test             # vitest — offline
pnpm lint             # biome
node dist/cli.js      # run the stdio server locally
pnpm dev:worker       # wrangler dev → local Streamable-HTTP endpoint (does NOT deploy)
```

`pnpm build:index` needs the sibling docs repos checked out next to this one. Without them the build
fails loudly — deliberately: a server that silently indexed nothing would answer with confident
nonsense.

The Python twin (`python/`) reuses the **same generated index** and only reads it — please don't grow
it into a second full implementation:

```bash
pnpm build:index         # from the repo ROOT — writes python/src/cendor_mcp/_data/index.json
cd python && uv build    # sdist + wheel (bundles the index)
```

All tests run **offline** — no API key, no network. If a change needs a network call to pass, it
doesn't belong in the test suite.

## Making a change

1. Open an issue first for anything non-trivial, so we can agree on the approach.
2. Fork, branch, and keep changes focused. Match the surrounding code's style; run `pnpm lint`.
3. Add or update tests in the same PR. New behavior ships with tests.
4. Update `README.md` / `PUBLISHING.md` if you change how the server is run, built, or released.
5. Open a PR against `main` with a clear description of the *why*.

### Assertions about the index must be exact

`test/tools.test.ts` pins the page, trap and example counts to measured numbers rather than
inequalities. That is deliberate: `pages > 20` let the page set collapse from 38 to 21, and
`traps > 10` let the anti-hallucination registry lose three quarters of its rows, with a green suite.
If the docs legitimately grow, **update the number** — don't loosen the assertion.

## Commit and PR conventions

- Conventional-ish commit messages (`feat:`, `fix:`, `docs:`, `chore:`), with a body explaining the
  reasoning.
- **No `Co-Authored-By` trailer** (org-wide convention).
- Keep PRs green: CI runs lint on every push, plus build + tests on both Node 20 and 22.
  ⚠️ On a PR **from a fork**, the build/test job is skipped — GitHub does not expose the secret used
  to clone the private docs repos, so the index cannot be built there. It is not skipped for
  maintainer pushes, where a missing token is a hard failure. Expect a maintainer to run the full
  matrix before merge.

## Releasing

Publishing is maintainer-only and manually gated (`workflow_dispatch`); a plain push never publishes
to npm or PyPI. See [`PUBLISHING.md`](PUBLISHING.md).

## License

By contributing, you agree that your contributions are licensed under the project's Apache-2.0
license. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
