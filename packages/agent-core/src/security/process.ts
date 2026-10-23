import { spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { AgentMode, ToolRequest } from "@gungnir/contracts";
import { AgentError } from "../errors.js";
import { TrustedWorkspace } from "./workspace.js";
import { DefaultExecutionPolicy, enforcePermission } from "./policy.js";
import type { ApprovalHandler } from "./policy.js";

export interface ProcessCommand {
  readonly id: string;
  readonly taskId: string;
  readonly executable: string;
  readonly args: readonly string[];
  readonly mode: AgentMode;
  readonly signal: AbortSignal;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

export interface ProcessOutcome {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/**
 * Low-level host-only primitive; it is NOT registered as a model tool.
 * Commands are specifically approved after resolving the executable.
 * It is not an OS sandbox, and does not guarantee termination of descendants.
 */
export class ControlledProcessRunner {
  constructor(
    private readonly workspace: TrustedWorkspace,
    private readonly policy = new DefaultExecutionPolicy(),
    private readonly approval?: ApprovalHandler,
  ) {}

  async execute(command: ProcessCommand): Promise<ProcessOutcome> {
    const timeout = command.timeoutMs ?? 30_000;
    const limit = command.maxOutputBytes ?? 65_536;
    if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 600_000 ||
        !Number.isSafeInteger(limit) || limit < 64 || limit > 1_048_576 ||
        !Array.isArray(command.args) || command.args.length > 64 ||
        command.args.some(arg => typeof arg !== "string" || arg.includes("\0") || arg.length > 8192) ||
        command.signal.aborted || !path.isAbsolute(command.executable) ||
        command.executable.includes("\0")) {
      throw new AgentError("POLICY_DENIED", "Invalid or cancelled process request");
    }

    // Resolve a concrete executable path before showing the approval request.
    let executable: string;
    try {
      executable = await realpath(command.executable);
      if (!(await stat(executable)).isFile()) throw new Error("not executable");
    } catch {
      throw new AgentError("POLICY_DENIED", "Requested executable could not be verified");
    }
    const toolRequest: ToolRequest = Object.freeze({
      id: command.id, taskId: command.taskId,
      toolName: "process.execute", capability: "process.execute",
      input: Object.freeze({
        executable, args: Object.freeze([...command.args]), cwd: this.workspace.root,
      }),
    });
    await enforcePermission(this.policy, toolRequest, command.mode, this.approval);
    if (command.signal.aborted) {
      throw new AgentError("PROCESS_CANCELLED", "Process cancelled");
    }

    // Minimal inherited environment; no tokens/provider secrets by default.
    const allowedEnv = [
      "PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "HOME",
      "USERPROFILE", "GUNGNIR_CMAKE_PREFIX",
    ];
    const env: NodeJS.ProcessEnv = {};
    for (const name of allowedEnv) {
      if (process.env[name] !== undefined) env[name] = process.env[name];
    }
    return await new Promise<ProcessOutcome>((resolve, reject) => {
      let child;
      try {
        child = spawn(executable, [...command.args], {
          cwd: this.workspace.root, env, shell: false, windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch {
        reject(new AgentError("PROCESS_FAILED", "Unable to launch approved process"));
        return;
      }
      let stdout = "";
      let stderr = "";
      let bytes = 0;
      let ended = false;
      let failure: AgentError | undefined;
      const fail = (error: AgentError): void => {
        if (!failure) failure = error;
        child.kill();
      };
      const onAbort = (): void => {
        fail(new AgentError("PROCESS_CANCELLED", "Process cancelled"));
      };
      const timer = setTimeout(
        () => fail(new AgentError("PROCESS_TIMEOUT", "Process exceeded time limit")),
        timeout,
      );
      const cleanup = (): void => {
        clearTimeout(timer);
        command.signal.removeEventListener("abort", onAbort);
      };
      command.signal.addEventListener("abort", onAbort, { once: true });
      const consume = (kind: "stdout" | "stderr", chunk: Buffer): void => {
        bytes += chunk.length;
        if (bytes > limit) {
          fail(new AgentError("PROCESS_OUTPUT_LIMIT", "Process output limit exceeded"));
          return;
        }
        if (kind === "stdout") stdout += chunk.toString("utf8");
        else stderr += chunk.toString("utf8");
      };
      child.stdout?.on("data", (chunk: Buffer) => consume("stdout", chunk));
      child.stderr?.on("data", (chunk: Buffer) => consume("stderr", chunk));
      child.once("error", () => {
        if (ended) return;
        ended = true;
        cleanup();
        reject(failure ?? new AgentError("PROCESS_FAILED", "Unable to launch approved process"));
      });
      child.once("close", code => {
        if (ended) return;
        ended = true;
        cleanup();
        if (failure) reject(failure);
        else if (code !== 0) reject(new AgentError("PROCESS_FAILED", "Approved process exited unsuccessfully"));
        else resolve(Object.freeze({ stdout, stderr, exitCode: code }));
      });
      if (command.signal.aborted) onAbort();
    });
  }
}
