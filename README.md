# Gungnir Agent

A Gungnir-aware coding agent foundation for the [Gungnir C++23 framework](https://github.com/justinangeloperez327/gungnir).

> **Group 3:** The agent now detects an installed Gungnir CLI/compiler, SDK metadata, package versions and the structured compiler contract. No AI model calls, file edits, builds, MCP endpoint or general process execution are enabled.

## Requirements

- Node.js **24**
- npm
- Gungnir SDK is optional for package development; required for a successful `doctor` result.

## Setup

```bash
npm ci
npm run check
npm run start -- --help
npm run start -- doctor
npm run start -- doctor --json
```

`doctor` is explicitly invoked, read-only, and returns exit status 0 only when a matching, complete stable Gungnir 1.0 SDK is detected. It does not modify project files, start a development server, or download an SDK.

To select a Gungnir SDK, set the absolute `GUNGNIR_CMAKE_PREFIX` to its root (not `bin`) or put its `bin` directory on PATH. SDK discovery prioritizes explicit configuration, then `GUNGNIR_CMAKE_PREFIX`, then PATH. Invalid explicit configuration does not fall back silently.

`ask`, `plan` and `build` remain unimplemented CLI commands.

## Monorepo

- `apps/cli` — help, version, opt-in doctor.
- `packages/agent-core` — typed config, DI, task states and errors.
- `packages/contracts` — future task/tool interfaces.
- `packages/gungnir-toolchain` — read-only SDK discovery, probes, contract parsing.
- `tests` — cross-platform fixtures, CLI and contract tests.

See [Group 3 documentation](docs/group-3-toolchain.md), [architecture](docs/architecture.md) and [roadmap](docs/roadmap.md).

CI checks Windows and Ubuntu on Node.js 24 and never publishes or deploys.
