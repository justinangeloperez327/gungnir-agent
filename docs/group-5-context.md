# Group 5 — Gungnir project context

`GungnirProjectIndex.scan(trustedWorkspace, options?)` creates a bounded,
read-only snapshot of Gungnir application source. It does not spawn Gungnir,
modify project files, call AI providers or execute arbitrary tools.

## Discovery

- Reads `.gungnir-project` (4 KiB maximum) to classify `structured`,
  legacy `compatibility`, or `unknown` projects, and optionally extract name.
- Recursively enumerates `.gnr` files, excluding `.git`, `.gungnir`,
  `build`, `vendor`, `storage`, `node_modules`, `dist` and similar
  generated/metadata directories. Symbolic links are skipped.
- Categorizes files by Gungnir directory convention, creates dotted module
  **path** hints and optional text-derived `module` and `import` hints.
  These hints are not a parser, dependency graph or language validation.
  They may include text in comments. Use native Gungnir compiler/LSP for truth.
- Records file sizes, SHA-256 hashes, line counts and indexed metadata.

## Bounded operations

Defaults: 1,000 files, 16 directory levels, 256 KiB per source,
8 MiB total source bytes, 20,000 visited directory entries.
File/total/depth limits fail or report skipped oversized files explicitly.
Scan cancellation uses AbortSignal.

`index.search(query)` searches paths and source lines deterministically,
returning paths and line numbers with **no excerpts by default**. Set
`includeExcerpts: true` explicitly for limited source previews.
`index.sourceLines(path, firstLine, count)` retrieves up to 80 lines from the
snapshot (up to 1,000 characters per line). Searches return at most 100 results.

## Security and limitations

The caller must first create a `TrustedWorkspace` from an explicit host trust
decision. Source snapshots may contain credentials embedded in `.gnr` files:
do not forward excerpts or sourceLines blindly to an AI provider or log them.
Group 9 implements model-context selection/redaction controls.

The scan is a best-effort filesystem snapshot, **not** a race-free sandbox;
trusted source files may change during traversal. Group 12 must use atomic
no-follow access for any future writes. A file hash identifies snapshot content,
not semantic compiler correctness. Group 13 provides native diagnostics.
