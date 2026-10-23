/** Modes reserved by the public agent contract. Implementations arrive in later groups. */
export type AgentMode = "ask" | "plan" | "build";

export interface AgentFoundation {
  readonly product: "gungnir-agent";
  readonly stage: "foundation";
  readonly languageContract: "1.0";
  readonly plannedModes: readonly AgentMode[];
}
