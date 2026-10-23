import { describe, expect, it } from "vitest";
import { getFoundationStatus, PLANNED_AGENT_MODES } from "@gungnir/agent-core";
import { TARGET_LANGUAGE_CONTRACT } from "@gungnir/gungnir-toolchain";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const cli = resolve(process.cwd(), "apps/cli/dist/index.js");

describe("foundation contract", () => {
  it("does not claim the future agent modes are operational", () => {
    expect(getFoundationStatus()).toEqual({
      product: "gungnir-agent", stage: "foundation",
      languageContract: "1.0", plannedModes: ["ask", "plan", "build"],
    });
    expect(PLANNED_AGENT_MODES).toHaveLength(3);
    expect(TARGET_LANGUAGE_CONTRACT).toBe("1.0");
  });
});

describe("CLI smoke tests", () => {
  it("prints Group 2 help and warns that agent modes are unavailable", () => {
    const result = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Group 2 foundation");
    expect(result.stdout).toContain("not yet implemented");
  });
  it("prints version and target language contract", () => {
    const result = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("0.1.0");
    expect(result.stdout).toContain("contract 1.0");
  });
  it("rejects unimplemented modes", () => {
    const result = spawnSync(process.execPath, [cli, "build"], { encoding: "utf8" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Unsupported command");
  });
});
