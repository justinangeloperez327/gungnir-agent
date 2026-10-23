# Architecture — Groups 1–9

    apps/cli
      -> packages/knowledge (pinned v1.0.2 docs and source references)
      -> KnowledgeTextBackend (retrieval context adapter)
        -> packages/model-adapters (AI SDK v6 text streaming)
      -> packages/agent-core (trusted workspace and .gnr index)
      -> packages/mcp-client (outbound official MCP v2 client)
      -> packages/gungnir-toolchain (explicit SDK doctor)

The sole official MCP server remains justinangeloperez327/gungnir-mcp.
Group 9 adds locally bundled knowledge, a deterministic lexical
retrieval index and source-citation output. Model prompts attach
retrieved text as untrusted JSON-quoted reference data.

Project browsing trust does not automatically grant access to provider
prompt context. An existing private .gnr file must be explicitly
selected, size checked and screened before forwarding.

Ask, Plan and Build remain text only. Models cannot execute native
processes, write files, publish, deploy or modify Git. Native Gungnir
compiler and LSP diagnostics remain the semantic source of truth.
