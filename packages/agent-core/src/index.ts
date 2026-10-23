import type { AgentFoundation, AgentMode } from "@gungnir/contracts";
import { TARGET_LANGUAGE_CONTRACT } from "@gungnir/gungnir-toolchain";

export const PLANNED_AGENT_MODES: readonly AgentMode[] = Object.freeze([
  "ask",
  "plan",
  "build",
]);

/** Foundation metadata, not an operational coding agent. */
export function getFoundationStatus(): AgentFoundation {
  return {
    product: "gungnir-agent",
    stage: "foundation",
    languageContract: TARGET_LANGUAGE_CONTRACT,
    plannedModes: [...PLANNED_AGENT_MODES],
  };
}
