import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TrustedWorkspace } from "@gungnir/agent-core";
import { GungnirMcpClient } from "@gungnir/mcp-client";

const entryEnv = process.env.GUNGNIR_MCP_SERVER_ENTRY;
const describeServer = entryEnv ? describe : describe.skip;

describeServer("pinned gungnir-mcp v0.4.0 real stdio integration", () => {
  for (const protocol of ["legacy", "modern"] as const) {
    it("negotiates " + protocol + " protocol and allows only read-only metadata tools", async () => {
      const root = await mkdtemp(path.join(tmpdir(), "gungnir-mcp-e2e-"));
      let client: GungnirMcpClient | undefined;
      try {
        await mkdir(path.join(root, "app"));
        const workspace = await TrustedWorkspace.open(root, true);
        const entry = path.resolve(entryEnv!);
        const approval = async () => true;
        client = await GungnirMcpClient.connect({
          serverEntry: entry, workspace, approval, protocol,
        });
        expect(client.getProtocolEra()).toBe(protocol);
        expect(await client.listSupportedTools()).toEqual([
          "gungnir_status", "gungnir_toolchain_info",
        ]);
        const status = await client.callReadOnly("gungnir_status");
        expect(status).toMatchObject({
          name: "gungnir-mcp", projectAccess: "trusted",
          projectMutationEnabled: false,
        });
        expect(JSON.stringify(status)).not.toContain(root);
        await expect(client.callReadOnly("gungnir_make_controller" as "gungnir_status"))
          .rejects.toMatchObject({ code: "POLICY_DENIED" });
      } finally {
        await client?.close();
        await rm(root, { recursive: true, force: true });
      }
    });
  }

  it("denies launching a server without trusted host approval", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "gungnir-mcp-denied-"));
    try {
      const workspace = await TrustedWorkspace.open(root, true);
      await expect(GungnirMcpClient.connect({
        serverEntry: path.resolve(entryEnv!), workspace,
        approval: async () => false,
      })).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
