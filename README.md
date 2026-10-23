# Gungnir Agent

A Gungnir-aware coding agent foundation for the
[Gungnir C++23 framework](https://github.com/justinangeloperez327/gungnir).

> **Group 4:** The project now has explicit workspace trust and path checks,
> fail-closed permissions, per-command host approval and a bounded child
> process runner. This is infrastructure, **not an operational AI agent**.
> No AI model calls, autonomous edits or MCP endpoint are implemented.

## Requirements

- Node.js 24 and compatible npm
- Gungnir SDK optional for package development; needed for a successful doctor result

## Setup

```bash
npm ci
npm run check
npm run start -- --help
npm run start -- doctor
npm run start -- doctor --json
```

`doctor` performs explicit SDK compatibility probes. Do not run it on
untrusted executable paths. `ask`, `plan` and `build` remain unimplemented.

## Components

- `apps/cli`: help, version and opt-in toolchain doctor
- `packages/contracts`: typed task/tool interfaces
- `packages/agent-core`: configuration, DI, errors, task lifecycle and
  security components
- `packages/gungnir-toolchain`: SDK discovery and compiler contract probing

The security layer is not an OS sandbox: externally approved processes execute
with the user's privileges. Future code-writing and model-execution integrations
must enforce host permissions and atomic filesystem operations.

Read the [Group 4 security contract](docs/group-4-security.md),
[architecture](docs/architecture.md) and [roadmap](docs/roadmap.md).

Windows/Ubuntu GitHub Actions uses Node 24. There is no automatic publishing
or deployment.
