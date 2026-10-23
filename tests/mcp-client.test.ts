import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { TrustedWorkspace } from "@gungnir/agent-core";
import { GungnirMcpClient, ReadOnlyContextAdapter, GUNGNIR_MCP_SERVER } from "@gungnir/mcp-client";

describe("read-only context adapter", () => {
  it("returns metadata, bounded search and explicit snippets in a trusted scope", async () => {
    const temp = await mkdtemp(path.join(tmpdir(), "gungnir-mcp-context-"));
    try {
      await mkdir(path.join(temp, "app", "models"), { recursive: true });
      await writeFile(path.join(temp, ".gungnir-project"), "name=project\nprofile=structured\n");
      await writeFile(path.join(temp, "app", "models", "User.gnr"),
        "model User {\n  string secret = \"PRIVATE_NEVER_DEFAULT\";\n}\n");
      const adapter = new ReadOnlyContextAdapter(await TrustedWorkspace.open(temp, true));
      const result = await adapter.overview();
      expect(result.project).toMatchObject({ name: "project", profile: "structured" });
      expect(result.files.map(file => file.path)).toEqual(["app/models/User.gnr"]);
      expect(JSON.stringify(result)).not.toContain("PRIVATE_NEVER_DEFAULT");
      const search = await adapter.search("PRIVATE_NEVER_DEFAULT");
      expect(search).toEqual([{ path: "app/models/User.gnr", kind: "content", line: 2 }]);
      expect((await adapter.search("PRIVATE_NEVER_DEFAULT", { includeExcerpts: true }))[0]?.excerpt)
        .toContain("PRIVATE_NEVER_DEFAULT");
      expect((await adapter.excerpt("app/models/User.gnr", 1, 1)).lines).toEqual(["model User {"]);
      await expect(adapter.excerpt("../outside", 1, 1)).rejects.toMatchObject({
        code: "CONTEXT_INVALID",
      });
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("uses the existing Gungnir MCP server as the single protocol authority", () => {
    expect(GUNGNIR_MCP_SERVER).toBe("gungnir-mcp");
    expect(GungnirMcpClient).toBeTypeOf("function");
  });
});
