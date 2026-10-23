# Group 2 — core contract reference

## Type contracts

`AgentMode` declares `ask | plan | build`. `ToolRequest`, `ToolResult`, `ToolExecutor` and `ExecutionPolicy` are future tool abstractions: no executable policy or tool runner is installed. High-impact capabilities are distinct from read, write and generic process capabilities. `PublicAgentError` permits sanitized error serialization.

## Implemented core

- `parseAgentConfig(unknown)`: strict allowlisted properties, syntactic absolute workspace root, immutable limits. Defaults: 20 steps, 2 retries, 120000 ms. Bounds: 1–100 steps, 0–10 retries, 1000–600000 ms. **Realpath and symlink checks arrive in Group 4.**
- `ServiceContainer`: typed tokens with independent singleton/transient registrations, caching and circular-dependency detection.
- `AgentError`: named, coded errors. `toPublicAgentError` hides unexpected exception messages/causes.
- `TaskStateMachine`: legal queued/planned/running/approval/terminal transitions, immutable snapshots, monotonically nondecreasing timestamps and at most 256 retained transitions. No persistence or prompts in snapshots.

## Deferred

Group 3: native Gungnir binary and SDK detection. Group 4: enforced authorization and process runner. Group 6: read-only MCP. Group 8: AI model providers. Group 10: durable session management. Groups 11–15: code generation, editing, compilation and repair.
