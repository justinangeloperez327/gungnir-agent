# Gungnir Agent

A Node.js 24 coding-agent foundation for the
[Gungnir C++23 framework](https://github.com/justinangeloperez327/gungnir).

> **Group 7:** Interactive CLI modes (Ask, Plan, Build), piped sessions,
> streamed text rendering, cancellation and trusted read-only `.gnr`
> browsing are implemented. **No model backend is connected yet.**
> Text prompts return an explicit unavailable-model message until Group 8.

## Setup

```bash
npm ci
npm run check
npm run start -- interactive
npm run start -- ask
npm run start -- plan --message "Design a Gungnir User model"
npm run start -- doctor
```

To inspect an explicitly trusted Gungnir project:

```bash
npm run start -- interactive --project-root /absolute/project --trust-workspace
```

Within the shell, use `/help`, `/mode`, `/status`, `/files`,
`/search`, `/read`, `/cancel`, and `/exit`.
No source edits or arbitrary subprocess execution are enabled.

## Package responsibilities

- `apps/cli`: interactive shell, mode commands, streaming and cancellation
- `packages/contracts`: agent task/tool interfaces
- `packages/agent-core`: validated config, workspace trust, indexed source context
- `packages/gungnir-toolchain`: native SDK and compiler contract discovery
- `packages/mcp-client`: official MCP v2 bridge to the separate
  [gungnir-mcp](https://github.com/justinangeloperez327/gungnir-mcp) server

MCP project-context tools are still dependent on the separate server's
Project Intelligence implementation; local CLI browsing works directly
through the trusted Group 5 index and Group 6 adapter.

See [Group 7 CLI](docs/group-7-cli.md),
[architecture](docs/architecture.md) and [roadmap](docs/roadmap.md).

CI validates Windows 2025 and Ubuntu 24.04 with Node.js 24.
No PRs, automatic publication or deployment.
