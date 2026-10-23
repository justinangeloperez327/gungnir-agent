#!/usr/bin/env node

import { getFoundationStatus } from "@gungnir/agent-core";
import { discoverToolchain } from "@gungnir/gungnir-toolchain";

const help = [
  "Gungnir Agent — Group 3 toolchain detection",
  "",
  "Usage: gungnir-agent [--help | --version | doctor [--json]]",
  "",
  "Options:",
  "  -h, --help      Print this help",
  "  -v, --version   Print the agent foundation version",
  "  doctor         Explicit, read-only Gungnir SDK/CLI compatibility check",
  "  doctor --json  Machine-readable compatibility report",
  "",
  "Ask, Plan, and Build modes are planned; they are not yet implemented.",
].join("\n");

async function main(args: string[]): Promise<number> {
  if (args.length === 0 || (args.length === 1 && ["--help", "-h"].includes(args[0] ?? ""))) {
    console.log(help);
    return 0;
  }
  if (args.length === 1 && ["--version", "-v"].includes(args[0] ?? "")) {
    const status = getFoundationStatus();
    console.log("0.1.0 (foundation; Gungnir contract " + status.languageContract + ")");
    return 0;
  }
  if (args[0] === "doctor" && (args.length === 1 || (args.length === 2 && args[1] === "--json"))) {
    const report = await discoverToolchain();
    if (args[1] === "--json") {
      console.log(JSON.stringify(report, null, 2));
    } else {
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
  console.error("Unsupported command. Run gungnir-agent --help.");
  return 2;
}

void main(process.argv.slice(2)).then(
  code => { process.exitCode = code; },
  () => { console.error("Unable to complete Gungnir Agent command."); process.exitCode = 1; },
);
