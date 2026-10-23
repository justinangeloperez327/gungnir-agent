# Architecture — Groups 1–7

```text
apps/cli (mode-aware shell, operator commands, text event renderer)
  -> packages/agent-core (tasks, trusted workspace, policy)
  -> packages/mcp-client (read-only context adapter, outbound MCP v2)
  -> packages/gungnir-toolchain (opt-in SDK doctor)

external: justinangeloperez327/gungnir-mcp (separate stdio server)
```

Group 7 introduces an interactive UI layer, with a `TextStreamBackend`
interface for later model providers. **No provider is installed**.
The shell uses Group 6's `ReadOnlyContextAdapter` for project browsing,
requiring explicit operator workspace trust. It never launches MCP
automatically, executes compiler commands, or performs file writes.

Mode is a descriptive session setting. Any future tool execution must
pass the independent Group 4 authorization checks, and high-risk actions
remain blocked. Group 8 will introduce the actual model adapter,
Group 9 retrieval controls and Group 10 durable task orchestration.
