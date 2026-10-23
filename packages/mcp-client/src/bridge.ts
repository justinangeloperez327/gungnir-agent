import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import {
  AgentError,
  DefaultExecutionPolicy,
  enforcePermission,
  type ApprovalHandler,
  type TrustedWorkspace,
} from "@gungnir/agent-core";
import type { ToolRequest } from "@gungnir/contracts";

/** Official standalone server stays in justinangeloperez327/gungnir-mcp. */
export const GUNGNIR_MCP_SERVER = "gungnir-mcp" as const;
export type McpProtocolMode = "legacy" | "modern";
export type RemoteReadOnlyTool = "gungnir_status" | "gungnir_toolchain_info";

const ALLOWED_TOOLS: readonly RemoteReadOnlyTool[] = [
  "gungnir_status", "gungnir_toolchain_info",
];

export interface McpBridgeOptions {
  /** Host-chosen, trusted absolute path to the installed gungnir-mcp entry file. */
  readonly serverEntry: string;
  /** Established with the trusted host, not from tool arguments. */
  readonly workspace: TrustedWorkspace;
  /** Explicit host approval for this exact Node process/argv and cwd. */
  readonly approval: ApprovalHandler;
  readonly protocol?: McpProtocolMode;
}

function safeEnvironment(): Record<string, string> {
  const inherited = ["PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR",
    "TMP", "TEMP", "HOME", "USERPROFILE"];
  const env: Record<string, string> = {};
  for (const key of inherited) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

function textPayload(response: Awaited<ReturnType<Client["callTool"]>>): unknown {
  if (response.isError === true || response.content.length !== 1) {
    throw new AgentError("PROCESS_FAILED", "MCP tool call returned an error");
  }
  const first = response.content[0];
  if (!first || first.type !== "text" || first.text.length > 32_768) {
    throw new AgentError("PROCESS_FAILED", "MCP tool response has an unsupported format");
  }
  try {
    const parsed: unknown = JSON.parse(first.text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("not object");
    return parsed;
  } catch {
    throw new AgentError("PROCESS_FAILED", "MCP tool response was not valid structured data");
  }
}

/**
 * Outbound adapter to the separate gungnir-mcp server.
 *
 * Model-produced paths, tool names, commands and project roots are never
 * accepted here. This class does not create or register an MCP server.
 */
export class GungnirMcpClient {
  private readonly client: Client;
  private readonly transport: StdioClientTransport;
  private closed = false;

  private constructor(client: Client, transport: StdioClientTransport) {
    this.client = client;
    this.transport = transport;
  }

  static async connect(options: McpBridgeOptions): Promise<GungnirMcpClient> {
    if (!path.isAbsolute(options.serverEntry) || options.serverEntry.includes("\0")) {
      throw new AgentError("POLICY_DENIED", "MCP server entry must be an absolute path");
    }
    let entry: string;
    try {
      entry = await realpath(options.serverEntry);
      if (!(await stat(entry)).isFile()) throw Error("not a file");
    } catch {
      throw new AgentError("POLICY_DENIED", "Trusted MCP server entry was not found");
    }

    const args = [entry, "--project-root", options.workspace.root,
      "--trusted-root", options.workspace.root];
    const request: ToolRequest = Object.freeze({
      id: "gungnir-mcp-connection",
      taskId: "mcp-session",
      toolName: "process.execute",
      capability: "process.execute",
      input: Object.freeze({
        executable: process.execPath, args: Object.freeze([...args]),
        cwd: options.workspace.root,
      }),
    });
    // Explicit host authorization is mandatory. No AI/self-approval.
    await enforcePermission(new DefaultExecutionPolicy(), request, "build", options.approval);
    const mode = options.protocol === "modern"
      ? { pin: "2026-07-28" as const } : "legacy" as const;
    const client = new Client(
      { name: "gungnir-agent", version: "0.1.0" },
      { versionNegotiation: { mode } },
    );
    const transport = new StdioClientTransport({
      command: process.execPath, args,
      cwd: options.workspace.root,
      env: safeEnvironment(), stderr: "pipe",
    });
    try {
      await client.connect(transport);
    } catch {
      await client.close().catch(() => undefined);
      throw new AgentError("PROCESS_FAILED", "Unable to connect to trusted Gungnir MCP server");
    }
    return new GungnirMcpClient(client, transport);
  }

  async listSupportedTools(): Promise<readonly RemoteReadOnlyTool[]> {
    this.assertOpen();
    try {
      const result = await this.client.listTools();
      const offered = new Set(result.tools.map(tool => tool.name));
      return Object.freeze(ALLOWED_TOOLS.filter(name => offered.has(name)));
    } catch {
      throw new AgentError("PROCESS_FAILED", "Could not list MCP tools");
    }
  }

  /** Only status + toolchain metadata can cross this bridge in Group 6. */
  async callReadOnly(tool: RemoteReadOnlyTool): Promise<unknown> {
    this.assertOpen();
    if (!ALLOWED_TOOLS.includes(tool)) {
      throw new AgentError("POLICY_DENIED", "MCP tool is not allowlisted");
    }
    const supported = await this.listSupportedTools();
    if (!supported.includes(tool)) {
      throw new AgentError("POLICY_DENIED", "MCP server did not advertise the requested tool");
    }
    try {
      return textPayload(await this.client.callTool({ name: tool, arguments: {} }));
    } catch (error) {
      if (error instanceof AgentError) throw error;
      throw new AgentError("PROCESS_FAILED", "Gungnir MCP tool invocation failed");
    }
  }

  getProtocolEra(): McpProtocolMode {
    this.assertOpen();
    return this.client.getProtocolEra() === "modern" ? "modern" : "legacy";
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.client.close().catch(() => undefined);
  }

  private assertOpen(): void {
    if (this.closed) throw new AgentError("POLICY_DENIED", "MCP client session has closed");
  }
}
