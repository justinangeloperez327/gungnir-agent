# Architecture — Groups 1–5

```text
apps/cli
  -> packages/agent-core
       -> packages/contracts
       -> packages/gungnir-toolchain
  -> packages/gungnir-toolchain (explicit doctor)
```

- Group 2: typed configuration, DI, sanitized errors and task states.
- Group 3: read-only SDK discovery and compiler contract detection.
- Group 4: trusted workspace, permission engine, controlled process runner.
- Group 5: `GungnirProjectIndex` — bounded, read-only source discovery,
  file-category metadata, path/module hints, filename/source-line lookup.

The CLI still only supports help/version/doctor. Ask/Plan/Build, MCP and
model-driven tools remain unimplemented; no model can invoke the process runner.

## Module intelligence boundary

The index is a bounded navigation aid, not another Gungnir grammar parser.
Module path and import metadata are **unverified hints**; semantically resolved
dependencies, symbols, references and diagnostics come from the C++ compiler
and native LSP in later groups.

## Security limitations

Group 4's path checks and Group 5's scan are best effort, not an OS sandbox.
No automatic source-to-LLM forwarding is allowed; future prompt construction
must treat indexed text as untrusted and may need secret scrubbing. No external
downloads, application builds, auto-publishing or deployment take place.
