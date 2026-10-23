# Architecture — Groups 1–6

```text
apps/cli
  -> packages/agent-core
       -> packages/contracts
       -> packages/gungnir-toolchain
  -> packages/gungnir-toolchain (opt-in doctor)

packages/mcp-client
  -> packages/agent-core (trusted context gateway)
  -> official @modelcontextprotocol/client v2
       -> existing gungnir-mcp stdio server (separate repository)
```

Group 2: config, DI, errors and task state.
Group 3: native Gungnir SDK detection.
Group 4: workspace trust and restricted host-approved subprocesses.
Group 5: read-only bounded `.gnr` indexing and context retrieval.
Group 6: official MCP client bridge with real legacy/modern protocol tests
against the existing gungnir-mcp server, and a local read-only context adapter.

**No competing MCP server is built in this repository.** The existing
gungnir-mcp v0.4.0 exports status and toolchain-info tools only.
Project context tools remain an external-server integration task.

The CLI still supports only help/version/doctor. Ask, Plan, Build, model
providers, MCP-triggered edits, and automatic compilation remain unavailable.
The compiler/LSP remain authoritative; regex-indexed module hints are not
semantically validated.
