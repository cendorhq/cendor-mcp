#!/usr/bin/env node
/**
 * Ensure the docs sources are available before building the index:
 *   - cendorhq/cendor-libs    → ../cendor-libs/docs        (the seven libraries + the trap registry
 *                                                           docs/for-ai-assistants.md)
 *   - cendorhq/cendor-sdk     → ../cendor-sdk/docs          (the governed agent SDK)
 *   - cendorhq/cendor-libs-js → ../cendor-libs-js/docs      (TypeScript parity matrix)
 *   - cendorhq/cendor-cookbook → ../cendor-cookbook/recipes (the recipe category index for
 *                                                            list_recipes(); OPTIONAL — a failure
 *                                                            here degrades to an empty index, it
 *                                                            never breaks the docs server)
 *
 * Local dev: sibling checkouts already exist → no-op. Cloud build (the Cloudflare Worker's build,
 * or CI): this repo is checked out alone, so sparse-clone each repo's tree into the parent dir.
 *
 * Docs are the source of truth in the LIBRARY repos and are NEVER copied into this repo — the build
 * reads them, produces a search index (data/index.json + src/generated/index.ts), and that generated
 * index is what ships. Same rule (and the same sparse-clone mechanism) as cendor-site.
 *
 * While the repos are PRIVATE, set GH_DOCS_TOKEN to a fine-grained PAT with read-only "Contents"
 * access to all four repos (cendor-cookbook was added 2026-07-11 so list_recipes works in the cloud
 * build). After launch (repos public), the token can be removed — the clone falls back to the public
 * URL.
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

// Each source: which repo, the tree to sparse-checkout, where it lands (overridable for local dev),
// and whether a failure is fatal. The docs repos are REQUIRED (the index is useless without them);
// the cookbook is OPTIONAL (loadRecipes() degrades to an empty list if it's absent).
const SOURCES = [
  {
    repo: 'cendorhq/cendor-libs',
    tree: 'docs',
    path: process.env.DOCS_PATH || '../cendor-libs/docs',
  },
  {
    repo: 'cendorhq/cendor-sdk',
    tree: 'docs',
    path: process.env.SDK_DOCS_PATH || '../cendor-sdk/docs',
  },
  {
    repo: 'cendorhq/cendor-libs-js',
    tree: 'docs',
    path: process.env.JS_DOCS_PATH || '../cendor-libs-js/docs',
  },
  {
    repo: 'cendorhq/cendor-cookbook',
    tree: 'recipes',
    path: process.env.COOKBOOK_PATH || '../cendor-cookbook/recipes',
    optional: true,
  },
];

// shell:false so the token-bearing URL is never echoed to a shell / CI log.
function git(args) {
  const r = spawnSync('git', args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed (exit ${r.status})`);
}

for (const { repo, tree, path, optional } of SOURCES) {
  const treeAbs = resolve(process.cwd(), path);
  const repoDir = resolve(treeAbs, '..'); // parent of the tree = the clone target
  if (existsSync(treeAbs)) {
    console.log(`[fetch-docs] ${path} already present — skipping ${repo}.`);
    continue;
  }
  console.log(
    `[fetch-docs] sparse-cloning ${repo} ${tree}/ → ${repoDir} ${token ? '(authenticated)' : '(public)'}`,
  );
  try {
    git(['clone', '--depth', '1', '--filter=blob:none', '--sparse', cloneUrl(repo), repoDir]);
    git(['-C', repoDir, 'sparse-checkout', 'set', tree]);
    if (!existsSync(treeAbs)) {
      throw new Error(`${tree} not found at ${path} after clone`);
    }
  } catch (err) {
    if (optional) {
      // Never let an optional source (the cookbook) break the docs server build.
      console.warn(
        `[fetch-docs] optional ${repo} unavailable (${err.message}) — continuing without it.`,
      );
      continue;
    }
    throw new Error(
      `[fetch-docs] ${path} unavailable after clone — check the repo/token. ${err.message}`,
    );
  }
}
console.log('[fetch-docs] sources ready.');
