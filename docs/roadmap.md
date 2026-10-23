# Implementation roadmap — 20 groups

Each group is complete only after implementation and CI checks.
The existing `gungnir-mcp` remains the sole official MCP server.

## Phase I: foundation

1. Repository and CI — complete
2. Core contracts, DI and config — complete
3. Native Gungnir toolchain discovery — complete
4. Workspace trust and execution policy — complete
5. Bounded `.gnr` project indexing — complete

## Phase II: intelligence and interfaces

6. MCP client interoperability — complete (agent-side; remote project
   browsing awaits the external `gungnir-mcp` implementation).
7. Interactive CLI — complete: mode switching, trusted local inspection,
   streamed text events and cancellation; no model providers yet.
8. Model adapters — complete: AI SDK v6 streaming, OpenAI/Anthropic/Gateway, environment credentials, per-session budgets. Build is text-only.
9. Docs, examples, retrieval and source references.
10. Task orchestration, bounded execution and session recovery.

## Phase III: native coding

11. Native Gungnir generators.
12. Atomic, conflict-aware patch previews and rollback.
13. Native compiler/IR and LSP diagnostics.
14. Native builds and targeted tests.
15. Bounded compiler-guided repair.

## Phase IV: integration/release

16. Skills and reusable agent instructions.
17. Existing `vscode-gungnir` integration.
18. Evaluation and reproducible regression fixtures.
19. Security/performance/Windows/Linux hardening.
20. Packaging, documentation and manual release.

No automatic deployment or publication.
