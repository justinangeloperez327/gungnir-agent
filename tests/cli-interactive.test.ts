import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { AgentCliSession, renderCliEvent } from "../apps/cli/src/session.js";
import { parseCliArguments } from "../apps/cli/src/terminal.js";
import { TrustedWorkspace } from "@gungnir/agent-core";
import type { CliEvent } from "../apps/cli/src/session.js";

const cli = path.resolve("apps/cli/dist/index.js");
const roots: string[] = [];
async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "gungnir-cli-"));
  roots.push(root);
  await mkdir(path.join(root, "app", "models"), { recursive: true });
  await writeFile(path.join(root, ".gungnir-project"), "name=demo\nprofile=structured\n");
  await writeFile(path.join(root, "app", "models", "User.gnr"), "model User {\n  string name;\n}\n");
  return root;
}
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("CLI argument parsing", () => {
  it("accepts modes with one-shot messages and trusted interactive roots", () => {
    expect(parseCliArguments(["plan", "--message", "Design a route"])).toEqual({
      kind: "session", options: {
        mode: "plan", message: "Design a route", trustWorkspace: false,
      },
    });
    const command = parseCliArguments(["interactive", "--mode", "build",
      "--project-root", "/some/path", "--trust-workspace"]);
    expect(command.kind).toBe("session");
    if (command.kind === "session") expect(command.options.mode).toBe("build");
  });
  it.each([
    ["unknown"], ["interactive", "--message", "invalid"],
    ["ask", "--mode", "plan"], ["interactive", "--mode", "other"],
    ["ask", "--message"], ["ask", "--message", "ok", "--message", "again"],
    ["ask", "--project-root", "private"], ["ask", "--trust-workspace"],
  ])("refuses malformed or untrusted arguments: %s", (...args) => {
    expect(() => parseCliArguments(args)).toThrow();
  });
});

describe("CLI streaming and cancellation boundaries", () => {
  it("switches modes while withholding unconfigured model responses", async () => {
    const session = new AgentCliSession();
    const events: CliEvent[] = [];
    const emit = (event: CliEvent): void => { events.push(event); };
    expect((await session.handleLine("/mode plan", emit)).code).toBe(0);
    expect(session.mode).toBe("plan");
    const reply = await session.handleLine("please plan a Gungnir app", emit);
    expect(reply.code).toBe(3);
    expect(session.lastTask?.state).toBe("failed");
    expect(events.some(e => e.type === "error" && e.text.includes("Configure --provider and --model"))).toBe(true);
    await session.handleLine("/status", emit);
    expect(events.some(e => e.type === "line" && e.text.includes("Model backend: unavailable"))).toBe(true);
  });
  it("streams injected text chunks without granting any process or file tools", async () => {
    const events: CliEvent[] = [];
    const session = new AgentCliSession({ mode: "ask", backend: {
      async *streamText() {
        yield "Gungnir ";
        yield "framework";
      },
    } });
    const result = await session.handleLine("What is Gungnir?", e => events.push(e));
    expect(result.code).toBe(0);
    expect(events.filter(e => e.type === "token").map(e => e.text).join(""))
      .toBe("Gungnir framework");
    expect(session.lastTask?.state).toBe("succeeded");
    expect(session.lastTask?.revision).toBe(3);
  });
  it("cancels an active text backend and records cancelled state", async () => {
    const events: CliEvent[] = [];
    let ready!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; });
    const session = new AgentCliSession({ backend: {
      async *streamText({ signal }) {
        ready();
        await new Promise<void>(resolve => {
          if (signal.aborted) resolve();
          else signal.addEventListener("abort", () => resolve(), { once: true });
        });
        yield "ignored after cancellation";
      },
    } });
    const task = session.handleLine("test", e => events.push(e));
    await started;
    expect(session.cancelActive()).toBe(true);
    const result = await task;
    expect(result.code).toBe(130);
    expect(session.lastTask?.state).toBe("cancelled");
    expect(events.some(e => e.type === "token")).toBe(false);
  });
  it("limits streaming output size and hides backend exception messages", async () => {
    const out: CliEvent[] = [];
    const tooLarge = new AgentCliSession({ backend: {
      async *streamText() { yield "x".repeat(262145); },
    } });
    expect((await tooLarge.handleLine("go", e => out.push(e))).code).toBe(1);
    expect(tooLarge.lastTask?.state).toBe("failed");
    expect(out.some(e => e.type === "error" && e.text.includes("CONTEXT_LIMIT"))).toBe(true);
    const secret: CliEvent[] = [];
    const errors = new AgentCliSession({ backend: {
      async *streamText(): AsyncGenerator<string> { yield "public text"; throw new Error("SECRET_API_KEY=private"); },
    } });
    await errors.handleLine("go", e => secret.push(e));
    expect(JSON.stringify(secret)).not.toContain("SECRET_API_KEY");
  });
  it("strips terminal controls from streamed events", () => {
    let out = "";
    const stream = new Writable({ write(chunk: Buffer, _encoding, callback) {
      out += chunk.toString("utf8");
      callback();
    } });
    renderCliEvent({ type: "token", text: "safe\u001b[31m red" }, stream, stream);
    expect(out).not.toContain("\u001b");
  });
});

describe("interactive subprocess behavior", () => {
  it("accepts piped session commands and exits cleanly", () => {
    const proc = spawnSync(process.execPath, [cli, "interactive"], {
      encoding: "utf8", input: "/mode plan\n/status\n/exit\n", timeout: 5000,
    });
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("Mode: plan");
    expect(proc.stdout).toContain("Model backend: unavailable");
  });
  it("provides explicit read-only project inspection when trust is supplied", async () => {
    const root = await fixture();
    const proc = spawnSync(process.execPath, [
      cli, "interactive", "--project-root", root, "--trust-workspace",
    ], {
      encoding: "utf8", input: "/files\n/search model User\n/read app/models/User.gnr 1 2\n/exit\n",
      timeout: 5000,
    });
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("app/models/User.gnr [model]");
    expect(proc.stdout).toContain("app/models/User.gnr:1");
    expect(proc.stdout).toContain("1: model User {");
  });
  it("requires trust for browsing and blocks unknown slash commands", async () => {
    const root = await fixture();
    const workspace = await TrustedWorkspace.open(root, true);
    const session = new AgentCliSession({ workspace });
    const events: CliEvent[] = [];
    expect((await session.handleLine("/deploy", e => events.push(e))).code).toBe(2);
    expect((await new AgentCliSession().handleLine("/files", e => events.push(e))).code).toBe(1);
    expect(JSON.stringify(events)).toContain("WORKSPACE_UNTRUSTED");
  });
});
