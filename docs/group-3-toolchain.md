# Group 3 — native Gungnir SDK detection

The discovery API is `discoverToolchain(options?, io?)` from `@gungnir/gungnir-toolchain`. It takes explicit, injected `ProbeIO` for deterministic tests on Linux and Windows.

## Selection priority

1. `executablePath`: absolute path to `gungnir` / `gungnir.exe`.
2. `sdkRoot`: absolute root containing `bin/gungnir`.
3. `GUNGNIR_CMAKE_PREFIX` environment variable.
4. Absolute entries on PATH.

Explicit overrides must be valid and never silently fall back. Blank or relative PATH entries are skipped. The compiler is located next to the chosen CLI, avoiding cross-SDK mixing.

## Read-only detection

- `gungnir --version` expects `Gungnir <version>`.
- `gungnirc --version` expects `Gungnir compiler <version>`.
- `gungnirc --print-contract` yields stable key-value fields: package_version, language_version, compiler_contract, diagnostic_contract, structured_feature_freeze, compatibility.
- Contract 1.0, stable compatibility, feature freeze and matching package versions are required.
- The adjacent SDK must include the native header, CMake package and `share/gungnir/sdk.txt` with `profile=core` or `profile=application`.

Known statuses: `ready`, `partial`, `missing`, `invalid`, `incompatible`. Only `ready` reports `nativeBuild: true`. A detected application profile is descriptive, not a proof that a database or other external adapter is configured.

## Safety and limits

`doctor` is an explicit opt-in; CLI help/version never spawn native binaries. Only fixed `--version` and `--print-contract` argument arrays are used, with shell disabled, bounded timeouts and output buffers. No build, tests, model calls, SDK downloads or source modifications occur. Probe failures never echo arbitrary process output or exception detail.

**Important:** PATH lookup and user-specified executable paths are not a permission boundary. A malicious executable on PATH can still run when a user invokes `doctor`. Group 4 must implement realpath, workspace trust, executable authorization, and process-policy enforcement before making probes/tools callable autonomously.

## Scope boundary

This is metadata/capability detection. It does not compile source or validate project files. Group 4 handles authorization and cancellation, Group 13 compiler diagnostics, and Group 14 native builds.
