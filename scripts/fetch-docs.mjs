#!/usr/bin/env node
/**
 * Ensure the docs sources are available before building the index:
 *   - cendorhq/cendor-libs    → ../cendor-libs/docs     (the seven libraries + the trap registry
 *                                                        docs/for-ai-assistants.md)
 *   - cendorhq/cendor-sdk     → ../cendor-sdk/docs       (the governed agent SDK)
 *   - cendorhq/cendor-libs-js → ../cendor-libs-js/docs   (TypeScript parity matrix)
 *
 * Local dev: sibling checkouts already exist → no-op. Cloud build (the Cloudflare Worker's build,
 * or CI): this repo is checked out alone, so sparse-clone each repo's docs/ into the parent dir.
 *
 * Docs are the source of truth in the LIBRARY repos and are NEVER copied into this repo — the build
 * reads them, produces a search index (data/index.json + src/generated/index.ts), and that generated
 * index is what ships. Same rule (and the same sparse-clone mechanism) as cendor-site.
 *
 * While the repos are PRIVATE, set GH_DOCS_TOKEN to a fine-grained PAT with read-only "Contents"
 * access to all three repos. After launch (repos public), the token can be removed — the clone
 * falls back to the public URL.
 *
 *   CF/CI build:  node scripts/fetch-docs.mjs && pnpm build   (== pnpm build:cf)
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const token = process.env.GH_DOCS_TOKEN || '';
const cloneUrl = (repo) =>
  token
    ? `https://x-access-token:${token}@github.com/${repo}.git`
    : `https://github.com/${repo}.git`;

// Each docs source: which repo, and where its docs/ lands (overridable for local dev).
const SOURCES = [
  { repo: 'cendorhq/cendor-libs', docsPath: process.env.DOCS_PATH || '../cendor-libs/docs' },
  { repo: 'cendorhq/cendor-sdk', docsPath: process.env.SDK_DOCS_PATH || '../cendor-sdk/docs' },
  {
    repo: 'cendorhq/cendor-libs-js',
    docsPath: process.env.JS_DOCS_PATH || '../cendor-libs-js/docs',
  },
];

// shell:false so the token-bearing URL is never echoed to a shell / CI log.
function git(args) {
  const r = spawnSync('git', args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed (exit ${r.status})`);
}

for (const { repo, docsPath } of SOURCES) {
  const docsAbs = resolve(process.cwd(), docsPath);
  const repoDir = resolve(docsAbs, '..'); // parent of docs/ = the clone target
  if (existsSync(docsAbs)) {
    console.log(`[fetch-docs] ${docsPath} already present — skipping ${repo}.`);
    continue;
  }
  console.log(
    `[fetch-docs] sparse-cloning ${repo} docs/ → ${repoDir} ${token ? '(authenticated)' : '(public)'}`,
  );
  git(['clone', '--depth', '1', '--filter=blob:none', '--sparse', cloneUrl(repo), repoDir]);
  git(['-C', repoDir, 'sparse-checkout', 'set', 'docs']);
  if (!existsSync(docsAbs)) {
    throw new Error(
      `[fetch-docs] docs not found at ${docsPath} after clone — check the repo/token.`,
    );
  }
}
console.log('[fetch-docs] docs ready.');
