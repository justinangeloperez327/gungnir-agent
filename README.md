# Gungnir Agent

A Gungnir-aware coding agent foundation for the
[Gungnir C++23 framework](https://github.com/justinangeloperez327/gungnir).

> **Group 5:** Trusted project discovery, bounded `.gnr` source indexing,
> path-based module metadata and read-only context search are implemented.
> This is **not yet an operational autonomous coding agent**. No AI calls,
> autonomous edits, MCP endpoint, or Gungnir compiler runs are enabled.

## Requirements

Node.js 24 and compatible npm. Gungnir SDK optional for package development;
required only for a successful opt-in doctor result.

```bash
npm ci
npm run check
npm run start -- --help
npm run start -- doctor
npm run start -- doctor --json
```

`ask`, `plan` and `build` CLI commands remain unavailable. `doctor`
is opt-in and may execute binaries selected by the local PATH or SDK settings.

## Package responsibilities

- `apps/cli`: help/version and opt-in SDK compatibility doctor
- `packages/contracts`: typed task/tool interfaces
- `packages/agent-core`: DI, state, security and local Gungnir project indexing
- `packages/gungnir-toolchain`: SDK discovery and compiler contract checks

`GungnirProjectIndex.scan(trustedWorkspace)` provides local metadata and
bounded source-line search. Inferred module/import hints are **not verified**
by the compiler. No source is forwarded to an LLM.

See [Group 5 context API](docs/group-5-context.md),
[architecture](docs/architecture.md) and [20-group roadmap](docs/roadmap.md).

Windows/Ubuntu GitHub Actions uses Node.js 24. No automatic publishing or
deployment.
