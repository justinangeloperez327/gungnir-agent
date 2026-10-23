import type { AgentMode, TaskSnapshot, TaskState, TaskTransition } from "@gungnir/contracts";
import { AgentError } from "./errors.js";

const allowed: Readonly<Record<TaskState, readonly TaskState[]>> = {
  queued: ["planned", "failed", "cancelled"],
  planned: ["running", "awaiting-approval", "failed", "cancelled"],
  running: ["awaiting-approval", "succeeded", "failed", "cancelled"],
  "awaiting-approval": ["running", "failed", "cancelled"],
  succeeded: [], failed: [], cancelled: [],
};

/** In-memory only. Durable recovery arrives in Group 10. */
export class TaskStateMachine {
  private state: TaskState = "queued";
  private revision = 0;
  private readonly createdAt: number;
  private updatedAt: number;
  private readonly events: TaskTransition[] = [];

  constructor(
    private readonly id: string,
    private readonly mode: AgentMode,
    private readonly clock: () => number = Date.now,
  ) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(id)) {
      throw new AgentError("TASK_INVALID", "Invalid task identifier");
    }
    this.createdAt = this.readClock();
    this.updatedAt = this.createdAt;
  }

  private readClock(): number {
    const time = this.clock();
    if (!Number.isSafeInteger(time) || time < 0) {
      throw new AgentError("TASK_INVALID", "Invalid task clock");
    }
    return time;
  }

  transition(next: TaskState): TaskSnapshot {
    if (!allowed[this.state].includes(next)) {
      throw new AgentError("TASK_TRANSITION_INVALID", "Invalid task state transition");
    }
    const from = this.state;
    const now = Math.max(this.updatedAt, this.readClock());
    this.state = next;
    this.revision += 1;
    this.updatedAt = now;
    this.events.push(Object.freeze({ from, to: next, at: now, revision: this.revision }));
    if (this.events.length > 256) this.events.shift();
    return this.snapshot();
  }

  snapshot(): TaskSnapshot {
    return Object.freeze({
      id: this.id, mode: this.mode, state: this.state,
      revision: this.revision, createdAt: this.createdAt,
      updatedAt: this.updatedAt, history: Object.freeze([...this.events]),
    });
  }
}
