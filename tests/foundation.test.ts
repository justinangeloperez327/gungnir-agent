import { describe, expect, it } from "vitest";
import { getFoundationStatus, PLANNED_AGENT_MODES } from "@gungnir/agent-core";
import { TARGET_LANGUAGE_CONTRACT } from "@gungnir/gungnir-toolchain";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const cli = resolve(process.cwd(), "apps/cli/dist/index.js");
describe("foundation contract", () => {
  it("does not claim that future agent modes are operational", () => {
    expect(getFoundationStatus()).toEqual({
      product: "gungnir-agent", stage: "foundation",
      languageContract: "1.0", plannedModes: ["ask", "plan", "build"],
    });
    expect(PLANNED_AGENT_MODES).toHaveLength(3);
    expect(TARGET_LANGUAGE_CONTRACT).toBe("1.0");
  });
});
describe("CLI smoke tests", () => {
  it("prints Group 3 help; future modes remain unavailable", () => {
    const result = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Group 3 toolchain");
    expect(result.stdout).toContain("not yet implemented");
  });
  it("prints foundation version and target contract", () => {
    const result = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("0.1.0");
    expect(result.stdout).toContain("contract 1.0");
  });
  it("rejects future modes and unsupported doctor options", () => {
    for (const args of [["build"], ["doctor", "--unsafe"], ["ask"]]) {
      const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Unsupported command");
    }
  });
  it("reports a missing installation as JSON without executing untrusted PATH entries", () => {
    const result = spawnSync(process.execPath, [cli, "doctor", "--json"], {
      encoding: "utf8",
      env: { ...process.env, PATH: "", Path: "", GUNGNIR_CMAKE_PREFIX: "" },
    });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ state: "invalid" });
  });
});
