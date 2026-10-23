# Group 9 — pinned Gungnir knowledge and retrieval

This repository bundles 52 upstream documentation pages and .gnr examples
from justinangeloperez327/gungnir at immutable commit
7336fc542673684b9453bee71b4157129a50ee3d.
The snapshot covers Gungnir release 1.0.2 and language contract 1.0.

The knowledge package indexes the bundled text locally, ranks query terms
against file paths/headings/body content, and returns exact repository-relative
paths, source line ranges and immutable GitHub permalinks. No online lookup,
search service, database, embeddings or live API are needed.

## Working with the CLI

To inspect documentation without a model key:

    npm ci
    npm run build
    npm run start -- interactive

Inside the shell:

    /docs routing
    /docs model
    /sources

When OpenAI, Anthropic or Gateway is explicitly configured, Ask/Plan/Build
requests retrieve up to four relevant public documentation excerpts and
attach them as JSON-quoted reference data separated from the user's question.
The CLI lists the reference URLs after the response. The model is instructed
to cite numeric source markers such as [1] and [2]. These references are
traceable source links, NOT proof that generated code is correct.

To use a specified release, provide --docs-version 1.0.2. Mismatching
versions fail closed: updating to another release requires a reviewed
snapshot update and versioned CI regression.

## Private project source: explicit opt-in only

Having a trusted workspace does not send its files to an AI provider.
Only a caller-selected source may be included, with both explicit workspace
trust and the --context-file argument:

    npm run start -- ask --provider openai --model YOUR_MODEL --message "Review this model" --project-root /absolute/project --trust-workspace --context-file app/models/User.gnr

The selected existing .gnr file must be within the canonical trusted project,
be no more than 60 lines and 3.5 KiB, and pass heuristic credential and
instruction-redirection screening. The resulting source reference uses a
workspace-relative locator, never a public GitHub URL or your absolute path.

A selected file IS SENT to the chosen model provider. Heuristic checks
cannot detect every secret, hidden credential, or confidential information.
Never select files you do not have permission to disclose.

## Prompt integrity and limits

Reference documents are treated as untrusted data rather than as system
instructions. Their content is quoted and terminal control characters are
filtered. A recognized sensitive excerpt is excluded from public retrieval;
a sensitive explicitly selected project file causes a hard error.

Retrieval does not grant process execution, code modification, Git writes,
database migration, publishing or deployment. Prompt contexts are capped
at 24 KiB; public excerpts are bounded to 1.8 KiB each. Local model tests
use injected fake streams and never use paid provider inference.

The underlying source selection is lexical rather than semantic. Source
citations do not replace native compiler checks, runtime tests or the Gungnir
language server.
