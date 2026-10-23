import { describe, expect, it } from "vitest";
import { getFoundationStatus, PLANNED_AGENT_MODES } from "@gungnir/agent-core";
import { TARGET_LANGUAGE_CONTRACT } from "@gungnir/gungnir-toolchain";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const cli = resolve(process.cwd(), "apps/cli/dist/index.js");
describe("foundation contract", () => {
  it("does not falsely claim model-driven modes are available", () => {
    expect(getFoundationStatus()).toEqual({
      product: "gungnir-agent", stage: "foundation",
      languageContract: "1.0", plannedModes: ["ask", "plan", "build"],
    });
    expect(PLANNED_AGENT_MODES).toHaveLength(3);
    expect(TARGET_LANGUAGE_CONTRACT).toBe("1.0");
  });
});
describe("CLI smoke tests", () => {
  it("prints Group 8 help with explicit model limitations", () => {
    const result = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Group 8 model adapters");
    expect(result.stdout).toContain("not yet implemented");
  });
  it("prints version and contract", () => {
    const result = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("0.1.0");
    expect(result.stdout).toContain("contract 1.0");
  });
  it("rejects unsupported flags and untrusted workspace access", () => {
    for (const args of [["doctor", "--unsafe"], ["ask", "--project-root", process.cwd()],
      ["interactive", "--trust-workspace"], ["build", "--deploy"]]) {
      const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Unsupported command");
    }
  });
  it("keeps doctor read-only and returns structured diagnostic JSON", () => {
    const result = spawnSync(process.execPath, [cli, "doctor", "--json"], {
      encoding: "utf8",
      env: { ...process.env, PATH: "", Path: "", GUNGNIR_CMAKE_PREFIX: "" },
    });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ state: "invalid" });
  });
  it("reports model unavailability without performing a build", () => {
    const result = spawnSync(process.execPath, [cli, "build", "--message", "create a model"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(3);
    expect(result.stderr).toContain("requires a model backend");
    expect(result.stderr).toContain("No code was executed or modified");
  });
});
