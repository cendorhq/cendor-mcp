# cendor-mcp (Python)

The Python / `uvx` twin of the read-only [Cendor](https://cendor.ai) docs MCP server. Same five
read-only tools and the same answers as `npx @cendor/mcp` and the remote `mcp.cendor.ai` Worker — it
reads the same generated docs index (built from the docs source of truth, never a copy of the docs).

```bash
uvx cendor-mcp        # run the stdio MCP server (fully offline)
```

Wire it into your agent-mode assistant (Claude Code / Cursor / Copilot / Windsurf):

```json
{ "mcpServers": { "cendor": { "command": "uvx", "args": ["cendor-mcp"] } } }
```

Tools: `search_docs`, `get_page`, `get_api` (the anti-hallucination call-shape lookup), `example`,
`list_recipes`. Read-only and pull-based — nothing you send is stored; your codebase never leaves your
machine.

Full setup for every assistant (remote + local): **<https://cendor.ai/mcp>**. Honest limit: MCP is
called by *agent* modes only — inline autocomplete uses the types Cendor ships in each package
([`/docs/for-ai-assistants`](https://cendor.ai/docs/for-ai-assistants)).

Apache-2.0. Source + maintainer notes: <https://github.com/cendorhq/cendor-mcp>.
