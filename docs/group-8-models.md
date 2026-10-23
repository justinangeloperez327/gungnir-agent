# Group 8 — AI SDK v6 model adapters

Model calls use pinned AI SDK v6 with provider packages compatible with that
major version. Explicit provider and model selections are required. Supported:
`openai`, `anthropic`, `gateway` (qualified provider/model IDs).
The SDK creates real streaming requests only when a model is configured.

## Authentication

Use environment variables `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or
`AI_GATEWAY_API_KEY`. No `--api-key` flag, .env loading, credential logging,
or persisted session secrets. The user supplies only the provider/model IDs.
Do not commit .env files or paste keys into the prompt.

## Usage

```sh
npm run start -- ask --provider openai --model YOUR_AVAILABLE_MODEL --message "Explain Gungnir routing"
npm run start -- interactive --provider anthropic --model YOUR_AVAILABLE_MODEL
npm run start -- plan --provider gateway --model provider/model-id --message "Plan a controller"
```

Optional `--max-output-tokens N` (default 512), `--session-output-tokens N`
(default 4096), `--max-requests N` (default 20), and `--timeout-ms N`
(default 60000). `/usage` reports request/token counts with any returned
provider accounting. Limits are per running process, not global quotas.

User-supplied rate option trio:
`--input-usd-per-million RATE --output-usd-per-million RATE
--max-estimated-usd CAP`. **All three are required together**.
Cost estimates are not invoices or guarantees; input tokens are approximated
before the request, final provider usage is taken afterward when available.
If usage is unavailable, a conservative output cap is recorded.
There is no currency conversion or live provider pricing lookup.

## Safety

All three modes are strictly **text-only**. Build mode cannot call tools,
run `gungnir`, modify files, access MCP capabilities, migrate databases,
publish, or deploy. Source browsing still requires explicit trust. Prompts
are not populated automatically from local source files.

SDK stream errors are sanitized. No provider error body or API keys are shown
in diagnostics. Requests specify no tool access, bounded tokens, timeout,
no automatic retries and abort cancellation. CI uses stubbed model responses:
no external paid inference or credentials are required.

Future Group 9 adds context retrieval and source citations.
Group 10 adds durable multi-step task orchestration.
