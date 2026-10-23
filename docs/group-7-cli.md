# Group 7 — interactive Gungnir Agent CLI

The terminal now accepts modes `ask`, `plan`, `build` and
`interactive --mode ask|plan|build`. It includes command parsing,
streamed output rendering, cancellation, mode changes, and explicitly
trusted read-only project navigation. The CLI is backed by a text-only
streaming interface, **not a connected model**.

## Usage

```sh
npm ci
npm run build
npm run start -- interactive
npm run start -- ask
npm run start -- plan --message "Design a User controller"
npm run start -- build --message "Create a model"
npm run start -- interactive --mode ask --project-root /absolute/project --trust-workspace
```

On Windows, specify an absolute project root, e.g.
`--project-root "C:\\Projects\\inventory" --trust-workspace`.

The shell exposes `/help`, `/mode ask|plan|build`,
`/status`, `/files [count]`, `/search <literal>`,
`/read <relative.gnr> [start] [count]`, `/cancel`, and `/exit`.

Group 5 project indexing and Group 6's `ReadOnlyContextAdapter`
back browsing. **No implicit working-directory trust:** both
`--project-root` and `--trust-workspace` must be provided for
file inspection. Browsing never modifies source files or launches the
MCP server automatically.

## Streaming and cancellation

`AgentCliSession` accepts an injected `TextStreamBackend` that returns
an async stream of **text only**. It emits individual token events to
the terminal, applies output limits, tracks a task state, and
supports cancellation with `AbortSignal`. The shell handles
Ctrl+C (cancel active request, or close an idle shell).

This interface is tested with fake text backends, but **no provider
is shipped** in Group 7. Until Group 8, free-text input returns an
explicit unavailable-model message (one-shot exit status 3) rather than
a fabricated AI response. Switching to Build mode **does not**
grant a process, edit, deployment or publication capability.

Terminal control characters in emitted text are filtered. Unknown
backend errors are sanitized. No prompts or model output are
persisted as session history.

## Delivery

Node.js 24 / Windows and Ubuntu CI tests cover argument validation,
piped interactive sessions, trust boundaries, source browsing,
stream delivery, cancellation and output-budget failures.

No automatic deployment, PR, release, or publication.
