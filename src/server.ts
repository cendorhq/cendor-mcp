/**
 * The local (stdio) MCP server, built on the official @modelcontextprotocol/sdk. Same tool registry
 * as the Cloudflare Worker (see rpc.ts) — the transports differ, the answers don't.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { INDEX } from './index-data.js';
import { SERVER_INFO, SERVER_INSTRUCTIONS, toolDescriptors } from './rpc.js';
import { buildTools } from './tools.js';

export function buildServer(): Server {
  const tools = buildTools(INDEX);
  const server = new Server(
    { name: SERVER_INFO.name, title: SERVER_INFO.title, version: SERVER_INFO.version },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDescriptors(tools) }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${req.params.name}` }],
        isError: true,
      };
    }
    try {
      const text = tool.handler((req.params.arguments ?? {}) as Record<string, unknown>);
      return { content: [{ type: 'text' as const, text }] };
    } catch (e) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  });

  return server;
}
