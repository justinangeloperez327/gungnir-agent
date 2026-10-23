import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";
import { AgentError } from "../errors.js";
import { TrustedWorkspace } from "../security/workspace.js";

const EXCLUDED = new Set([
  ".git", ".gungnir", ".svn", ".hg", ".next", ".turbo",
  "build", "dist", "vendor", "storage", "node_modules", "coverage", "target",
]);
const DEFAULT_MAX_FILES = 1_000;
const DEFAULT_MAX_DEPTH = 16;
const DEFAULT_MAX_BYTES_PER_FILE = 256 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_DIRECTORY_ENTRIES = 20_000;

export type ProjectProfile = "structured" | "compatibility" | "unknown";
export type FileCategory =
  | "model" | "controller" | "middleware" | "migration" | "routes"
  | "request" | "event" | "listener" | "policy" | "notification"
  | "job" | "mail" | "other";

export interface ProjectMetadata {
  readonly detected: boolean;
  readonly name?: string;
  readonly profile: ProjectProfile;
}

export interface SourceSummary {
  readonly path: string;
  readonly modulePath: string;
  /** Regex-only hint. Not compiler-validated; comments can produce false positives. */
  readonly declaredModuleHint?: string;
  /** Regex-only hints, NOT a validated import/dependency graph. */
  readonly importHints: readonly string[];
  readonly category: FileCategory;
  readonly bytes: number;
  readonly sha256: string;
  readonly lines: number;
}

export interface ProjectIndexOptions {
  readonly maxFiles?: number;
  readonly maxDepth?: number;
  readonly maxBytesPerFile?: number;
  readonly maxTotalBytes?: number;
  readonly signal?: AbortSignal;
}

export interface ProjectIndexStatistics {
  readonly indexedFiles: number;
  readonly indexedBytes: number;
  readonly skippedSymlinks: number;
  readonly skippedOversized: number;
  readonly scannedEntries: number;
}

export interface ContextMatch {
  readonly path: string;
  readonly kind: "path" | "content";
  readonly line?: number;
  /** Explicit opt-in: potentially sensitive project text. */
  readonly excerpt?: string;
}

export interface ContextQueryOptions {
  readonly maxResults?: number;
  readonly includeExcerpts?: boolean;
  readonly caseSensitive?: boolean;
}

export interface SourceLines {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly lines: readonly string[];
}

function bounded(value: number | undefined, fallback: number, min: number, max: number): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < min || selected > max) {
    throw new AgentError("CONTEXT_INVALID", "Invalid project scan or query limit");
  }
  return selected;
}

function requireSignal(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new AgentError("CONTEXT_CANCELLED", "Project scan was cancelled");
}

function category(relative: string): FileCategory {
  const normalized = relative.toLowerCase();
  if (normalized.startsWith("routes/")) return "routes";
  if (normalized.startsWith("database/migrations/")) return "migration";
  const segment = normalized.split("/")[1];
  if (normalized.startsWith("app/")) {
    const categories: Record<string, FileCategory> = {
      models: "model", controllers: "controller", middleware: "middleware",
      requests: "request", events: "event", listeners: "listener",
      policies: "policy", notifications: "notification",
      jobs: "job", mail: "mail",
    };
    return segment === undefined ? "other" : categories[segment] ?? "other";
  }
  return "other";
}

function sourceHints(source: string): { declaredModuleHint?: string; importHints: string[] } {
  // Deliberately shallow discovery. Only Gungnir compiler/LSP can resolve imports.
  const module = /^\s*module\s+([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)\s*;/m.exec(source)?.[1];
  const imports = new Set<string>();
  const pattern = /^\s*import\s+([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)\s*(?:as\s+[a-zA-Z_]\w*)?\s*;/gm;
  for (const match of source.matchAll(pattern)) {
    if (imports.size >= 100) break;
    if (match[1]) imports.add(match[1]);
  }
  return { ...(module ? { declaredModuleHint: module } : {}), importHints: [...imports].sort() };
}

async function readBoundedFile(filename: string, limit: number): Promise<Buffer> {
  // O_NOFOLLOW provides the final-component protection where supported;
  // scanning remains a best-effort snapshot and is not an atomic read sandbox.
  const flags = constants.O_RDONLY | (process.platform === "win32" ? 0 : constants.O_NOFOLLOW);
  const handle = await open(filename, flags);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > limit) {
      throw new AgentError("CONTEXT_LIMIT", "Source exceeds permitted size");
    }
    const buffer = Buffer.alloc(metadata.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset !== buffer.length) throw new AgentError("CONTEXT_LIMIT", "Source changed during scan");
    return buffer;
  } finally {
    await handle.close();
  }
}

