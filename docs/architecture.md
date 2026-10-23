# Architecture — Groups 1–8

```text
apps/cli (Ask/Plan/Build terminal, mode switch, cancellation)
  -> packages/model-adapters (AI SDK v6 provider adapters; text only)
  -> packages/agent-core (session, trusted workspace, permissions)
  -> packages/mcp-client (outbound v2 client, opt-in only)
  -> packages/gungnir-toolchain (doctor)
```

Group 8 uses official AI SDK v6 and matching provider packages for OpenAI,
Anthropic and Gateway. Operators explicitly select a provider and model
and supply keys through environment variables. CLI status/usage does not
display secrets. No tools are registered with the model. Even Build mode
generates plans or patches **as text** and cannot change the repository.

No automatic retrieval of source text, project mutation, native compiler
execution, external MCP actions, deployment or publication.
Group 9 will add cited context selection and source handling.
Group 10 will add durable bounded orchestration.
