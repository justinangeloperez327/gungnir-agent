import { createInterface } from "node:readline";
import type { AgentMode } from "@gungnir/contracts";
import { TrustedWorkspace } from "@gungnir/agent-core";
import { ModelTextBackend, resolveModelConfig } from "@gungnir/model-adapters";
import type { ModelConfigInput } from "@gungnir/model-adapters";
import { AgentCliSession, renderCliEvent, type EventSink } from "./session.js";

export interface InteractiveArguments {
  readonly mode: AgentMode;
  readonly message?: string;
  readonly projectRoot?: string;
  readonly trustWorkspace: boolean;
  readonly model?: ModelConfigInput;
}
export type ParsedArguments =
  | { readonly kind: "help" | "version" | "doctor"; readonly json?: boolean }
  | { readonly kind: "session"; readonly options: InteractiveArguments };

type NumericOption = Exclude<keyof ModelConfigInput, "provider" | "model">;
const MODEL_FLAGS: Readonly<Record<string, NumericOption>> = {
  "--max-output-tokens": "maxOutputTokens",
  "--session-output-tokens": "sessionOutputTokens",
  "--max-requests": "maxRequests",
  "--timeout-ms": "timeoutMs",
  "--input-usd-per-million": "inputPerMillionUsd",
  "--output-usd-per-million": "outputPerMillionUsd",
  "--max-estimated-usd": "maxEstimatedCostUsd",
};

export function parseCliArguments(args: readonly string[]): ParsedArguments {
  if (args.length === 0 || (args.length === 1 && ["--help", "-h"].includes(args[0]!))) {
    return { kind: "help" };
  }
  if (args.length === 1 && ["--version", "-v"].includes(args[0]!)) return { kind: "version" };
  if (args[0] === "doctor" && (args.length === 1 ||
    (args.length === 2 && args[1] === "--json"))) {
    return { kind: "doctor", json: args[1] === "--json" };
  }
  const entry = args[0];
  if (entry !== "interactive" && entry !== "ask" && entry !== "plan" && entry !== "build") {
    throw Error("Unsupported command");
  }
  let mode: AgentMode = entry === "interactive" ? "ask" : entry;
  let message: string | undefined;
  let projectRoot: string | undefined;
  let trustWorkspace = false;
  let provider: string | undefined;
  let model: string | undefined;
  const numeric: Partial<Record<NumericOption, number>> = {};
  const seen = new Set<string>();
  for (let i = 1; i < args.length; i++) {
    const flag = args[i]!;
    if (seen.has(flag)) throw Error("Duplicate CLI option");
    seen.add(flag);
    if (flag === "--trust-workspace") {
      trustWorkspace = true;
      continue;
    }
    if (!["--mode", "--message", "--project-root", "--provider", "--model",
      ...Object.keys(MODEL_FLAGS)].includes(flag)) throw Error("Unknown CLI option");
    const value = args[++i];
    if (!value || value.startsWith("--") || value.includes("\0")) throw Error("Invalid CLI value");
    if (flag === "--mode") {
      if (entry !== "interactive" || !["ask", "plan", "build"].includes(value)) {
        throw Error("Invalid mode");
      }
      mode = value as AgentMode;
    } else if (flag === "--message") {
      if (entry === "interactive" || value.length > 8192) throw Error("Invalid one-shot prompt");
      message = value;
    } else if (flag === "--project-root") {
      projectRoot = value;
    } else if (flag === "--provider") {
      provider = value;
    } else if (flag === "--model") {
      model = value;
    } else {
      const field = MODEL_FLAGS[flag]!;
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || value.trim() !== value) {
        throw Error("Invalid model budget");
      }
      numeric[field] = number;
    }
  }
  if (trustWorkspace !== (projectRoot !== undefined)) throw Error("Explicit workspace trust required");
  const hasNumeric = Object.keys(numeric).length > 0;
  if ((provider !== undefined) !== (model !== undefined) ||
      (hasNumeric && !provider)) throw Error("Both provider and model are required");
  return { kind: "session", options: {
    mode, trustWorkspace,
    ...(projectRoot ? { projectRoot } : {}),
    ...(message !== undefined ? { message } : {}),
    ...(provider && model ? { model: { provider, model, ...numeric } } : {}),
  } };
}

export async function runAgentTerminal(
  args: InteractiveArguments,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
  error: NodeJS.WritableStream = process.stderr,
): Promise<number> {
  const workspace = args.projectRoot
    ? await TrustedWorkspace.open(args.projectRoot, args.trustWorkspace) : undefined;
  const backend = args.model ? new ModelTextBackend(resolveModelConfig(args.model)) : undefined;
  const session = new AgentCliSession({
    mode: args.mode, ...(workspace ? { workspace } : {}), ...(backend ? { backend } : {}),
  });
  const sink: EventSink = event => renderCliEvent(event, output, error);
  if (args.message !== undefined) return (await session.handleLine(args.message, sink)).code;

  const tty = !!(input as NodeJS.ReadStream).isTTY && !!(output as NodeJS.WriteStream).isTTY;
  const rl = createInterface({ input, output, terminal: tty });
  const prompt = (): void => {
    if (tty) {
      rl.setPrompt("gungnir(" + session.mode + ")> ");
      rl.prompt();
    }
  };
  const interrupt = (): void => {
    if (session.cancelActive()) sink({ type: "line", text: "Cancellation requested." });
    else rl.close();
  };
  rl.on("SIGINT", interrupt);
  sink({ type: "line", text: "Gungnir Agent · Group 8 " +
    (backend ? "AI text streaming enabled." : "No model configured.") +
    " /help for commands." });
  prompt();
  try {
    for await (const line of rl) {
      const result = await session.handleLine(line, sink);
      if (!result.continue) break;
      prompt();
    }
    return 0;
  } finally {
    rl.off("SIGINT", interrupt);
    rl.close();
    session.cancelActive();
  }
}
