import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  AgentError, createServiceToken, parseAgentConfig, ServiceContainer,
  TaskStateMachine, toPublicAgentError,
} from "@gungnir/agent-core";
import type { AgentConfig, ExecutionPolicy, ToolRequest, ToolResult } from "@gungnir/contracts";

const workspaceRoot = resolve("fixtures");

describe("configuration validation", () => {
  it("uses safe, frozen defaults", () => {
    const config = parseAgentConfig({ workspaceRoot });
    expect(config).toEqual({
      workspaceRoot, mode: "ask",
      limits: { maxSteps: 20, maxRetries: 2, timeoutMs: 120000 },
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.limits)).toBe(true);
  });

  it("accepts bounded overrides; build mode does not grant permission", () => {
    const config: AgentConfig = parseAgentConfig({
      workspaceRoot, mode: "build",
      limits: { maxSteps: 100, maxRetries: 0, timeoutMs: 1000 },
    });
    expect(config.mode).toBe("build");
    expect(config.limits.maxRetries).toBe(0);
  });

  it.each([
    null, "bad", [], {}, { workspaceRoot: "relative" },
    { workspaceRoot: "" }, { workspaceRoot: workspaceRoot + "\0secret" },
    { workspaceRoot, mode: "root" }, { workspaceRoot, limits: [] },
    { workspaceRoot, unexpected: true }, { workspaceRoot, limits: { unknown: 3 } },
    { workspaceRoot, limits: { maxSteps: 0 } },
    { workspaceRoot, limits: { maxRetries: -1 } },
    { workspaceRoot, limits: { timeoutMs: 999 } },
    { workspaceRoot, limits: { maxSteps: 2.5 } },
    { workspaceRoot, limits: { timeoutMs: Infinity } },
  ])("rejects malformed input without exposing its values", (value) => {
    expect(() => parseAgentConfig(value)).toThrow(AgentError);
    try {
      parseAgentConfig(value);
    } catch (error) {
      expect(toPublicAgentError(error).code).toBe("CONFIG_INVALID");
      expect(toPublicAgentError(error).message).not.toContain("secret");
    }
  });
});

describe("service container", () => {
  it("caches singleton undefined and constructs transients each time", () => {
    const singleton = createServiceToken<number | undefined>("singleton");
    const transient = createServiceToken<{ id: number }>("transient");
    let singleCount = 0;
    let transCount = 0;
    const c = new ServiceContainer();
    c.registerSingleton(singleton, () => { singleCount++; return undefined; });
    c.registerTransient(transient, () => ({ id: ++transCount }));
    c.resolve(singleton); c.resolve(singleton);
    expect(singleCount).toBe(1);
    expect(c.resolve(transient).id).toBe(1);
    expect(c.resolve(transient).id).toBe(2);
  });

  it("resolves nested dependencies and isolates containers", () => {
    const a = createServiceToken<number>("a");
    const b = createServiceToken<number>("b");
    const c = new ServiceContainer();
    c.registerSingleton(a, () => 41).registerSingleton(b, x => x.resolve(a) + 1);
    expect(c.resolve(b)).toBe(42);
    expect(() => new ServiceContainer().resolve(a)).toThrow(/not registered/);
  });

  it("rejects duplicate registration and circular references", () => {
    const a = createServiceToken<number>("a");
    const b = createServiceToken<number>("b");
    const c = new ServiceContainer();
    c.registerSingleton(a, x => x.resolve(b));
    c.registerSingleton(b, x => x.resolve(a));
    expect(() => c.resolve(a)).toThrow(/Circular/);
    expect(() => c.registerTransient(a, () => 1)).toThrow(/already/);
  });

  it("recovers from a factory that throws without poisoning the container", () => {
    const token = createServiceToken<number>("unstable");
    let calls = 0;
    const c = new ServiceContainer();
    c.registerSingleton(token, () => { if (++calls === 1) throw Error("temporary"); return 7; });
    expect(() => c.resolve(token)).toThrow("temporary");
    expect(c.resolve(token)).toBe(7);
  });
});

describe("error safety", () => {
  it("does not serialize unexpected errors or causes", () => {
    const secret = "token:secret-do-not-log";
    const known = new AgentError("SERVICE_NOT_FOUND", "Service not registered", false, {
      cause: new Error(secret),
    });
    expect(JSON.stringify(toPublicAgentError(known))).not.toContain(secret);
    expect(toPublicAgentError(new Error(secret))).toEqual({
      code: "INTERNAL_ERROR", message: "Unexpected agent error", retryable: false,
    });
  });
});

describe("task state machine", () => {
  it("follows a planned, approved, running, completed workflow", () => {
    let time = 100;
    const task = new TaskStateMachine("task:001", "build", () => time++);
    const first = task.snapshot();
    task.transition("planned");
    task.transition("awaiting-approval");
    task.transition("running");
    task.transition("succeeded");
    const last = task.snapshot();
    expect(last).toMatchObject({
      id: "task:001", state: "succeeded", revision: 4,
      createdAt: 100, updatedAt: 104,
    });
    expect(last.history.map(x => x.to)).toEqual([
      "planned", "awaiting-approval", "running", "succeeded",
    ]);
    expect(first.history).toHaveLength(0);
    expect(Object.isFrozen(last.history)).toBe(true);
    expect(Object.isFrozen(last)).toBe(true);
  });

  it("rejects illegal transitions, invalid IDs and invalid clocks", () => {
    const task = new TaskStateMachine("ok", "plan", () => 50);
    expect(() => task.transition("succeeded")).toThrow(AgentError);
    task.transition("cancelled");
    expect(() => task.transition("running")).toThrow(AgentError);
    expect(task.snapshot().revision).toBe(1);
    expect(() => new TaskStateMachine("../escape", "ask")).toThrow(AgentError);
    expect(() => new TaskStateMachine("bad-clock", "ask", () => NaN)).toThrow(AgentError);
  });
});

describe("future execution contracts", () => {
  it("remain interfaces, not runnable tools", () => {
    const request: ToolRequest = {
      id: "t", taskId: "task:1", toolName: "inspect", capability: "workspace.read", input: {},
    };
    const policy: ExecutionPolicy = {
      evaluate: (_tool, mode) => mode === "ask" ? "allow" : "require-approval",
    };
    const result: ToolResult<string> = { ok: true, value: "declaration" };
    expect(policy.evaluate(request, "ask")).toBe("allow");
    expect(result.ok).toBe(true);
  });
});
