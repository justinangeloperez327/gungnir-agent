import type {
  AgentMode, ExecutionPolicy, PolicyDecision, ToolRequest,
} from "@gungnir/contracts";
import { AgentError } from "../errors.js";

/**
 * Human-origin approval handler, installed only by a trusted host.
 * A language model/tool result must never be wired as the approval source.
 */
export type ApprovalHandler = (request: Readonly<ToolRequest>) => Promise<boolean>;

/** Fail-closed default for destructive capabilities, even in Build mode. */
export class DefaultExecutionPolicy implements ExecutionPolicy {
  evaluate(request: ToolRequest, mode: AgentMode): PolicyDecision {
    if (!request.id || !request.taskId || !request.toolName) return "deny";
    if (request.capability === "workspace.read") return "allow";
    if (mode !== "build") return "deny";
    if (request.capability === "workspace.write" || request.capability === "process.execute") {
      return "require-approval";
    }
    return "deny";
  }
}

/** Ask the trusted host once for the exact request; never cache blanket grants. */
export async function enforcePermission(
  policy: ExecutionPolicy,
  request: ToolRequest,
  mode: AgentMode,
  approval?: ApprovalHandler,
): Promise<void> {
  const decision = policy.evaluate(request, mode);
  if (decision === "allow") return;
  if (decision === "deny") throw new AgentError("POLICY_DENIED", "Operation denied by policy");
  if (!approval) throw new AgentError("APPROVAL_REQUIRED", "Explicit user approval required");
  let accepted = false;
  try { accepted = await approval(Object.freeze(request)); } catch { /* fail closed */ }
  if (!accepted) throw new AgentError("APPROVAL_REQUIRED", "Explicit user approval required");
}
