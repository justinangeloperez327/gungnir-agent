import { isAbsolute, normalize } from "node:path";
import type { AgentMode } from "@gungnir/contracts";
import { AgentError } from "./errors.js";

export interface AgentLimits {
  readonly maxSteps: number;
  readonly maxRetries: number;
  readonly timeoutMs: number;
}

export interface AgentConfig {
  /** A syntactic absolute path; realpath checks arrive in Group 4. */
  readonly workspaceRoot: string;
  /** Configuration never grants execution permission. */
  readonly mode: AgentMode;
  readonly limits: AgentLimits;
}

const defaults: AgentLimits = Object.freeze({
  maxSteps: 20, maxRetries: 2, timeoutMs: 120_000,
});

function asRecord(input: unknown, field: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new AgentError("CONFIG_INVALID", `Invalid ${field}: expected object`);
  }
  return input as Record<string, unknown>;
}

function onlyFields(input: Record<string, unknown>, fields: readonly string[]): void {
  for (const key of Object.keys(input)) {
    if (!fields.includes(key)) {
      throw new AgentError("CONFIG_INVALID", "Unexpected configuration field");
    }
  }
}

function boundedInteger(
  value: unknown, key: string, min: number, max: number,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) ||
      value < min || value > max) {
    throw new AgentError("CONFIG_INVALID", `Invalid ${key}: out of range`);
  }
  return value;
}

/** Pure validation: does not grant permissions or access the file system. */
export function parseAgentConfig(input: unknown): AgentConfig {
  const obj = asRecord(input, "configuration");
  onlyFields(obj, ["workspaceRoot", "mode", "limits"]);
  const root = obj["workspaceRoot"];
  if (typeof root !== "string" || root.length === 0 || root.trim() !== root ||
      root.includes("\0") || !isAbsolute(root)) {
    throw new AgentError("CONFIG_INVALID", "Invalid workspaceRoot: expected absolute path");
  }
  const mode = obj["mode"] ?? "ask";
  if (mode !== "ask" && mode !== "plan" && mode !== "build") {
    throw new AgentError("CONFIG_INVALID", "Invalid mode");
  }
  const supplied = obj["limits"] === undefined
    ? {} : asRecord(obj["limits"], "limits");
  onlyFields(supplied, ["maxSteps", "maxRetries", "timeoutMs"]);
  const limits: AgentLimits = Object.freeze({
    maxSteps: supplied["maxSteps"] === undefined
      ? defaults.maxSteps : boundedInteger(supplied["maxSteps"], "maxSteps", 1, 100),
    maxRetries: supplied["maxRetries"] === undefined
      ? defaults.maxRetries : boundedInteger(supplied["maxRetries"], "maxRetries", 0, 10),
    timeoutMs: supplied["timeoutMs"] === undefined
      ? defaults.timeoutMs : boundedInteger(supplied["timeoutMs"], "timeoutMs", 1_000, 600_000),
  });
  return Object.freeze({ workspaceRoot: normalize(root), mode, limits });
}
