import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { GungnirProjectIndex, TrustedWorkspace, toPublicAgentError } from "@gungnir/agent-core";

const created: string[] = [];
async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "gungnir-context-"));
  created.push(root);
  await mkdir(path.join(root, "app", "models"), { recursive: true });
  await mkdir(path.join(root, "app", "controllers"), { recursive: true });
  await mkdir(path.join(root, "routes"));
  await writeFile(path.join(root, ".gungnir-project"), "name=demo\nprofile=structured\n");
  await writeFile(path.join(root, "app", "models", "User.gnr"),
    "module app.models.User;\nmodel User {\n  string name;\n}\n");
  await writeFile(path.join(root, "app", "controllers", "Home.gnr"),
    "module app.controllers.Home;\nimport app.models.User as User;\ncontroller Home {\n  Response index() { return text(\"Hello user\"); }\n}\n");
  await writeFile(path.join(root, "routes", "web.gnr"), "Route::get(\"/\", Home::index);\n");
  await mkdir(path.join(root, "build"), { recursive: true });
  await writeFile(path.join(root, "build", "ignored.gnr"), "SECRET_SHOULD_NOT_INDEX");
  await writeFile(path.join(root, ".env"), "TOP_SECRET=hidden");
  return root;
}
afterEach(async () => {
  for (const r of created.splice(0)) await rm(r, { recursive: true, force: true });
});
async function scan(root: string, options: Parameters<typeof GungnirProjectIndex.scan>[1] = {}) {
  return GungnirProjectIndex.scan(await TrustedWorkspace.open(root, true), options);
}

describe("Gungnir project snapshot discovery", () => {
  it("indexes deterministic Gungnir paths, categories, hints and profile", async () => {
    const result = await scan(await fixture());
    expect(result.project).toEqual({ detected: true, name: "demo", profile: "structured" });
    expect(result.files.map(f => f.path)).toEqual([
      "app/controllers/Home.gnr", "app/models/User.gnr", "routes/web.gnr",
    ]);
    expect(result.files[0]).toMatchObject({
      modulePath: "app.controllers.Home", declaredModuleHint: "app.controllers.Home",
      importHints: ["app.models.User"], category: "controller", bytes: expect.any(Number),
    });
    expect(result.files[1]?.category).toBe("model");
    expect(result.files[2]?.category).toBe("routes");
    expect(result.files.every(f => /^[0-9a-f]{64}$/.test(f.sha256))).toBe(true);
    expect(result.statistics.indexedFiles).toBe(3);
    expect(result.search("SECRET_SHOULD_NOT_INDEX")).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("Hello user");
  });
  it("distinguishes compatibility profile and no project marker", async () => {
    const root = await fixture();
    await writeFile(path.join(root, ".gungnir-project"), "name=legacy\n");
    expect((await scan(root)).project).toEqual({ detected: true, name: "legacy", profile: "compatibility" });
    await rm(path.join(root, ".gungnir-project"));
    expect((await scan(root)).project).toEqual({ detected: false, profile: "unknown" });
  });
  it("searches filenames and line positions, with excerpts only by opt-in", async () => {
    const index = await scan(await fixture());
    expect(index.search("models/User").some(m => m.kind === "path")).toBe(true);
    const results = index.search("hello user");
    expect(results).toEqual([{ path: "app/controllers/Home.gnr", kind: "content", line: 4 }]);
    expect(index.search("hello user", { includeExcerpts: true })[0]?.excerpt).toContain("Hello user");
    expect(index.sourceLines("app/models/User.gnr", 2, 2)).toMatchObject({
      startLine: 2, endLine: 3, lines: ["model User {", "  string name;"],
    });
    expect(Object.isFrozen(index.files)).toBe(true);
    expect(Object.isFrozen(results)).toBe(true);
  });
  it("never follows symlinks or searches excluded directories", async () => {
    const root = await fixture();
    const outsider = await mkdtemp(path.join(tmpdir(), "gungnir-outsider-"));
    created.push(outsider);
    await writeFile(path.join(outsider, "private.gnr"), "SECRET_OUTSIDE_SCOPE");
    try {
      await symlink(outsider, path.join(root, "link"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const index = await scan(root);
    expect(index.statistics.skippedSymlinks).toBe(1);
    expect(index.search("SECRET_OUTSIDE_SCOPE")).toHaveLength(0);
  });
  it("marks oversized source as skipped rather than silently indexing", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "routes", "huge.gnr"), "x".repeat(2000));
    const index = await scan(root, { maxBytesPerFile: 1024 });
    expect(index.statistics.skippedOversized).toBe(1);
    expect(index.files.some(f => f.path === "routes/huge.gnr")).toBe(false);
  });
  it("fails closed on total-byte/file/depth and invalid query limits", async () => {
    const root = await fixture();
    await expect(scan(root, { maxFiles: 1 })).rejects.toMatchObject({ code: "CONTEXT_LIMIT" });
    await expect(scan(root, { maxTotalBytes: 5 })).rejects.toMatchObject({ code: "CONTEXT_LIMIT" });
    await expect(scan(root, { maxDepth: 1 })).rejects.toMatchObject({ code: "CONTEXT_LIMIT" });
    const index = await scan(root);
    expect(() => index.search("", {})).toThrow();
    expect(() => index.search("user", { maxResults: 101 })).toThrow();
    expect(() => index.sourceLines("../secret", 1, 1)).toThrow();
    expect(() => index.sourceLines("app/models/User.gnr", 0, 2)).toThrow();
  });
  it("honors pre-aborted scans and does not leak thrown details", async () => {
    const root = await fixture();
    const controller = new AbortController();
    controller.abort();
    try {
      await scan(root, { signal: controller.signal });
      throw new Error("Expected cancellation");
    } catch (error) {
      expect(toPublicAgentError(error)).toEqual({
        code: "CONTEXT_CANCELLED", message: "Project scan was cancelled", retryable: false,
      });
    }
  });
});
