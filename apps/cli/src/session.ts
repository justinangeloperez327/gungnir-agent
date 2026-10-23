import type { AgentMode, TaskSnapshot } from "@gungnir/contracts";
import {
  AgentError, TaskStateMachine, TrustedWorkspace, toPublicAgentError,
} from "@gungnir/agent-core";
import { ReadOnlyContextAdapter } from "@gungnir/mcp-client";
import type { GungnirKnowledgeIndex, KnowledgeSource } from "@gungnir/knowledge";

export type CliEvent =
  | { readonly type: "line"; readonly text: string }
  | { readonly type: "token"; readonly text: string }
  | { readonly type: "error"; readonly text: string };

export type EventSink = (event: CliEvent) => void;

export interface TextStreamRequest {
  readonly mode: AgentMode;
  readonly prompt: string;
  readonly signal: AbortSignal;
}

/** Text-only boundary. No tool execution, edits or shell access. */
export interface TextStreamBackend {
  streamText(request: TextStreamRequest): AsyncIterable<string>;
}

export interface CliSessionOptions {
  readonly mode?: AgentMode;
  readonly workspace?: TrustedWorkspace;
  /** Optional; must be explicitly selected by the operator. */
  readonly backend?: TextStreamBackend;
  readonly knowledge?: GungnirKnowledgeIndex;
}

export interface LineOutcome {
  readonly continue: boolean;
  readonly code: number;
}

const EXIT: LineOutcome = Object.freeze({ continue: false, code: 0 });
const OK: LineOutcome = Object.freeze({ continue: true, code: 0 });

function safeText(value: string): string {
  // Untrusted project/model text must not contain terminal control sequences.
  return [...value].filter(char => {
    const code = char.codePointAt(0) ?? 0;
    return code >= 32 && code !== 127 || char === "\n" || char === "\t";
  }).join("");
}

export function renderCliEvent(event: CliEvent, output: NodeJS.WritableStream, error: NodeJS.WritableStream): void {
  const destination = event.type === "error" ? error : output;
  destination.write(safeText(event.text) + (event.type === "token" ? "" : "\n"));
}

export class AgentCliSession {
  private active: AbortController | undefined;
  private last?: TaskSnapshot;
  private nextTask = 0;
  private readonly context: ReadOnlyContextAdapter | undefined;
  private readonly backend: TextStreamBackend | undefined;
  private readonly knowledge: GungnirKnowledgeIndex | undefined;
  private references: readonly KnowledgeSource[] = [];
  private currentMode: AgentMode;

  constructor(options: CliSessionOptions = {}) {
    this.currentMode = options.mode ?? "ask";
    this.context = options.workspace ? new ReadOnlyContextAdapter(options.workspace) : undefined;
    this.backend = options.backend;
    this.knowledge = options.knowledge;
  }

  get mode(): AgentMode { return this.currentMode; }
  get lastTask(): TaskSnapshot | undefined { return this.last; }

  cancelActive(): boolean {
    if (!this.active || this.active.signal.aborted) return false;
    this.active.abort();
    return true;
  }

