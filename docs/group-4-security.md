# Group 4 — trust, policy and process boundaries

Security implementation is in `@gungnir/agent-core`. The CLI still exposes
only `--help`, `--version` and explicit `doctor`; no model tools can invoke
the runner in this group.

## Trusted workspace

`TrustedWorkspace.open(absoluteRoot, trustedByHost)` requires an explicit
trusted-host decision, resolves the existing root to a canonical directory and
enforces realpath containment for files being read. `writableFile(relative)`
preflights existing parent directories, rejects symbolic links and traversal,
and refuses `.git` and environment-file targets. These are **preflight checks**:
they do not authorize modifications. Group 12 must implement atomic, no-follow
writes to avoid time-of-check/time-of-use races.

## Policy

`DefaultExecutionPolicy`:
- Ask/Plan/Build: valid workspace.read requests may be allowed inside the
  separately established trusted workspace.
- Build: workspace.write and process.execute require explicit, per-request
  approval from the embedding trusted host.
- All modes: Git writes, database migrations, publishing and deployment are
  denied, even when a handler claims approval.
- Missing approval handler fails closed. No persistent wildcard approvals.

`enforcePermission` accepts a trusted, human-origin approval callback. That
callback **must never be implemented using model output**. An interface does not
authenticate the source of approval; the embedding host is responsible.

## Process runner

`ControlledProcessRunner` provides a low-level host-only process primitive.
It resolves an absolute executable, presents the specific executable, argv
and workspace cwd for approval, then spawns with `shell:false`, no stdin,
restricted environment inheritance, timeout, output-size cap and AbortSignal
cancellation. Errors returned to clients omit subprocess output and sensitive
exception details.

**Not a sandbox:** an approved executable can run arbitrary code with the
user's privileges. The runner does not guarantee termination of subprocess
descendants, and symlink/replace races remain possible. Do not surface this
primitive as a generic model-callable tool. Subsequent groups must expose only
narrowly specified operations with host-verified identities and trust controls.

## Existing read-only doctor

`doctor` remains opt-in read-only SDK probing under Group 3. PATH or overridden
binary paths may refer to untrusted programs; running their --version may still
execute arbitrary code. Do not run doctor automatically on untrusted workspaces
or under model control.
