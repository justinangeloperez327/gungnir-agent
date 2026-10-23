# Architecture — Groups 1–3

```text
apps/cli
  -> packages/agent-core
       -> packages/contracts
       -> packages/gungnir-toolchain
  -> packages/gungnir-toolchain (doctor)
```

Group 2 provides typed configuration, DI, error handling and in-memory task states. Group 3 adds optional, read-only native Gungnir toolchain discovery with injectable probe I/O, fixed command arguments and contract parsing.

- `apps/cli`: help/version and explicitly invoked `doctor`. No agent modes run.
- `packages/gungnir-toolchain`: installed CLI/compiler discovery, SDK profile inspection, version/contract compatibility.
- `packages/agent-core`: no process execution orchestration or runtime authorizations yet.
- `packages/contracts`: descriptive tool capabilities and future policy interfaces.

A `ready` toolchain report says the installed SDK matches the documented Gungnir 1.0 contract. It does not imply any project has compiled or that arbitrary process execution is safe. The compiler and LSP remain the authority for language semantics; no duplicate Gungnir parser is planned.

Security work remains in Group 4: canonical workspace/executable paths, permission enforcement, subprocess containment, timeout/cancellation and trust gates. No model output can currently initiate native commands.
