/**
 * Remote MCP server for mcp.cendor.ai — a stateless, read-only Streamable-HTTP endpoint on a
 * Cloudflare Worker. The docs index is inlined into the bundle at build time (via
 * src/generated/index.ts), so the Worker never reads a file or hits the network. It answers each
 * JSON-RPC request with a single `application/json` response (no server-initiated SSE stream — this
 * is read-only, so there is nothing to push), which is a valid Streamable-HTTP interaction.
 *
 * DEPLOY IS HELD (launch gate): `pnpm build` then `wrangler deploy` — do NOT deploy yet. `wrangler
 * dev` serves it locally for testing. See wrangler.jsonc + PUBLISHING.md.
 */
import { INDEX } from './index-data.js';
import { type JsonRpcRequest, handleRpc } from './rpc.js';
import { buildTools } from './tools.js';

const tools = buildTools(INDEX);

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers':
    'content-type, mcp-session-id, mcp-protocol-version, authorization',
  'access-control-expose-headers': 'mcp-session-id',
};

const LANDING =
  'Cendor MCP — read-only docs server (Streamable HTTP).\n' +
  'Connect your agent-mode assistant to this URL. Setup: https://cendor.ai/mcp\n' +
  'Tools: search_docs, get_page, get_api, example, list_recipes.\n';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (request.method === 'GET') {
      const accept = request.headers.get('accept') ?? '';
      if (accept.includes('text/event-stream')) {
        // No server-initiated stream on a read-only server — tell the client to POST instead.
        return new Response('This MCP endpoint is stateless; POST JSON-RPC requests to it.', {
          status: 405,
          headers: CORS,
        });
      }
      return new Response(LANDING, {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', ...CORS },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS });
    }

    let msg: JsonRpcRequest;
    try {
      msg = (await request.json()) as JsonRpcRequest;
    } catch {
      return json(
        { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
        400,
      );
    }

    if (Array.isArray(msg)) {
      // JSON-RPC batching was removed in the current MCP spec revision.
      return json(
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Batch requests are not supported' },
        },
        400,
      );
    }

    const res = handleRpc(msg, tools);
    if (res === null) return new Response(null, { status: 202, headers: CORS });
    return json(res);
  },
};
