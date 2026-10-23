# Implementation roadmap — 20 groups

This is the reviewed development plan. A group is complete only when its code and validation gates pass.

## Phase I: foundation

1. **Repository and CI:** Node.js 24, npm workspaces, TS, lint, Vitest, baseline CLI, documentation.
2. **Contracts:** core interfaces, dependency injection, typed failures, configuration.
3. **Toolchain:** SDK discovery, versions, installed language contracts, capability negotiation.
4. **Permissions:** trusted roots, safe process runner, authorization boundaries, cancellation.
5. **Context:** project discovery, `.gnr` indexing, module metadata, file search.

## Phase II: agent intelligence

6. **MCP:** stdio server, read-only tools and resources, integration tests.
7. **CLI:** interactive Ask/Plan/Build UX, streaming and error display.
8. **Model adapters:** AI SDK v6 integration, providers, credential handling, budgets.
9. **Knowledge:** docs, examples, symbol/context retrieval, citation of source paths.
10. **Task engine:** planner, bounded tool calls, task lifecycle and session recovery.

## Phase III: native coding

11. **Generators:** native project/component scaffolding.
12. **Editing:** previewable multi-file patches, concurrency checks and rollback.
13. **Diagnostics:** compiler checks, IR verification and LSP integration.
14. **Build/tests:** native build, selected test execution, fixture management.
15. **Repair:** bounded compiler-guided fix/recheck loop.

## Phase IV: integration and release

16. **Skills:** portable agent instructions and MCP host templates.
17. **VS Code:** compatibility with existing `vscode-gungnir` (no duplicate parser).
18. **Evaluation:** reproducible creation, debugging, refactoring and security tasks.
19. **Hardening:** injection tests, Windows/Linux reliability, performance and budget limits.
20. **Release:** packaging, install docs, manual approval, final CI.

## Group 1 gate

- `npm ci` from a clean checkout.
- `npm run lint`, `npm run build`, `npm run typecheck:tests`, `npm test`.
- Windows and Ubuntu CI.
- Version/help CLI smoke tests.
- No automatic publishing or deployment.
