# Implementation roadmap — 20 groups

Groups are complete only after their code and CI verification pass.
Gungnir MCP is a **separate existing product**: project context tools should
be registered there, not implemented as a competing stdio server here.

## Phase I: foundation

1. **Repository and CI — complete**: Node 24, npm workspaces, TS, lint, Vitest.
2. **Core contracts — complete**: DI, typed failures and configuration.
3. **Toolchain — complete**: SDK discovery, version/contract negotiation.
4. **Permissions — complete**: trusted roots, host approval, restricted runner.
5. **Context — complete**: `.gnr` indexing and read-only search.

## Phase II: agent intelligence

6. **MCP client integration — complete (agent-side)**: official MCP v2
   client and real-server interoperability, read-only local context adapter.
   Exposing project context over MCP still depends on the existing
   **gungnir-mcp Project Intelligence group**.
7. **CLI**: interactive Ask, Plan, Build with streaming.
8. **Models**: AI SDK v6 providers, credentials, limits.
9. **Retrieval**: docs, examples, citations and symbol sources.
10. **Task orchestration**: bounded planner and session lifecycle.

## Phase III: native coding

11. **Generators**: invoke native Gungnir project/component scaffolding.
12. **Patches**: conflict-aware, atomic edits and rollback.
13. **Diagnostics**: native compiler checks/IR verification and LSP.
14. **Build/test**: native builds, targeted tests and fixtures.
15. **Repair**: bounded compiler-guided fix loop.

## Phase IV: integration and release

16. **Skills**: portable instructions and MCP configuration.
17. **VS Code**: use existing vscode-gungnir integration and LSP.
18. **Evaluation**: repeatable CRUD/refactor/debugging cases.
19. **Security**: additional injection, performance and OS hardening.
20. **Packaging**: docs, manual release and final CI.

No automatic deployment or publishing.