  async handleLine(input: string, sink: EventSink): Promise<LineOutcome> {
    const trimmed = input.trim();
    if (!trimmed) return OK;
    if (trimmed.length > 8192 || trimmed.includes("\0")) {
      sink({ type: "error", text: "Input is too long or invalid." });
      return { continue: true, code: 2 };
    }

    try {
      if (!trimmed.startsWith("/")) return this.executePrompt(trimmed, sink);
      const space = trimmed.indexOf(" ");
      const command = (space < 0 ? trimmed : trimmed.slice(0, space)).toLowerCase();
      const argument = space < 0 ? "" : trimmed.slice(space + 1).trim();
      switch (command) {
        case "/exit": case "/quit":
          if (argument) break;
          this.cancelActive();
          return EXIT;
        case "/help":
          if (argument) break;
          sink({ type: "line", text: [
            "Commands: /help, /mode ask|plan|build, /status, /files [count],",
            "/search <text>, /read <relative.gnr> [start] [count], /docs <text>,",
            "/sources, /usage, /cancel, /exit",
            "AI prompts require --provider and --model. Build produces text only.",
            "All project browsing is read-only and requires --trust-workspace.",
          ].join("\n") });
          return OK;
        case "/mode":
          if (argument === "ask" || argument === "plan" || argument === "build") {
            this.currentMode = argument;
            sink({ type: "line", text: "Mode: " + argument + (this.backend ?
              " (text-only model)" : " (model not connected)") });
            return OK;
          }
          break;
        case "/status":
          if (argument) break;
          sink({ type: "line", text: [
            "Mode: " + this.currentMode,
            "Workspace: " + (this.context ? "trusted (read-only)" : "not trusted"),
            "Model backend: " + (this.backend ? "injected text stream" : "unavailable (specify --provider and --model)"),
            "Last task: " + (this.last ? this.last.state : "none"),
          ].join("\n") });
          return OK;
        case "/files": {
          if (argument && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(argument)) break;
          const context = this.requireContext();
          const count = argument ? Number(argument) : 20;
          const result = await context.overview();
          const listed = result.files.slice(0, count)
            .map(file => file.path + " [" + file.category + "]");
          sink({ type: "line", text: listed.length
            ? listed.join("\n") + "\nIndexed " + result.statistics.indexedFiles + " .gnr files."
            : "No .gnr files found." });
          return OK;
        }
        case "/search": {
          if (!argument) break;
          const matches = await this.requireContext().search(argument, { maxResults: 30 });
          sink({ type: "line", text: matches.length
            ? matches.map(match => match.path + (match.line ? ":" + match.line : "")).join("\n")
            : "No matching source or filenames." });
          return OK;
        }
        case "/read": {
          const parts = argument.split(/\s+/);
          if (parts.length < 1 || parts.length > 3 || !parts[0] ||
              (parts[1] && !/^\d+$/.test(parts[1])) ||
              (parts[2] && !/^\d+$/.test(parts[2]))) break;
          const start = parts[1] ? Number(parts[1]) : 1;
          const count = parts[2] ? Number(parts[2]) : 20;
          const snippet = await this.requireContext().excerpt(parts[0], start, count);
          sink({ type: "line", text: snippet.lines.map((line, i) =>
            (snippet.startLine + i) + ": " + line).join("\n") });
          return OK;
        }
        case "/docs": {
          if (!argument || !this.knowledge) break;
          const found=this.knowledge.search(argument,5);
          sink({type:"line",text:found.length ?
            found.map(s=>"["+s.number+"] "+s.title+" — "+s.uri).join("\n") :
            "No matching documentation found."});
          return OK;
        }
        case "/sources":
          if(argument) break;
          sink({type:"line",text:this.references.length ?
            this.references.map(s=>"["+s.number+"] "+s.title+" — "+s.uri).join("\n") :
            "No sources from the last successful response."});
          return OK;
        case "/usage": {
          if (argument) break;
          const metered = this.backend as { usage?: {
            provider: string; model: string; requests: number;
            inputTokens: number; outputTokens: number; estimatedCostUsd?: number;
          } } | undefined;
          if (!metered?.usage) {
            sink({ type: "line", text: "No model usage recorded." });
          } else {
            const u = metered.usage;
            sink({ type: "line", text:
              "Provider: " + u.provider + " | Model: " + u.model +
              " | Requests: " + u.requests + " | Input tokens: " + u.inputTokens +
              " | Output tokens: " + u.outputTokens +
              (u.estimatedCostUsd !== undefined ?
                " | Estimated USD: " + u.estimatedCostUsd.toFixed(6) : "") });
          }
          return OK;
        }
        case "/cancel":
          if (argument) break;
          sink({ type: "line", text: this.cancelActive()
            ? "Cancellation requested." : "No active request." });
          return OK;
        default:
          break;
      }
      sink({ type: "error", text: "Unknown or invalid command. Run /help." });
      return { continue: true, code: 2 };
    } catch (error) {
      const result = toPublicAgentError(error);
      sink({ type: "error", text: result.code + ": " + result.message });
      return { continue: true, code: 1 };
    }
  }

  private requireContext(): ReadOnlyContextAdapter {
    if (!this.context) {
      throw new AgentError("WORKSPACE_UNTRUSTED", "Use --project-root PATH --trust-workspace for read-only inspection");
    }
    return this.context;
  }

  private async executePrompt(prompt: string, sink: EventSink): Promise<LineOutcome> {
    if (this.active) {
      sink({ type: "error", text: "Another request is still active." });
      return { continue: true, code: 2 };
    }
    const task = new TaskStateMachine("cli-" + (++this.nextTask), this.currentMode);
    this.references = [];
    this.last = task.snapshot();
    if (!this.backend) {
      this.last = task.transition("failed");
      sink({ type: "error", text: this.currentMode.toUpperCase() +
        " requires a model backend. Configure --provider and --model. No code was executed or modified." });
      return { continue: true, code: 3 };
    }
    const controller = new AbortController();
    this.active = controller;
    let bytes = 0;
    let chunks = 0;
    let started = false;
    try {
      this.last = task.transition("planned");
      this.last = task.transition("running");
      for await (const token of this.backend.streamText({
        mode: this.currentMode, prompt, signal: controller.signal,
      })) {
        if (controller.signal.aborted) throw new AgentError("PROCESS_CANCELLED", "Request cancelled");
        if (typeof token !== "string" || ++chunks > 2_000 ||
            (bytes += Buffer.byteLength(token)) > 256 * 1024) {
          throw new AgentError("CONTEXT_LIMIT", "Text stream exceeds the allowed output budget");
        }
        sink({ type: "token", text: token });
        started = true;
      }
      if (controller.signal.aborted) throw new AgentError("PROCESS_CANCELLED", "Request cancelled");
      if (started) sink({ type: "line", text: "" });
      this.last = task.transition("succeeded");
      const indexed = this.backend as { sources?: readonly KnowledgeSource[] } | undefined;
      this.references = indexed?.sources ?? [];
      if(this.references.length) {
        sink({type:"line",text:"Sources: " + this.references.map(s=>"["+s.number+"] "+s.uri).join("  ")});
      }
      return OK;
    } catch (error) {
      this.last = task.transition(controller.signal.aborted ? "cancelled" : "failed");
      const safe = toPublicAgentError(error);
      sink({ type: "error", text: safe.code + ": " + safe.message });
      return { continue: true, code: controller.signal.aborted ? 130 : 1 };
    } finally {
      this.active = undefined;
    }
  }
}
