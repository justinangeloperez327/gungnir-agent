import type { AgentErrorCode, PublicAgentError } from "@gungnir/contracts";

/** Only trusted, sanitized messages should be used for domain errors. */
export class AgentError extends Error {
  public override readonly name = "AgentError";

  constructor(
    public readonly code: AgentErrorCode,
    message: string,
    public readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** Generic exceptions may contain secrets: never serialize their messages. */
export function toPublicAgentError(error: unknown): PublicAgentError {
  if (error instanceof AgentError) {
    return Object.freeze({
      code: error.code, message: error.message, retryable: error.retryable,
    });
  }
  return Object.freeze({
    code: "INTERNAL_ERROR", message: "Unexpected agent error", retryable: false,
  });
}
