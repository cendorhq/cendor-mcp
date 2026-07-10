#!/usr/bin/env node
/**
 * Local MCP server over stdio: `npx @cendor/mcp` (or `cendor-mcp`). Fully offline — the docs index
 * is bundled at build time. Nothing leaves the machine; only the tool arguments the client sends
 * reach the server. Wire it into Claude Code / Cursor / Copilot (agent mode) / Windsurf — see
 * https://cendor.ai/mcp.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';

async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The transport keeps the process alive on stdin until the client disconnects.
}

main().catch((e) => {
  // stderr only — stdout carries the JSON-RPC stream and must not be polluted.
  process.stderr.write(`[cendor-mcp] fatal: ${(e as Error).stack ?? e}\n`);
  process.exit(1);
});
