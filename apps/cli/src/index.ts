#!/usr/bin/env node
import { toPublicAgentError, getFoundationStatus } from "@gungnir/agent-core";
import { discoverToolchain } from "@gungnir/gungnir-toolchain";
import { parseCliArguments, runAgentTerminal } from "./terminal.js";

export const help = [
  "Gungnir Agent — Group 9 knowledge retrieval",
  "",
  "Usage:",
  "  gungnir-agent interactive [--mode ask|plan|build] [MODEL] [WORKSPACE]",
  "  gungnir-agent ask|plan|build [--message TEXT] [MODEL] [WORKSPACE]",
  "  gungnir-agent doctor [--json] | --help | --version",
  "",
  "MODEL: --provider openai|anthropic|gateway --model MODEL_ID",
  "  [--max-output-tokens N] [--session-output-tokens N] [--max-requests N]",
  "  [--timeout-ms N] [--input-usd-per-million RATE]",
  "  [--output-usd-per-million RATE] [--max-estimated-usd CAP]",
  "RETRIEVAL: [--docs-version 1.0.2] [--context-file PATH.gnr]",
  "WORKSPACE: --project-root ABSOLUTE_PATH --trust-workspace",
  "",
  "Keys: OPENAI_API_KEY / ANTHROPIC_API_KEY / AI_GATEWAY_API_KEY from environment.",
  "Do not pass keys in arguments. Cost limits use user-supplied rates only.",
  "Pinned Gungnir docs are cited automatically. --context-file requires trusted workspace.",
  "Read-only context; no autonomous file edits, shell tools or deployments.",
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
    try { return await runAgentTerminal(parsed.options); }
    catch (cause) {
      const issue = toPublicAgentError(cause);
      console.error(issue.code + ": " + issue.message);
      return 1;
    }
  }
  return 2;
}
void main(process.argv.slice(2)).then(
  code => { process.exitCode = code; },
  () => { console.error("Unable to complete Gungnir Agent command."); process.exitCode = 1; },
);
