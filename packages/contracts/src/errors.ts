export type AgentErrorCode =
  | "CONFIG_INVALID"
  | "SERVICE_ALREADY_REGISTERED"
  | "SERVICE_NOT_FOUND"
  | "SERVICE_CYCLE"
  | "TASK_INVALID"
  | "TASK_TRANSITION_INVALID"
  | "INTERNAL_ERROR";

export interface PublicAgentError {
  readonly code: AgentErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}
