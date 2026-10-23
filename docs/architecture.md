# Architecture — Groups 1–4

```text
apps/cli
  -> packages/agent-core
       -> packages/contracts
       -> packages/gungnir-toolchain
  -> packages/gungnir-toolchain (opt-in doctor)
```

Group 2 introduces typed config, DI and task state. Group 3 provides read-only
Gungnir SDK discovery. Group 4 adds `TrustedWorkspace`,
`DefaultExecutionPolicy`, `enforcePermission` and
`ControlledProcessRunner` to the agent core.

No public agent modes or model-facing execution tools are registered yet.
A Build mode string or ToolRequest is never itself authorization. The host
must supply trust and explicit permission for each requested process or write.

Gungnir's native compiler and language server remain the authority for `.gnr`
semantics. Groups 5–6 add context and read-only MCP; Groups 11–15 add
generators, transactional file writes, diagnostics, builds and repair.

## Remaining security work

Group 4's path authorization is a preflight only; do not use it as a substitute
for atomic no-follow file writes or process isolation. The approved runner is
not a sandbox and cannot prevent an authorized executable from accessing files
outside the workspace or creating descendant processes. Git writes, migrations,
deployments and publishing remain denied by default.