async function marker(workspace: TrustedWorkspace): Promise<ProjectMetadata> {
  const filename = path.join(workspace.root, ".gungnir-project");
  try {
    if (!(await lstat(filename)).isFile()) return { detected: false, profile: "unknown" };
    const buffer = await readBoundedFile(filename, 4096);
    const content = buffer.toString("utf8");
    const name = /^name\s*=\s*([a-zA-Z][a-zA-Z0-9_-]{0,99})\s*$/m.exec(content)?.[1];
    const rawProfile = /^profile\s*=\s*(\w+)\s*$/m.exec(content)?.[1];
    const profile: ProjectProfile = rawProfile === "structured"
      ? "structured" : rawProfile === undefined ? "compatibility" : "unknown";
    return Object.freeze({
      detected: true, profile, ...(name ? { name } : {}),
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { detected: false, profile: "unknown" };
    }
    throw new AgentError("CONTEXT_INVALID", "Unable to read project marker");
  }
}

/**
 * An immutable, size-bounded snapshot of Gungnir source files. Only .gnr text
 * is retained privately; listing the index does not expose file contents.
 */
export class GungnirProjectIndex {
  readonly project: ProjectMetadata;
  readonly files: readonly SourceSummary[];
  readonly statistics: ProjectIndexStatistics;
  readonly #contents: ReadonlyMap<string, readonly string[]>;

  private constructor(
    project: ProjectMetadata, files: SourceSummary[],
    statistics: ProjectIndexStatistics, contents: Map<string, readonly string[]>,
  ) {
    this.project = Object.freeze(project);
    this.files = Object.freeze(files.map(file => Object.freeze(file)));
    this.statistics = Object.freeze(statistics);
    this.#contents = contents;
  }

  static async scan(
    workspace: TrustedWorkspace, options: ProjectIndexOptions = {},
  ): Promise<GungnirProjectIndex> {
    const maxFiles = bounded(options.maxFiles, DEFAULT_MAX_FILES, 1, 10_000);
    const maxDepth = bounded(options.maxDepth, DEFAULT_MAX_DEPTH, 1, 32);
    const maxBytesPerFile = bounded(options.maxBytesPerFile, DEFAULT_MAX_BYTES_PER_FILE, 1, 1024 * 1024);
    const maxTotalBytes = bounded(options.maxTotalBytes, DEFAULT_MAX_TOTAL_BYTES, 1, 32 * 1024 * 1024);
    requireSignal(options.signal);
    const project = await marker(workspace);
    const files: SourceSummary[] = [];
    const contents = new Map<string, readonly string[]>();
    let indexedBytes = 0;
    let skippedSymlinks = 0;
    let skippedOversized = 0;
    let scannedEntries = 0;

    async function walk(relativeDirectory: string, depth: number): Promise<void> {
      requireSignal(options.signal);
      if (depth > maxDepth) throw new AgentError("CONTEXT_LIMIT", "Project directory depth limit exceeded");
      const directory = relativeDirectory
        ? path.join(workspace.root, ...relativeDirectory.split("/")) : workspace.root;
      let entries;
      try { entries = await readdir(directory, { withFileTypes: true }); }
      catch { throw new AgentError("CONTEXT_INVALID", "Cannot enumerate project directory"); }
      entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      for (const entry of entries) {
        requireSignal(options.signal);
        if (++scannedEntries > MAX_DIRECTORY_ENTRIES) {
          throw new AgentError("CONTEXT_LIMIT", "Project entry count limit exceeded");
        }
        if (entry.name.includes("/") || entry.name.includes("\\") || entry.name.includes("\0")) continue;
        const relative = relativeDirectory
          ? relativeDirectory + "/" + entry.name : entry.name;
        const full = path.join(directory, entry.name);
        let info;
        try { info = await lstat(full); }
        catch {
          // Concurrent deletion: index reflects a best-effort snapshot.
          continue;
        }
        if (info.isSymbolicLink()) { skippedSymlinks++; continue; }
        if (info.isDirectory()) {
          if (EXCLUDED.has(entry.name.toLowerCase()) ||
              entry.name.startsWith(".env")) continue;
          await walk(relative, depth + 1);
          continue;
        }
        if (!info.isFile() || !entry.name.toLowerCase().endsWith(".gnr")) continue;
        if (files.length >= maxFiles) {
          throw new AgentError("CONTEXT_LIMIT", "Project source file limit exceeded");
        }
        if (info.size > maxBytesPerFile) { skippedOversized++; continue; }
        if (indexedBytes + info.size > maxTotalBytes) {
          throw new AgentError("CONTEXT_LIMIT", "Project source byte limit exceeded");
        }
        const canonical = await workspace.existingFile(relative);
        let raw: Buffer;
        try { raw = await readBoundedFile(canonical, maxBytesPerFile); }
        catch (error) {
          if (error instanceof AgentError && error.code === "CONTEXT_LIMIT") {
            skippedOversized++;
            continue;
          }
          throw new AgentError("CONTEXT_INVALID", "Cannot read project source file");
        }
        if (indexedBytes + raw.length > maxTotalBytes) {
          throw new AgentError("CONTEXT_LIMIT", "Project source byte limit exceeded");
        }
        const text = raw.toString("utf8");
        const lines = text.split(/\r?\n/);
        const hints = sourceHints(text);
        const filename = relative.slice(0, -4);
        const modulePath = filename.split("/").join(".");
        files.push({
          path: relative, modulePath, category: category(relative),
          ...hints, bytes: raw.length,
          sha256: createHash("sha256").update(raw).digest("hex"),
          lines: lines.length,
        });
        contents.set(relative, Object.freeze(lines));
        indexedBytes += raw.length;
      }
    }
    await walk("", 0);
    files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    return new GungnirProjectIndex(project, files, Object.freeze({
      indexedFiles: files.length, indexedBytes, skippedSymlinks,
      skippedOversized, scannedEntries,
    }), contents);
  }

  /** In-memory only; filename and line matching (not semantic references). */
  search(query: string, options: ContextQueryOptions = {}): readonly ContextMatch[] {
    if (typeof query !== "string" || !query.trim() || query.length > 200) {
      throw new AgentError("CONTEXT_INVALID", "Invalid search query");
    }
    const maxResults = bounded(options.maxResults, 25, 1, 100);
    const normalized = options.caseSensitive ? query : query.toLowerCase();
    const matches: ContextMatch[] = [];
    for (const file of this.files) {
      const filename = options.caseSensitive ? file.path : file.path.toLowerCase();
      if (filename.includes(normalized)) {
        matches.push(Object.freeze({ path: file.path, kind: "path" }));
        if (matches.length >= maxResults) break;
      }
      const lines = this.#contents.get(file.path) ?? [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const candidate = options.caseSensitive ? line : line.toLowerCase();
        if (!candidate.includes(normalized)) continue;
        matches.push(Object.freeze({
          path: file.path, kind: "content", line: i + 1,
          ...(options.includeExcerpts ? { excerpt: line.slice(0, 200) } : {}),
        }));
        if (matches.length >= maxResults) break;
      }
      if (matches.length >= maxResults) break;
    }
    return Object.freeze(matches);
  }

  /** Explicitly selected local source excerpt, intended for trusted host use. */
  sourceLines(relative: string, firstLine: number, count: number): SourceLines {
    const lines = this.#contents.get(relative);
    if (!lines || !Number.isSafeInteger(firstLine) || firstLine < 1 ||
        !Number.isSafeInteger(count) || count < 1 || count > 80) {
      throw new AgentError("CONTEXT_INVALID", "Invalid source excerpt request");
    }
    const selected = lines.slice(firstLine - 1, firstLine - 1 + count);
    if (!selected.length) throw new AgentError("CONTEXT_INVALID", "Requested source line does not exist");
    return Object.freeze({
      path: relative, startLine: firstLine, endLine: firstLine + selected.length - 1,
      lines: Object.freeze(selected.map(line => line.slice(0, 1000))),
    });
  }
}
