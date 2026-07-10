"""Console entry point: `cendor-mcp` (via `uvx cendor-mcp`). Runs the stdio MCP server."""

from __future__ import annotations

import asyncio

from .server import serve


def main() -> None:
    try:
        asyncio.run(serve())
    except KeyboardInterrupt:  # pragma: no cover - normal Ctrl-C shutdown
        pass


if __name__ == "__main__":
    main()
