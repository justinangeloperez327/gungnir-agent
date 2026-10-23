# Group 6 — MCP integration (agent-side)

## Ownership: one MCP server

The authoritative MCP stdio server is maintained separately in
[justinangeloperez327/gungnir-mcp](https://github.com/justinangeloperez327/gungnir-mcp).
Gungnir Agent must **not** register a competing stdio MCP server or copy its protocol logic.

`@gungnir/mcp-client` connects to that server using the official MCP SDK v2.
The pinned interoperability target is **gungnir-mcp commit
0ebdf784ab08ff97baffe9965d7de9c7e0a93674**, currently v0.4.0.

## Trust and calls

- The trusted embedding host creates a `TrustedWorkspace` and provides a
  canonical absolute server entry path. Untrusted MCP request arguments cannot
  change the project root or native executable.
- A trusted host must explicitly approve the specific Node process + argv
  before the session connects. No AI-generated approval.
- The bridge currently recognizes only `gungnir_status` and
  `gungnir_toolchain_info`; other server tools are blocked.
- Both legacy initialize and modern 2026-07-28 MCP protocols are tested with
  the real server on Windows and Ubuntu.
- The server gets a deliberately limited environment. Secrets/provider tokens
  are not forwarded by default.
- Close the bridge to shut down its stdio child process. Model-driven usage
  is disabled until tool orchestration and trust gating are implemented.

## Read-only project context contract

`ReadOnlyContextAdapter` wraps Group 5's trusted `GungnirProjectIndex`
and exposes `overview`, `search` and `excerpt` as internal,
typed, read-only handlers. Search results contain no snippets by default.
The adapter never accepts a project-root argument from tool requests.

**Integration boundary:** As of gungnir-mcp v0.4.0, these three project
context operations are **not MCP server tools yet**. They become remotely
callable only when the external gungnir-mcp repository implements and tests
their official MCP registrations in its Project Intelligence group. This
agent-side Group 6 does not falsely advertise unavailable server tools.

## Verification

`npm test` validates the adapter locally. GitHub CI additionally checks out
the pinned gungnir-mcp revision, builds the real Node 24 server, and runs
`tests/mcp-client.integration.test.ts` with
`GUNGNIR_MCP_SERVER_ENTRY` supplied explicitly.

No source writes, native application builds, automatic npm publishing,
deployments or autonomous MCP calls are enabled.
