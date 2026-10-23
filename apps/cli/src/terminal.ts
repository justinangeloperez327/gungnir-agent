import { createInterface } from "node:readline";
import type { AgentMode } from "@gungnir/contracts";
import { TrustedWorkspace } from "@gungnir/agent-core";
import { AgentCliSession, renderCliEvent, type EventSink } from "./session.js";

export interface InteractiveArguments {
  readonly mode: AgentMode;
  readonly message?: string;
  readonly projectRoot?: string;
  readonly trustWorkspace: boolean;
}

export type ParsedArguments =
  | { readonly kind: "help" | "version" | "doctor"; readonly json?: boolean }
  | { readonly kind: "session"; readonly options: InteractiveArguments };

export function parseCliArguments(args: readonly string[]): ParsedArguments {
  if (args.length === 0 || (args.length === 1 && ["--help", "-h"].includes(args[0]!))) {
    return { kind: "help" };
  }
  if (args.length === 1 && ["--version", "-v"].includes(args[0]!)) {
    return { kind: "version" };
  }
  if (args[0] === "doctor" && (args.length === 1 || args.length === 2 && args[1] === "--json")) {
    return { kind: "doctor", json: args[1] === "--json" };
  }
  const entry = args[0];
  if (entry !== "interactive" && entry !== "ask" && entry !== "plan" && entry !== "build") {
    throw new Error("Unsupported command");
  }
  let mode: AgentMode = entry === "interactive" ? "ask" : entry;
  let message: string | undefined;
  let projectRoot: string | undefined;
  let trustWorkspace = false;
  const seen = new Set<string>();
  for (let index = 1; index < args.length; index++) {
    const flag = args[index]!;
    if (!["--mode", "--message", "--project-root", "--trust-workspace"].includes(flag) ||
        seen.has(flag)) throw new Error("Unsupported or repeated option");
    seen.add(flag);
    if (flag === "--trust-workspace") {
      trustWorkspace = true;
      continue;
    }
    const value = args[++index];
    if (!value || value.startsWith("--") || value.includes("\0")) {
      throw new Error("Missing or invalid option value");
    }
    switch (flag) {
      case "--mode":
        if (entry !== "interactive" ||
            (value !== "ask" && value !== "plan" && value !== "build")) {
          throw new Error("Invalid interactive mode");
        }
        mode = value;
        break;
      case "--message":
        if (entry === "interactive" || value.length > 8192) {
          throw new Error("Invalid one-shot message");
        }
        message = value;
        break;
      case "--project-root":
        projectRoot = value;
        break;
    }
  }
  if (trustWorkspace !== (projectRoot !== undefined)) {
    throw new Error("Project access requires both --project-root and --trust-workspace");
  }
  return {
    kind: "session",
    options: {
      mode, trustWorkspace,
      ...(message !== undefined ? { message } : {}),
      ...(projectRoot !== undefined ? { projectRoot } : {}),
    },
  };
}

export async function runAgentTerminal(
  args: InteractiveArguments,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
  error: NodeJS.WritableStream = process.stderr,
): Promise<number> {
  const workspace = args.projectRoot
    ? await TrustedWorkspace.open(args.projectRoot, args.trustWorkspace)
    : undefined;
  const session = new AgentCliSession({ mode: args.mode, ...(workspace ? { workspace } : {}) });
  const sink: EventSink = event => renderCliEvent(event, output, error);
  if (args.message !== undefined) {
    return (await session.handleLine(args.message, sink)).code;
  }

  const isInteractive = !!(input as NodeJS.ReadStream).isTTY && !!(output as NodeJS.WriteStream).isTTY;
  const rl = createInterface({ input, output, terminal: isInteractive });
  const prompt = (): void => {
    if (isInteractive) rl.setPrompt("gungnir(" + session.mode + ")> ");
    if (isInteractive) rl.prompt();
  };
  const onInterrupt = (): void => {
    if (session.cancelActive()) sink({ type: "line", text: "Cancellation requested." });
    else rl.close();
  };
  rl.on("SIGINT", onInterrupt);
  sink({ type: "line", text: "Gungnir Agent CLI · Group 7 shell (no AI model connected). /help for commands." });
  prompt();
  try {
    for await (const line of rl) {
      const result = await session.handleLine(line, sink);
      if (!result.continue) break;
      prompt();
    }
    return 0;
  } finally {
    rl.off("SIGINT", onInterrupt);
    rl.close();
    session.cancelActive();
  }
}
