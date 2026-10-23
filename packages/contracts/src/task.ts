import type { AgentMode } from "./index.js";

export type TaskState =
  | "queued" | "planned" | "running" | "awaiting-approval"
  | "succeeded" | "failed" | "cancelled";

export interface TaskTransition {
  readonly from: TaskState;
  readonly to: TaskState;
  readonly at: number;
  readonly revision: number;
}

export interface TaskSnapshot {
  readonly id: string;
  readonly mode: AgentMode;
  readonly state: TaskState;
  readonly revision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly history: readonly TaskTransition[];
}
