import { describe, expect, it } from "vitest";
import { discoverToolchain, parseCompilerContract, parseSDKProfile, parseVersion } from "@gungnir/gungnir-toolchain";
import type { DiscoveryOptions, ProbeCommand, ProbeIO } from "@gungnir/gungnir-toolchain";

const contract = [
  "package_version=1.0.2",
  "language_version=1.0",
  "compiler_contract=1.0",
  "diagnostic_contract=1.0",
  "structured_feature_freeze=true",
  "compatibility=stable",
].join("\n");

function fixture(platform: "linux" | "win32" = "linux", profile = "application") {
  const win = platform === "win32";
  const prefix = win ? "C:\\Gungnir" : "/opt/gungnir";
  const sep = win ? "\\" : "/";
  const cli = prefix + sep + "bin" + sep + (win ? "gungnir.exe" : "gungnir");
  const compiler = prefix + sep + "bin" + sep + (win ? "gungnirc.exe" : "gungnirc");
  const header = prefix + sep + "include" + sep + "gungnir" + sep + "gungnir.hpp";
  const cmake = prefix + sep + "lib" + sep + "cmake" + sep + "Gungnir" + sep + "GungnirConfig.cmake";
  const manifest = prefix + sep + "share" + sep + "gungnir" + sep + "sdk.txt";
  const executable = new Set([cli, compiler]);
  const files = new Set([header, cmake]);
  const reads = new Map([[manifest, "profile=" + profile + "\n"]]);
  const probes = new Map([
    [cli + "|--version", "Gungnir 1.0.2\n"],
    [compiler + "|--version", "Gungnir compiler 1.0.2 (language 1.0)\n"],
    [compiler + "|--print-contract", contract],
  ]);
  const calls: Array<{ file: string; command: ProbeCommand; timeout: number }> = [];
  const io: ProbeIO = {
    isExecutable: async file => executable.has(file),
    isFile: async file => files.has(file),
    readText: async file => reads.get(file),
    probe: async (file, command, timeout) => {
      calls.push({ file, command, timeout });
      const output = probes.get(file + "|" + command);
      if (output === undefined) throw Error("SECRET_TOKEN=do-not-emit");
      return output;
    },
  };
  const options: DiscoveryOptions = {
    platform, environment: { GUNGNIR_CMAKE_PREFIX: prefix, PATH: "/usr/bin" },
  };
  return { prefix, cli, compiler, header, cmake, manifest, executable, files, reads, probes, calls, io, options };
}

describe("Gungnir contract parsers", () => {
  it("parses genuine CLI and compiler versions without conflating them", () => {
    expect(parseVersion("Gungnir 1.0.2\n", "cli")).toBe("1.0.2");
    expect(parseVersion("Gungnir compiler 1.0.2 (language 1.0)\n", "compiler")).toBe("1.0.2");
    expect(parseVersion("Gungnir compiler 1.0.2", "cli")).toBeUndefined();
    expect(parseVersion("Other tool 1.0.2", "compiler")).toBeUndefined();
    expect(parseVersion("Gungnir v1.0.2", "cli")).toBe("1.0.2");
  });
  it("parses stable machine-readable contracts", () => {
    expect(parseCompilerContract(contract)).toMatchObject({
      languageVersion: "1.0", packageVersion: "1.0.2", structuredFeatureFreeze: true,
      compatibility: "stable",
    });
    expect(parseCompilerContract(contract + "\ncompiler_contract=1.0")).toBeUndefined();
    expect(parseCompilerContract(contract.replace("compatibility=stable", "compatibility=unknown"))).toBeUndefined();
    expect(parseCompilerContract("password=SECRET_TOKEN")).toBeUndefined();
  });
  it("requires exactly one recognized SDK profile", () => {
    expect(parseSDKProfile("profile=core\nwith_sqlite=false")).toBe("core");
    expect(parseSDKProfile("profile=application\n")).toBe("application");
    expect(parseSDKProfile("profile=unknown")).toBeUndefined();
    expect(parseSDKProfile("profile=core\nprofile=application")).toBeUndefined();
  });
});

