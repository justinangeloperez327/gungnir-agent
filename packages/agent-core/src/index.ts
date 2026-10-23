import type { AgentFoundation, AgentMode } from "@gungnir/contracts";
import { TARGET_LANGUAGE_CONTRACT } from "@gungnir/gungnir-toolchain";

export { AgentError, toPublicAgentError } from "./errors.js";
export type { AgentConfig, AgentLimits } from "./config.js";
export { parseAgentConfig } from "./config.js";
export { ServiceContainer, createServiceToken } from "./container.js";
export type { ServiceToken } from "./container.js";
export { TaskStateMachine } from "./task-state.js";

export const PLANNED_AGENT_MODES: readonly AgentMode[] = Object.freeze([
  "ask", "plan", "build",
]);

/** Foundation metadata, not an operational coding agent. */
export function getFoundationStatus(): AgentFoundation {
  return {
    product: "gungnir-agent", stage: "foundation",
    languageContract: TARGET_LANGUAGE_CONTRACT,
    plannedModes: [...PLANNED_AGENT_MODES],
  };
}
