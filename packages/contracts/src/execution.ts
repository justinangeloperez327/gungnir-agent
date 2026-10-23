import type { AgentMode } from "./index.js";
import type { PublicAgentError } from "./errors.js";

export type ToolCapability =
  | "workspace.read" | "workspace.write" | "process.execute"
  | "git.write" | "database.migrate" | "publish" | "deploy";

export interface ToolRequest<TInput = unknown> {
  readonly id: string;
  readonly taskId: string;
  readonly toolName: string;
  readonly capability: ToolCapability;
  readonly input: TInput;
}

export type ToolResult<TOutput = unknown> =
  | { readonly ok: true; readonly value: TOutput }
  | { readonly ok: false; readonly error: PublicAgentError };

export interface ToolExecutionContext {
  readonly signal: AbortSignal;
  readonly workspaceRoot: string;
}

export interface ToolExecutor {
  execute<TInput, TOutput>(
    request: ToolRequest<TInput>,
    context: ToolExecutionContext,
  ): Promise<ToolResult<TOutput>>;
}

export type PolicyDecision = "allow" | "deny" | "require-approval";

export interface ExecutionPolicy {
  evaluate(request: ToolRequest, mode: AgentMode): PolicyDecision;
}