describe("read-only SDK discovery", () => {
  it("discovers a fully compatible Linux SDK with fixed probe calls", async () => {
    const x = fixture();
    const result = await discoverToolchain(x.options, x.io);
    expect(result).toMatchObject({
      state: "ready", source: "environment", executable: x.cli,
      compiler: x.compiler, version: "1.0.2", compilerVersion: "1.0.2",
      sdkVerified: true, sdkProfile: "application", diagnostics: [],
      capabilities: { compilerCheck: true, irVerification: true, languageServer: true, nativeBuild: true },
    });
    expect(x.calls).toEqual([
      { file: x.cli, command: "--version", timeout: 3000 },
      { file: x.compiler, command: "--version", timeout: 3000 },
      { file: x.compiler, command: "--print-contract", timeout: 3000 },
    ]);
  });
  it("discovers Windows installation with .exe siblings and profile", async () => {
    const x = fixture("win32", "core");
    const result = await discoverToolchain(x.options, x.io);
    expect(result).toMatchObject({ state: "ready", executable: x.cli, sdkProfile: "core" });
  });
  it("honors explicit CLI precedence and rejects invalid overrides without fallback", async () => {
    const x = fixture();
    const result = await discoverToolchain({
      ...x.options, executablePath: x.cli, sdkRoot: "/different",
    }, x.io);
    expect(result.source).toBe("configured");
    const invalid = await discoverToolchain({
      ...x.options, executablePath: "./gungnir",
    }, x.io);
    expect(invalid.state).toBe("invalid");
    expect(x.calls.length).toBe(3);
  });
  it("does not resolve relative or blank PATH entries", async () => {
    const x = fixture();
    const result = await discoverToolchain({
      platform: "linux", environment: { PATH: ":.:./bin:/tmp/nope" },
    }, x.io);
    expect(result.state).toBe("missing");
    expect(x.calls).toHaveLength(0);
  });
  it("refuses an invalid environment SDK root without falling back to PATH", async () => {
    const x = fixture();
    const result = await discoverToolchain({
      platform: "linux", environment: { PATH: "/opt/gungnir/bin", GUNGNIR_CMAKE_PREFIX: "../escape" },
    }, x.io);
    expect(result.state).toBe("invalid");
    expect(x.calls).toHaveLength(0);
  });
  it("classifies absent compiler as partial without claiming compiler features", async () => {
    const x = fixture();
    x.executable.delete(x.compiler);
    const result = await discoverToolchain(x.options, x.io);
    expect(result.state).toBe("partial");
    expect(result.capabilities.compilerCheck).toBe(false);
    expect(result.capabilities.nativeBuild).toBe(false);
    expect(result.diagnostics.some(d => d.code === "COMPILER_MISSING")).toBe(true);
  });
  it("classifies wrong compiler versions and wrong language contracts as incompatible", async () => {
    const x = fixture();
    x.probes.set(x.compiler + "|--version", "Gungnir compiler 2.0.0\n");
    const mismatch = await discoverToolchain(x.options, x.io);
    expect(mismatch.state).toBe("incompatible");
    expect(mismatch.capabilities.irVerification).toBe(false);
    x.probes.set(x.compiler + "|--version", "Gungnir compiler 1.0.2\n");
    x.probes.set(x.compiler + "|--print-contract", contract.replace("language_version=1.0", "language_version=2.0"));
    const contractMismatch = await discoverToolchain(x.options, x.io);
    expect(contractMismatch.state).toBe("incompatible");
    expect(contractMismatch.diagnostics.some(d => d.code === "CONTRACT_INCOMPATIBLE")).toBe(true);
  });
  it("marks incomplete native SDK and unknown profile as partial", async () => {
    const x = fixture();
    x.files.delete(x.header);
    x.reads.set(x.manifest, "profile=broken");
    const result = await discoverToolchain(x.options, x.io);
    expect(result.state).toBe("partial");
    expect(result.sdkVerified).toBe(false);
    expect(result.diagnostics.some(d => d.code === "SDK_PROFILE_UNKNOWN")).toBe(true);
  });
  it("does not expose tool output, environment secrets or exception detail in diagnostics", async () => {
    const x = fixture();
    x.probes.delete(x.compiler + "|--print-contract");
    const report = await discoverToolchain(x.options, x.io);
    expect(report.state).toBe("incompatible");
    expect(JSON.stringify(report)).not.toContain("SECRET_TOKEN");
  });
  it("rejects invalid timeout values and never starts a probe", async () => {
    const x = fixture();
    const result = await discoverToolchain({ ...x.options, timeoutMs: 0 }, x.io);
    expect(result.state).toBe("invalid");
    expect(x.calls).toHaveLength(0);
  });
});
