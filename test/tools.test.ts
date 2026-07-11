import { describe, expect, it } from 'vitest';
import { INDEX } from '../src/index-data.js';
import { type JsonRpcRequest, handleRpc } from '../src/rpc.js';
import { searchDocs } from '../src/search.js';
import { buildTools } from '../src/tools.js';
import type { ToolDef } from '../src/types.js';

const tools = buildTools(INDEX);
const call = (name: string, args: Record<string, unknown> = {}): string => {
  const t = tools.find((x) => x.name === name) as ToolDef;
  return t.handler(args);
};

describe('index', () => {
  it('is built from the sibling docs (never copied)', () => {
    expect(INDEX.pages.length).toBeGreaterThan(20);
    expect(INDEX.chunks.length).toBeGreaterThan(50);
    expect(INDEX.traps.length).toBeGreaterThan(10);
    expect(INDEX.examples.length).toBe(7);
    expect(new Set(INDEX.pages.map((p) => p.product))).toContain('sdk');
  });

  it('carries published versions from the /releases source of truth', () => {
    const tg = INDEX.versions.libraries.find((r) => r.name === 'tokenguard');
    expect(tg?.pypiVer).toMatch(/^\d+\.\d+\.\d+$/);
    expect(tg?.npmVer).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('search', () => {
  it('finds real doc chunks with cendor.ai URLs', () => {
    const hits = searchDocs(INDEX, 'guardrails block input', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.url.startsWith('https://cendor.ai/docs'))).toBe(true);
  });
});

describe('the five tools', () => {
  it('exposes exactly the five read-only tools', () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      'example',
      'get_api',
      'get_page',
      'list_recipes',
      'search_docs',
    ]);
  });

  it('search_docs returns matches with URLs', () => {
    const out = call('search_docs', { query: 'budget a loop', limit: 4 });
    expect(out).toContain('https://cendor.ai/');
  });

  it('get_api("budget","ts") returns the curried TS shape (anti-hallucination)', () => {
    const out = call('get_api', { symbol: 'budget', lang: 'ts' });
    expect(out).toContain('budget(cfg)(fn)');
    expect(out).not.toContain('- **Python**'); // lang filter applied
    expect(out).toContain('/releases'); // version footer
  });

  it('get_api("prices.estimate") flags the positional-vs-options divergence', () => {
    const out = call('get_api', { symbol: 'prices.estimate' });
    expect(out.toLowerCase()).toContain('positional');
    expect(out).toContain('outputTokens');
  });

  it('get_api("SqliteSessionStore") finds the casing trap', () => {
    const out = call('get_api', { symbol: 'SqliteSessionStore' });
    expect(out).toContain('SqliteSessionStore');
    expect(out).toContain('SQLiteSessionStore');
  });

  it('get_page("tokenguard") returns the page with its source URL', () => {
    const out = call('get_page', { slug: 'tokenguard' });
    expect(out).toContain('Source: https://cendor.ai/docs/tokenguard');
  });

  it('get_page("sdk/agents") returns the SDK page', () => {
    const out = call('get_page', { slug: 'sdk/agents' });
    expect(out).toContain('https://cendor.ai/docs/sdk/agents');
  });

  it('example("budget a loop","python") returns a runnable @budget snippet', () => {
    const out = call('example', { task: 'budget a loop', lang: 'python' });
    expect(out).toContain('```python');
    expect(out).toContain('@budget');
    expect(out).not.toContain('```ts\n');
  });

  it('list_recipes links out to the cookbook', () => {
    const out = call('list_recipes');
    expect(out).toContain('https://cendor.ai/cookbook/');
    expect(out).toContain('github.com/cendorhq/cendor-cookbook');
  });
});

describe('JSON-RPC dispatch (Worker transport)', () => {
  const rpc = (msg: JsonRpcRequest) => handleRpc(msg, tools);

  it('initialize echoes the protocol and advertises tools', () => {
    const res = rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18' },
    });
    expect(res?.result).toMatchObject({
      protocolVersion: '2025-06-18',
      serverInfo: { name: 'cendor-mcp' },
    });
  });

  it('tools/list returns five tools with JSON-Schema inputs', () => {
    const res = rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const list = (res?.result as { tools: unknown[] }).tools;
    expect(list.length).toBe(5);
  });

  it('tools/call runs get_api', () => {
    const res = rpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'get_api', arguments: { symbol: 'instrument' } },
    });
    const content = (res?.result as { content: { text: string }[] }).content;
    expect(content[0]?.text).toContain('instrument');
  });

  it('a notification (no id) gets no response', () => {
    const res = rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(res).toBeNull();
  });

  it('unknown method → JSON-RPC -32601', () => {
    const res = rpc({ jsonrpc: '2.0', id: 9, method: 'does/not/exist' });
    expect(res?.error?.code).toBe(-32601);
  });
});
