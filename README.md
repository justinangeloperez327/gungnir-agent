# Gungnir Agent

A Gungnir-aware coding agent foundation for the [Gungnir C++23 framework](https://github.com/justinangeloperez327/gungnir).

> **Group 2 foundation:** typed task and tool contracts, dependency injection, validated configuration, structured errors and an in-memory task state machine. **No** AI model calls, file edits, compiler invocation, executable tool policy or MCP endpoint are implemented yet.

## Requirements

Node.js **24** and compatible npm. The Gungnir SDK will be needed only for later native integration.

## Setup

```bash
npm ci
npm run check
npm run start -- --help
npm run start -- --version
```

The `ask`, `plan` and `build` commands are **not yet implemented**; invoking them returns a nonzero status.

## Workspaces

- `apps/cli`: help/version entry point.
- `packages/contracts`: task and tool types, capability descriptors and execution interfaces.
- `packages/agent-core`: typed DI container, validated configuration, domain errors, task lifecycle.
- `packages/gungnir-toolchain`: declared Gungnir 1.0 contract; native SDK detection planned for Group 3.
- `tests`: unit tests, CLI smoke tests, and security regressions.

Gungnir's native compiler and LSP will remain the language-semantic authority. Configuration is not authorization: Group 4 will implement workspace trust and enforce a process/file access policy.

See [architecture](docs/architecture.md), [Group 2 contracts](docs/group-2-contracts.md), and the [20-group roadmap](docs/roadmap.md).

CI checks Windows/Ubuntu and **never auto-publishes or deploys**.
