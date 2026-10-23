#!/usr/bin/env node
import { getFoundationStatus } from "@gungnir/agent-core";

const help = [
  "Gungnir Agent — Group 2 foundation",
  "",
  "Usage: gungnir-agent [--help | --version]",
  "",
  "Options:",
  "  -h, --help       Print this help",
  "  -v, --version    Print the foundation version",
  "",
  "Ask, Plan, and Build modes are planned; they are not yet implemented.",
].join("\n");

const args = process.argv.slice(2);
if (args.length === 0 || (args.length === 1 && ["--help", "-h"].includes(args[0] ?? ""))) {
  console.log(help);
} else if (args.length === 1 && ["--version", "-v"].includes(args[0] ?? "")) {
  const status = getFoundationStatus();
  console.log("0.1.0 (foundation; Gungnir contract " + status.languageContract + ")");
} else {
  console.error("Unsupported command. Run gungnir-agent --help.");
  process.exitCode = 2;
}
