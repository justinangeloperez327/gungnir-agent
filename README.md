# Gungnir Agent

A Gungnir-aware coding agent foundation for the
[Gungnir C++23 framework](https://github.com/justinangeloperez327/gungnir).

> **Group 6:** Trusted `.gnr` context search and an outbound MCP v2 client
> bridge are available. The MCP stdio server remains in the separate,
> existing [gungnir-mcp](https://github.com/justinangeloperez327/gungnir-mcp)
> repository. No AI calls, autonomous edits or operational Ask/Plan/Build
> commands are enabled.

## Requirements

Node.js 24 and compatible npm. Gungnir SDK optional for package development.

```bash
npm ci
npm run check
npm run start -- --help
npm run start -- doctor
```

## Components

- `apps/cli`: help, version, opt-in SDK doctor
- `packages/contracts`: typed task/tool interfaces
- `packages/agent-core`: trusted workspace, policy, state and source index
- `packages/gungnir-toolchain`: SDK/compiler detection
- `packages/mcp-client`: official MCP v2 client for **gungnir-mcp**
  and a local read-only project context adapter

**MCP server availability:** the pinned gungnir-mcp v0.4.0 exports
`gungnir_status` and `gungnir_toolchain_info`. Project indexing/search
adapters exist locally here but are not yet registered as MCP server tools.
See [Group 6 integration](docs/group-6-mcp.md).

CI validates Node 24, Windows/Linux, and real MCP server interoperability.
No automatic publishing or deployment is configured.
