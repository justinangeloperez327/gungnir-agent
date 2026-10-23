import type { AgentFoundation, AgentMode } from "@gungnir/contracts";
import { TARGET_LANGUAGE_CONTRACT } from "@gungnir/gungnir-toolchain";

export { AgentError, toPublicAgentError } from "./errors.js";
export type { AgentConfig, AgentLimits } from "./config.js";
export { parseAgentConfig } from "./config.js";
export { ServiceContainer, createServiceToken } from "./container.js";
export type { ServiceToken } from "./container.js";
export { TaskStateMachine } from "./task-state.js";
export { TrustedWorkspace } from "./security/workspace.js";
export { DefaultExecutionPolicy, enforcePermission } from "./security/policy.js";
export type { ApprovalHandler } from "./security/policy.js";
export { ControlledProcessRunner } from "./security/process.js";
export type { ProcessCommand, ProcessOutcome } from "./security/process.js";
export { GungnirProjectIndex } from "./context/project.js";
export type {
  ProjectProfile, FileCategory, ProjectMetadata, SourceSummary,
  ProjectIndexOptions, ProjectIndexStatistics, ContextMatch,
  ContextQueryOptions, SourceLines,
} from "./context/project.js";

export const PLANNED_AGENT_MODES: readonly AgentMode[] = Object.freeze(["ask", "plan", "build"]);
/** Agent modes are not operational until later groups. */
export function getFoundationStatus(): AgentFoundation {
  return {
    product: "gungnir-agent", stage: "foundation",
    languageContract: TARGET_LANGUAGE_CONTRACT,
    plannedModes: [...PLANNED_AGENT_MODES],
  };
}
