import { AgentError } from "@gungnir/agent-core";

export type ModelProvider = "openai" | "anthropic" | "gateway";
export interface Pricing {
  readonly inputPerMillionUsd: number;
  readonly outputPerMillionUsd: number;
  readonly maxEstimatedCostUsd: number;
}
export interface ModelConfig {
  readonly provider: ModelProvider;
  readonly model: string;
  readonly apiKey: string;
  readonly maxOutputTokens: number;
  readonly sessionOutputTokens: number;
  readonly maxRequests: number;
  readonly timeoutMs: number;
  readonly pricing?: Pricing;
}
export interface ModelConfigInput {
  readonly provider: string;
  readonly model: string;
  readonly maxOutputTokens?: number;
  readonly sessionOutputTokens?: number;
  readonly maxRequests?: number;
  readonly timeoutMs?: number;
  readonly inputPerMillionUsd?: number;
  readonly outputPerMillionUsd?: number;
  readonly maxEstimatedCostUsd?: number;
}

const KEY_NAMES = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gateway: "AI_GATEWAY_API_KEY",
} as const;

function integer(value: unknown, name: string, low: number, high: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < low || value > high) {
    throw new AgentError("MODEL_CONFIG_INVALID", "Invalid " + name);
  }
  return value;
}
function price(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1000) {
    throw new AgentError("MODEL_CONFIG_INVALID", "Invalid " + name);
  }
  return value;
}
/** No default provider/model or command-line key; explicit opt-in prevents surprise charges. */
export function resolveModelConfig(
  input: ModelConfigInput, env: NodeJS.ProcessEnv = process.env,
): ModelConfig {
  const provider = input.provider;
  if (provider !== "openai" && provider !== "anthropic" && provider !== "gateway") {
    throw new AgentError("MODEL_CONFIG_INVALID", "Unknown provider");
  }
  const model = input.model;
  if (typeof model !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(model)) {
    throw new AgentError("MODEL_CONFIG_INVALID", "Invalid model identifier");
  }
  if (provider === "gateway" && !/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._:/-]+$/.test(model)) {
    throw new AgentError("MODEL_CONFIG_INVALID", "Gateway models require provider/model");
  }
  const apiKey = env[KEY_NAMES[provider]];
  if (typeof apiKey !== "string" || !apiKey.trim() || /[\r\n\0]/.test(apiKey) ||
    apiKey.length > 4096) {
    throw new AgentError("MODEL_CREDENTIAL_MISSING",
      "Set " + KEY_NAMES[provider] + " in the environment");
  }
  const maxOutputTokens = integer(input.maxOutputTokens ?? 512, "maxOutputTokens", 1, 4096);
  const sessionOutputTokens = integer(input.sessionOutputTokens ?? 4096,
    "sessionOutputTokens", maxOutputTokens, 100000);
  const maxRequests = integer(input.maxRequests ?? 20, "maxRequests", 1, 100);
  const timeoutMs = integer(input.timeoutMs ?? 60000, "timeoutMs", 1000, 300000);
  let pricing: Pricing | undefined;
  if ([input.inputPerMillionUsd,input.outputPerMillionUsd,input.maxEstimatedCostUsd]
      .some(value => value !== undefined)) {
    const inRate = price(input.inputPerMillionUsd, "inputPerMillionUsd");
    const outRate = price(input.outputPerMillionUsd, "outputPerMillionUsd");
    const cap = price(input.maxEstimatedCostUsd, "maxEstimatedCostUsd");
    if (cap <= 0) throw new AgentError("MODEL_CONFIG_INVALID", "Cost cap must be positive");
    pricing = Object.freeze({
      inputPerMillionUsd: inRate, outputPerMillionUsd: outRate,
      maxEstimatedCostUsd: cap,
    });
  }
  return Object.freeze({
    provider, model, apiKey, maxOutputTokens, sessionOutputTokens, maxRequests,
    timeoutMs, ...(pricing ? { pricing } : {}),
  });
}
