# Architecture — initial foundation

## Scope

Group 1 establishes TypeScript package interfaces and a CLI shell. No language model, Gungnir subprocess, code-writing tool, or MCP endpoint exists in this group.

Current package dependencies:

```text
apps/cli
  -> packages/agent-core
       -> packages/contracts
       -> packages/gungnir-toolchain
```

The shared contracts describe **planned** agent modes, not yet available capabilities. Dependencies point from entry points to abstractions; the CLI must not acquire its own compiler/parser implementation.

## Native Gungnir integration (future)

- Group 3: executable/SDK discovery and `gungnirc --print-contract`.
- Group 4: enforce workspace trust and process-approval policies.
- Group 6: read-only MCP server, separately exposing the same core tool layer.
- Group 13: compiler and LSP diagnostics.
- Group 14: `gungnir build` and feature tests.
- Group 15: bounded error-repair loops.

The Gungnir compiler and LSP are the language-semantic authority. No TypeScript substitute lexer, parser, compiler, or speculative refactor engine should be introduced.

## Security invariants

1. All paths are canonicalized and checked against an authorized workspace boundary.
2. External commands always use executable + argument arrays; no unbounded shell execution.
3. Ask/Plan cannot write files or start modifying commands.
4. Build operations require explicit execution policy; high-impact operations need explicit approval.
5. Model output, local source comments, tool results, and fetched documents are untrusted input.
6. Credentials are excluded from prompts, logs, diffs, and test reports.
7. All retries, process lifetimes, token budgets, and task sessions must have enforceable limits.
8. The repo's CI must never auto-publish or deploy.
