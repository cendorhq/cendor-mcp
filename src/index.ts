/**
 * @cendor/mcp — a read-only MCP docs server for Cendor, built from the docs source of truth.
 *
 * Entry points:
 *   - `cendor-mcp` / `npx @cendor/mcp`  → local stdio server (src/cli.ts)
 *   - the Cloudflare Worker at mcp.cendor.ai → src/worker.ts
 *
 * This module exports the reusable pieces for embedding/testing.
 */
export { INDEX } from './index-data.js';
export { buildServer } from './server.js';
export { searchDocs } from './search.js';
export { buildTools } from './tools.js';
export {
  handleRpc,
  toolDescriptors,
  SERVER_INFO,
  SERVER_INSTRUCTIONS,
  DEFAULT_PROTOCOL_VERSION,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './rpc.js';
export type {
  DocIndex,
  DocPage,
  DocChunk,
  TrapRow,
  Example,
  VersionRow,
  Versions,
  RecipeIndex,
  ToolDef,
  Lang,
  Product,
} from './types.js';
