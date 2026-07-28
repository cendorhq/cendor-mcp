/**
 * Transport-agnostic JSON-RPC dispatch for the MCP protocol, driven by the shared tool registry.
 * The Cloudflare Worker (Streamable-HTTP, stateless) calls this directly; the local stdio entry
 * uses the official @modelcontextprotocol/sdk Server (see server.ts) over the same tools. Read-only:
 * no server→client calls (no sampling/elicitation), no notifications beyond the client's own.
 */
import type { ToolDef } from './types.js';

// Keep in sync with package.json "version" — a `initialize` response naming a version the server is
// not is the same class of untruth as a stale row on /releases. It drifted to 0.1.4 while the package
// was 0.1.5, so the live Worker introduced itself as the previous build.
// Keep in step with package.json + python/pyproject.toml. This drifted once and mcp.cendor.ai
// introduced itself as 0.1.4 for three releases; the workspace gate `scripts/check-versions.mjs`
// now asserts it against the version source.
export const SERVER_VERSION = '0.1.7';
// Every spec revision this stateless dispatch implements. initialize clamps to this set — a
// server must never echo a version it doesn't actually speak (MCP lifecycle: respond with the
// requested version only if supported, otherwise the latest one the server supports).
export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;
export const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
export const SERVER_INFO = {
  name: 'cendor-mcp',
  title: 'Cendor docs',
  version: SERVER_VERSION,
} as const;

export const SERVER_INSTRUCTIONS =
  'Cendor docs, live. Use get_api(symbol) before writing any Cendor call — it returns the current ' +
  'correct call-shape and the common wrong one. search_docs/get_page for concepts, example(task) ' +
  'for runnable snippets, list_recipes for the cookbook. Read-only; nothing you send is stored.';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const ok = (id: string | number | null, result: unknown): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  result,
});
const err = (id: string | number | null, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

/** Public tool descriptors for tools/list (no handler). */
export function toolDescriptors(tools: ToolDef[]) {
  return tools.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

/**
 * Handle one JSON-RPC message. Returns a response object, or `null` for notifications (the caller
 * should reply with HTTP 202 and no body).
 */
export function handleRpc(msg: JsonRpcRequest, tools: ToolDef[]): JsonRpcResponse | null {
  const isNotification = msg.id === undefined || msg.id === null;
  const id = msg.id ?? null;
  const method = msg.method;

  // Notifications (e.g. notifications/initialized): acknowledge with no body.
  if (isNotification) return null;

  switch (method) {
    case 'initialize': {
      const requested =
        typeof msg.params?.protocolVersion === 'string'
          ? (msg.params.protocolVersion as string)
          : DEFAULT_PROTOCOL_VERSION;
      const negotiated = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
        ? requested
        : DEFAULT_PROTOCOL_VERSION;
      return ok(id, {
        protocolVersion: negotiated,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: toolDescriptors(tools) });
    case 'tools/call': {
      const name = msg.params?.name;
      if (typeof name !== 'string') return err(id, -32602, 'Invalid params: missing tool name');
      const tool = tools.find((t) => t.name === name);
      if (!tool) return err(id, -32602, `Unknown tool: ${name}`);
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      try {
        const text = tool.handler(args);
        return ok(id, { content: [{ type: 'text', text }] });
      } catch (e) {
        return ok(id, {
          content: [{ type: 'text', text: `Error running ${name}: ${(e as Error).message}` }],
          isError: true,
        });
      }
    }
    default:
      return err(id, -32601, `Method not found: ${method}`);
  }
}
