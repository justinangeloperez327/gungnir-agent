import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ControlledProcessRunner, DefaultExecutionPolicy, TrustedWorkspace,
  enforcePermission, toPublicAgentError,
} from "@gungnir/agent-core";
import type { ToolCapability, ToolRequest } from "@gungnir/contracts";

const roots: string[] = [];
async function temporary(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "gungnir-security-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
function request(capability: ToolCapability): ToolRequest {
  return { id: "r1", taskId: "task1", toolName: "tool", capability, input: {} };
}

describe("trusted workspace path boundaries", () => {
  it("refuses untrusted or missing roots", async () => {
    const root = await temporary();
    await expect(TrustedWorkspace.open(root, false)).rejects.toMatchObject({ code: "WORKSPACE_UNTRUSTED" });
    await expect(TrustedWorkspace.open(path.join(root, "missing"), true))
      .rejects.toMatchObject({ code: "PATH_FORBIDDEN" });
  });
  it("accepts normal in-root reads and potential writes", async () => {
    const root = await temporary();
    await mkdir(path.join(root, "app"));
    await writeFile(path.join(root, "app", "Home.gnr"), "controller Home {}");
    const scope = await TrustedWorkspace.open(root, true);
    expect(await scope.existingFile("app/Home.gnr")).toBe(path.join(scope.root, "app", "Home.gnr"));
    expect(await scope.writableFile("app/New.gnr")).toBe(path.join(scope.root, "app", "New.gnr"));
    expect(await scope.writableFile("app/Home.gnr")).toBe(path.join(scope.root, "app", "Home.gnr"));
  });
  it("rejects traversal, foreign absolute paths, and sensitive workspace entries", async () => {
    const root = await temporary();
    const scope = await TrustedWorkspace.open(root, true);
    for (const file of ["../outside", "sub/../outside", "./x", "/etc/passwd",
      "C:\\Users\\Public\\outside", "app\\evil", ".git/config", ".env", ".env.private"]) {
      await expect(scope.writableFile(file)).rejects.toMatchObject({ code: "PATH_FORBIDDEN" });
    }
  });
  it("refuses symlink escapes for reads and writes", async () => {
    const root = await temporary();
    const outside = await temporary();
    await writeFile(path.join(outside, "secret.gnr"), "SECRET");
    await mkdir(path.join(root, "app"));
    try {
      await symlink(outside, path.join(root, "app", "escape"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const scope = await TrustedWorkspace.open(root, true);
    await expect(scope.existingFile("app/escape/secret.gnr")).rejects.toMatchObject({ code: "PATH_FORBIDDEN" });
    await expect(scope.writableFile("app/escape/new.gnr")).rejects.toMatchObject({ code: "PATH_FORBIDDEN" });
  });
});

describe("permission policy and host approval", () => {
  it("allows read-only requests but blocks writes/commands in Ask and Plan", () => {
    const policy = new DefaultExecutionPolicy();
    expect(policy.evaluate(request("workspace.read"), "ask")).toBe("allow");
    expect(policy.evaluate(request("workspace.read"), "plan")).toBe("allow");
    for (const mode of ["ask", "plan"] as const) {
      expect(policy.evaluate(request("workspace.write"), mode)).toBe("deny");
      expect(policy.evaluate(request("process.execute"), mode)).toBe("deny");
    }
  });
  it("requires specific human-origin approval in Build and denies privileged actions", async () => {
    const policy = new DefaultExecutionPolicy();
    const command = request("process.execute");
    expect(policy.evaluate(command, "build")).toBe("require-approval");
    await expect(enforcePermission(policy, command, "build")).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    await expect(enforcePermission(policy, command, "build", async () => false))
      .rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    await expect(enforcePermission(policy, command, "build", async () => true)).resolves.toBeUndefined();
    for (const capability of ["git.write", "database.migrate", "publish", "deploy"] as const) {
      expect(policy.evaluate(request(capability), "build")).toBe("deny");
      await expect(enforcePermission(policy, request(capability), "build", async () => true))
        .rejects.toMatchObject({ code: "POLICY_DENIED" });
    }
  });
  it("does not expose rejected approval callback secrets", async () => {
    await expect(enforcePermission(
      new DefaultExecutionPolicy(), request("workspace.write"), "build",
      async () => { throw new Error("SECRET_API_TOKEN=private"); },
    )).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  });
});

describe("controlled child processes", () => {
  async function runner(approve: boolean) {
    const workspace = await TrustedWorkspace.open(await temporary(), true);
    return new ControlledProcessRunner(workspace, new DefaultExecutionPolicy(), async () => approve);
  }
  function cmd(args: string[], signal = new AbortController().signal) {
    return { id: "command1", taskId: "task1", executable: process.execPath,
      args, mode: "build" as const, signal };
  }
  it("requires approval for the exact process and captures bounded output", async () => {
    const denied = await runner(false);
    await expect(denied.execute(cmd(["--version"]))).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    const allowed = await runner(true);
    const output = await allowed.execute(cmd(["--version"]));
    expect(output.exitCode).toBe(0);
    expect(output.stdout).toMatch(/^v\d+/);
  });
  it("rejects process commands in Ask/Plan even with an approving handler", async () => {
    const instance = await runner(true);
    await expect(instance.execute({ ...cmd(["--version"]), mode: "ask" }))
      .rejects.toMatchObject({ code: "POLICY_DENIED" });
  });
  it("denies unsafe commands and caps captured bytes", async () => {
    const instance = await runner(true);
    await expect(instance.execute(cmd(["--bad\0arg"]))).rejects.toMatchObject({ code: "POLICY_DENIED" });
    await expect(instance.execute({ ...cmd(["-e", "process.stdout.write('x'.repeat(10000))"]),
      maxOutputBytes: 100 })).rejects.toMatchObject({ code: "PROCESS_OUTPUT_LIMIT" });
  });
  it("enforces timeouts and cancellations", async () => {
    const instance = await runner(true);
    await expect(instance.execute({ ...cmd(["-e", "setInterval(() => {}, 1000)"]),
      timeoutMs: 200 })).rejects.toMatchObject({ code: "PROCESS_TIMEOUT" });
    const controller = new AbortController();
    const started = instance.execute(cmd(["-e", "setInterval(() => {}, 1000)"], controller.signal));
    setTimeout(() => controller.abort(), 100);
    await expect(started).rejects.toMatchObject({ code: "PROCESS_CANCELLED" });
  });
  it("hides failing process output from serialized domain errors", async () => {
    const instance = await runner(true);
    try {
      await instance.execute(cmd(["-e", "console.error('API_TOKEN=secret'); process.exit(3)"]));
      throw new Error("Expected failure");
    } catch (error) {
      expect(JSON.stringify(toPublicAgentError(error))).not.toContain("API_TOKEN");
    }
  });
});
