import path from "node:path";
import { lstat, realpath, stat } from "node:fs/promises";
import { AgentError } from "../errors.js";

/**
 * Trust is supplied by the embedding host/user, never inferred from source
 * files, model-generated instructions or the mere existence of a directory.
 * This class only establishes a trusted filesystem scope; it is not a sandbox.
 */
export class TrustedWorkspace {
  readonly #root: string;
  private constructor(root: string) { this.#root = root; }
  get root(): string { return this.#root; }

  static async open(root: string, trusted: boolean): Promise<TrustedWorkspace> {
    if (!trusted) throw new AgentError("WORKSPACE_UNTRUSTED", "Workspace trust was not granted");
    if (typeof root !== "string" || !path.isAbsolute(root) || root.includes("\0")) {
      throw new AgentError("PATH_FORBIDDEN", "Workspace root must be an absolute directory");
    }
    try {
      const canonical = await realpath(root);
      if (!(await stat(canonical)).isDirectory()) throw new Error("not a directory");
      return new TrustedWorkspace(canonical);
    } catch {
      throw new AgentError("PATH_FORBIDDEN", "Workspace root does not exist or is not a directory");
    }
  }

  /** Reject traversal on both Windows and POSIX, regardless of host OS. */
  private parts(relative: string): string[] {
    if (typeof relative !== "string" || !relative ||
        relative.includes("\0") || path.isAbsolute(relative) ||
        path.win32.isAbsolute(relative) || path.posix.isAbsolute(relative) ||
        relative.includes("\\") || relative.includes(":")) {
      throw new AgentError("PATH_FORBIDDEN", "Invalid workspace-relative path");
    }
    const parts = relative.split("/");
    if (parts.some(part => !part || part === "." || part === "..")) {
      throw new AgentError("PATH_FORBIDDEN", "Workspace traversal is not allowed");
    }
    return parts;
  }

  private contains(candidate: string): boolean {
    const relative = path.relative(this.#root, candidate);
    return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
  }

  /** For read-only file access; an in-root symlink is allowed, escapes are not. */
  async existingFile(relative: string): Promise<string> {
    const candidate = path.join(this.#root, ...this.parts(relative));
    try {
      const canonical = await realpath(candidate);
      if (!this.contains(canonical) || !(await stat(canonical)).isFile()) {
        throw new AgentError("PATH_FORBIDDEN", "File is outside trusted workspace");
      }
      return canonical;
    } catch {
      throw new AgentError("PATH_FORBIDDEN", "File is unavailable or outside trusted workspace");
    }
  }

  /**
   * Resolve an existing file or a new file with an existing directory parent.
   * Reject symlinks in every path component and protected metadata paths.
   * This is preflight only: Group 12 must use no-follow, atomic file APIs.
   */
  async writableFile(relative: string): Promise<string> {
    const parts = this.parts(relative);
    if (parts.some(part => part === ".git" || part === ".env" || part === ".ssh") ||
        parts.at(-1)?.startsWith(".env.")) {
      throw new AgentError("PATH_FORBIDDEN", "Protected workspace metadata cannot be modified");
    }
    let current = this.#root;
    for (let index = 0; index < parts.length; index++) {
      current = path.join(current, parts[index]!);
      if (!this.contains(current)) throw new AgentError("PATH_FORBIDDEN", "Outside trusted workspace");
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink()) throw new AgentError("PATH_FORBIDDEN", "Symlink write target refused");
        if (index === parts.length - 1 && !info.isFile()) {
          throw new AgentError("PATH_FORBIDDEN", "Write target must be a regular file");
        }
        if (index < parts.length - 1 && !info.isDirectory()) {
          throw new AgentError("PATH_FORBIDDEN", "Write parent must be a directory");
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw new AgentError("PATH_FORBIDDEN", "Write target is unsafe");
        }
        if (index !== parts.length - 1) {
          throw new AgentError("PATH_FORBIDDEN", "Write parent directory must exist");
        }
      }
    }
    return current;
  }
}
