# Security Policy

We take the security of the Cendor projects seriously. Thank you for helping keep them and their
users safe.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities privately through **GitHub Private Vulnerability Reporting**: open the
**Security** tab of this repository
(<https://github.com/cendorhq/cendor-mcp/security/advisories/new>) and choose **Report a
vulnerability**. This creates a private advisory only the maintainers can see, and lets us
collaborate on a fix and coordinate disclosure with you.

If Private Vulnerability Reporting is not enabled here, open a **draft security advisory** on any
Cendor repository under `cendorhq` and we will route it.

Please include, where you can:

- the affected artifact(s) and version(s) — `@cendor/mcp` (npm), `cendor-mcp` (PyPI), or the
  `mcp.cendor.ai` Worker,
- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- any known mitigations.

## Scope

This repository ships **optional developer tooling**, not a Cendor library. That shapes the threat
model, and it is worth being precise about, because two different deployment shapes live here:

- **Local (`npx @cendor/mcp`, `uvx cendor-mcp`).** A stdio process on the developer's own machine.
  The docs index is **bundled at build time**, so the server is fully offline — it makes no network
  calls and reaches no Cendor-operated service.
- **Remote (`https://mcp.cendor.ai`).** A stateless Cloudflare Worker serving the same bundled index
  over Streamable HTTP. It stores nothing.

The server is **read-only and pull-based**. It answers tool calls; it never initiates server→client
requests (no `sampling`, no `elicitation`), never writes to the client, and never receives your
codebase — only the tool arguments your assistant chooses to send. Relevant classes of issues include,
for example: a tool handler that could be induced to read outside the bundled index, unsafe handling
of a crafted JSON-RPC message, a supply-chain problem in the published npm/PyPI artifacts, or
content injected into an answer through the docs build.

**The Cendor libraries themselves need no server.** They are local-first and no library depends on
this one, so a problem here cannot reach a `cendor-*` / `@cendor/*` runtime. Vulnerabilities in the
libraries belong on those repositories.

## What to expect

- We aim to acknowledge a report within a few business days.
- We'll work with you on a fix and a coordinated disclosure timeline, and credit you in the advisory
  unless you prefer to remain anonymous.

## Supported versions

Fixes land on the latest released version. `@cendor/mcp` and `cendor-mcp` are versioned together and
released from the same commit, so a fix ships to npm and PyPI on the same version number; the
`mcp.cendor.ai` Worker redeploys from `main`.
