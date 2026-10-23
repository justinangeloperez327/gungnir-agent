# Gungnir Agent

Node.js 24 coding-agent foundation for the Gungnir C++23 framework.

Group 9 includes an offline source-backed knowledge index: 52 pinned
Gungnir v1.0.2 documentation pages and example .gnr files, with
commit-pinned file/line references and optional, explicitly trusted
private-file context.

## Install and check

    npm ci
    npm run check
    npm run start -- interactive
    npm run start -- doctor

Search public Gungnir docs without an API key using /docs routing
or /docs model. Check references from the last successful model reply
with /sources. /usage, /files, /read, /search, /mode, and /cancel
remain available.

To generate source-backed model responses, set your own environment
provider key (OPENAI_API_KEY, ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY)
and explicitly select a provider and supported model:

    npm run start -- ask --provider openai --model YOUR_MODEL --message "How do Gungnir models work?"

No API key or paid model is selected by default.

By default, no local project source is sent to any model provider.
The --context-file app/models/User.gnr option sends the selected file
ONLY when paired with --project-root /absolute/project and
--trust-workspace, and subject to size and secret screening.
Never select files with information you are not permitted to disclose.

Documentation and limitations: docs/group-9-knowledge.md
Architecture: docs/architecture.md
Roadmap: docs/roadmap.md

The official MCP stdio server remains the separate gungnir-mcp repository.
Build mode is still text-only; models cannot modify files or run native
commands. GitHub Actions uses Node.js 24 on Windows and Ubuntu, without
automatic publishing or deployment.
