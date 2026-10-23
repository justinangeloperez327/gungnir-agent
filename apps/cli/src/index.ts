#!/usr/bin/env node

import { toPublicAgentError, getFoundationStatus } from "@gungnir/agent-core";
import { discoverToolchain } from "@gungnir/gungnir-toolchain";
import { parseCliArguments, runAgentTerminal } from "./terminal.js";

export const help = [
  "Gungnir Agent — Group 7 interactive terminal",
  "",
  "Usage:",
  "  gungnir-agent interactive [--mode ask|plan|build] [--project-root PATH --trust-workspace]",
  "  gungnir-agent ask|plan|build [--message TEXT] [--project-root PATH --trust-workspace]",
  "  gungnir-agent doctor [--json]",
  "  gungnir-agent --help | --version",
  "",
  "Interactive commands: /help, /mode, /status, /files, /search, /read, /cancel, /exit",
  "Ask, Plan, Build accept prompts but AI model responses are not yet implemented (Group 8).",
  "No automatic file writes, builds, deployment or publication are enabled.",
].join("\n");

async function main(args: string[]): Promise<number> {
  let parsed;
  try { parsed = parseCliArguments(args); }
  catch {
    console.error("Unsupported command or invalid arguments. Run gungnir-agent --help.");
    return 2;
  }
  if (parsed.kind === "help") { console.log(help); return 0; }
  if (parsed.kind === "version") {
    const status = getFoundationStatus();
    console.log("0.1.0 (foundation; Gungnir contract " + status.languageContract + ")");
    return 0;
  }
  if (parsed.kind === "doctor") {
    const report = await discoverToolchain();
    if (parsed.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(report.message);
      console.log("Status: " + report.state);
      if (report.version) console.log("Gungnir version: " + report.version);
      if (report.sdkProfile) console.log("SDK profile: " + report.sdkProfile);
      for (const diagnostic of report.diagnostics) {
        console.log("- [" + diagnostic.code + "] " + diagnostic.message);
      }
    }
    return report.state === "ready" ? 0 : 1;
  }
  if (parsed.kind === "session") {
    try {
      return await runAgentTerminal(parsed.options);
    } catch (cause) {
      const problem = toPublicAgentError(cause);
      console.error(problem.code + ": " + problem.message);
      return 1;
    }
  }
  return 2;
}

void main(process.argv.slice(2)).then(
  code => { process.exitCode = code; },
  () => { console.error("Unable to complete Gungnir Agent command."); process.exitCode = 1; },
);
