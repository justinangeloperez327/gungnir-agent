/** Declared agent modes; actual execution is not implemented yet. */
export type AgentMode = "ask" | "plan" | "build";

export interface AgentFoundation {
  readonly product: "gungnir-agent";
  readonly stage: "foundation";
  readonly languageContract: "1.0";
  readonly plannedModes: readonly AgentMode[];
}

export type { AgentErrorCode, PublicAgentError } from "./errors.js";
export type { TaskState, TaskSnapshot, TaskTransition } from "./task.js";
export type {
  ToolCapability, ToolRequest, ToolResult, ToolExecutionContext,
  ToolExecutor, ExecutionPolicy, PolicyDecision,
} from "./execution.js";
