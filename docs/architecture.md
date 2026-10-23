# Architecture — Groups 1–2

```text
apps/cli
  -> packages/agent-core
       -> packages/contracts
       -> packages/gungnir-toolchain
```

Group 2 adds shared tool/task interfaces and a minimal, synchronous agent-core foundation. CLI remains help/version only. There is no model integration, executable tool runner, file-writing implementation or MCP server.

## Separation of responsibilities

- **Contracts:** descriptive modes/capabilities and cancellable tool invocation interfaces.
- **Agent core:** pure config validation, typed DI, sanitized errors and in-memory task lifecycle.
- **Gungnir toolchain:** version target only. SDK discovery and compatibility negotiation are Group 3.
- **Authorization:** not yet implemented. A `build` mode string must never authorize execution.

## Forward requirements

Group 4 must enforce canonical workspace paths, symlink boundaries, explicit tool permissions, safe process arguments, timeout and cancellation. Generated code must be compiled using the native Gungnir toolchain rather than a duplicate TypeScript parser. Prompt content and tool results are untrusted and secrets must not enter public errors or logs. CI must never auto-publish or deploy.
