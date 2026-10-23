# Gungnir Agent

A Node.js 24 coding-agent foundation for the
[Gungnir C++23 framework](https://github.com/justinangeloperez327/gungnir).

**Group 8:** Real AI SDK v6 text streaming for explicitly configured OpenAI,
Anthropic or Vercel AI Gateway models. The Ask, Plan and Build CLI modes
remain **text-only**; there are no executable model tools or source edits.

## Installation and checks

```sh
npm ci
npm run check
npm run start -- --help
npm run start -- interactive
```

## AI model configuration

Set the provider's API key as an environment variable. Never place the key
in CLI arguments or commit it to the repository. Then select the provider
and a model ID supported by your account:

```sh
npm run start -- ask --provider openai --model YOUR_MODEL --message "Explain Gungnir controllers"
npm run start -- plan --provider anthropic --model YOUR_MODEL --message "Design a Gungnir application"
npm run start -- interactive --provider gateway --model provider/model
```

Supported environment variables: `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY`. There is no default model
to avoid accidental paid requests. Optional session limits and explicit
estimated-USD budgets are described in [Group 8 documentation](docs/group-8-models.md).

Interactive commands: `/help`, `/mode`, `/status`, `/usage`,
`/files`, `/search`, `/read`, `/cancel`, `/exit`.

Reading local source still requires
`--project-root /absolute/project --trust-workspace`.
Prompts do not automatically include source code.

Packages: `apps/cli`, `packages/contracts`, `packages/agent-core`,
`packages/gungnir-toolchain`, `packages/mcp-client`, and
`packages/model-adapters`. The existing standalone
[gungnir-mcp](https://github.com/justinangeloperez327/gungnir-mcp)
remains the only authoritative MCP server.

CI runs on Windows 2025/Ubuntu 24.04 using Node 24. No PR, npm publication
or deployment is automatically created.
