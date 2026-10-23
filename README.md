# Gungnir Agent

A standalone, Gungnir-aware coding agent foundation for the [Gungnir C++23 framework](https://github.com/justinangeloperez327/gungnir).

> **Group 1 / foundation only.** This repository currently provides a typed monorepo, a CLI help/version entry point, tests, and CI. It **does not yet** generate code, use AI models, run compiler checks, expose MCP tools, or modify projects.

## Requirements

- Node.js **24**
- npm compatible with Node.js 24
- A Gungnir SDK is **not required** for Group 1. Future native integrations will validate the SDK and language contract before use.

## Getting started

```bash
npm ci
npm run lint
npm run build
npm run typecheck:tests
npm test
npm run start -- --help
```

The Group 1 CLI can display help and version information:

```bash
npm run start -- --version
npm run start -- --help
```

The `ask`, `plan`, and `build` modes are reserved for later implementation groups. Unsupported commands intentionally exit nonzero.

## Workspace layout

- `apps/cli`: standalone command-line entry point.
- `packages/contracts`: shared, stable TypeScript shapes.
- `packages/gungnir-toolchain`: language-contract foundation; native discovery arrives in Group 3.
- `packages/agent-core`: agent foundation metadata and future coordination boundary.
- `tests`: first-party unit and CLI smoke coverage.
- `docs`: architecture, roadmap, release gates.

## Architecture constraints

Gungnir's own compiler and LSP will remain authoritative for `.gnr` language semantics. The agent will eventually use the installed `gungnir`/`gungnirc` binaries; it will not maintain a duplicate parser. All file writes, subprocesses, migrations, Git actions, and deployment actions must pass an explicit, testable permission policy before execution.

Read [architecture](docs/architecture.md) and the [20-group roadmap](docs/roadmap.md).

## Delivery policy

CI runs on pull requests and pushes. It never auto-publishes packages, deploys an app, pushes generated changes, or releases binaries. Releases require an explicit manual approval.
