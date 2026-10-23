import path from "node:path";
import { parseCompilerContract, parseSDKProfile, parseVersion } from "./parsers.js";
import { nativeProbeIO } from "./probe.js";
import type {
  CompilerContract, DiscoveryOptions, ProbeIO, SDKProfile,
  ToolchainCapabilities, ToolchainDiagnostic, ToolchainResult, ToolchainSource,
  ToolchainState,
} from "./types.js";

const EXPECTED_CONTRACT = "1.0";
const emptyCapabilities: ToolchainCapabilities = Object.freeze({
  compilerCheck: false, irVerification: false, languageServer: false, nativeBuild: false,
});
type Candidate = { readonly file: string; readonly source: ToolchainSource };

function diagnostic(
  code: ToolchainDiagnostic["code"], message: string,
): ToolchainDiagnostic { return Object.freeze({ code, message }); }

function failure(
  state: ToolchainState, code: ToolchainDiagnostic["code"], message: string,
  extra: Partial<ToolchainResult> = {},
): ToolchainResult {
  return { ...extra, state, message, sdkVerified: false,
    capabilities: emptyCapabilities, diagnostics: [diagnostic(code, message)] };
}

function selectedResult(
  state: ToolchainState,
  selection: Candidate,
  version: string | undefined,
  compiler: string | undefined,
  compilerVersion: string | undefined,
  sdkRoot: string,
  sdkVerified: boolean,
  sdkProfile: SDKProfile | undefined,
  contract: CompilerContract | undefined,
  diagnostics: ToolchainDiagnostic[],
): ToolchainResult {
  const capabilities: ToolchainCapabilities = {
    compilerCheck: (state === "ready" || state === "partial") && !!compiler && !!contract,
    irVerification: (state === "ready" || state === "partial") && !!compiler && !!contract,
    languageServer: (state === "ready" || state === "partial") && !!contract,
    nativeBuild: state === "ready",
    ...(sdkProfile ? { sdkProfile } : {}),
  };
  return {
    state, message: state === "ready"
      ? "Compatible Gungnir SDK detected."
      : state === "incompatible" ? "Gungnir installation is incompatible."
      : state === "invalid" ? "Gungnir version probe failed."
      : "Gungnir installation requires additional components.",
    source: selection.source, executable: selection.file,
    ...(version !== undefined ? { version } : {}),
    ...(compiler !== undefined ? { compiler } : {}),
    ...(compilerVersion !== undefined ? { compilerVersion } : {}),
    sdkRoot, sdkVerified,
    ...(sdkProfile !== undefined ? { sdkProfile } : {}),
    ...(contract !== undefined ? { contract } : {}),
    capabilities, diagnostics,
  };
}

/**
 * Explicit paths take precedence over env/PATH. A broken explicit override
 * never silently falls back to an unrelated installation.
 *
 * This is opt-in, read-only discovery, NOT a general-purpose command executor.
 * Group 4 will add workspace trust/realpath-based execution authorization.
 */
export async function discoverToolchain(
  options: DiscoveryOptions = {}, io: ProbeIO = nativeProbeIO,
): Promise<ToolchainResult> {
  const platform = options.platform ?? process.platform;
  const paths = platform === "win32" ? path.win32 : path.posix;
  const win = platform === "win32";
  const environment = options.environment ?? process.env;
  const cliName = win ? "gungnir.exe" : "gungnir";
  const compilerName = win ? "gungnirc.exe" : "gungnirc";
  const timeoutMs = options.timeoutMs === undefined ? 3_000 : options.timeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 10_000) {
    return failure("invalid", "INVALID_CONFIGURATION", "Probe timeout must be 500–10000 ms.");
  }

  const configured = options.executablePath;
  const configuredRoot = options.sdkRoot;
  const envRoot = environment.GUNGNIR_CMAKE_PREFIX;
  const validAbsolute = (value: string): boolean =>
    value.length > 0 && value.trim() === value && !value.includes("\0") &&
    paths.isAbsolute(value);
  if (configured !== undefined && !validAbsolute(configured)) {
    return failure("invalid", "INVALID_CONFIGURATION", "Executable override must be an absolute path.");
  }
  if (configuredRoot !== undefined && !validAbsolute(configuredRoot)) {
    return failure("invalid", "INVALID_CONFIGURATION", "SDK root override must be an absolute path.");
  }
  if (configured === undefined && configuredRoot === undefined &&
      envRoot !== undefined && !validAbsolute(envRoot)) {
    return failure("invalid", "INVALID_CONFIGURATION", "GUNGNIR_CMAKE_PREFIX must be an absolute directory.");
  }

  const candidates: Candidate[] = [];
  if (configured !== undefined) {
    candidates.push({ source: "configured", file: configured });
  } else if (configuredRoot !== undefined) {
    candidates.push({ source: "sdkRoot", file: paths.join(configuredRoot, "bin", cliName) });
  } else if (envRoot !== undefined) {
    candidates.push({ source: "environment", file: paths.join(envRoot, "bin", cliName) });
  } else {
    const rawPath = win ? environment.Path ?? environment.PATH ?? "" : environment.PATH ?? "";
    for (const entry of rawPath.split(win ? ";" : ":")) {
      const directory = entry.trim().replace(/^"(.*)"$/, "$1");
      // Never search relative/empty entries (would execute from the current directory).
      if (validAbsolute(directory)) {
        candidates.push({ source: "PATH", file: paths.join(directory, cliName) });
      }
    }
  }

  let selected: Candidate | undefined;
  const seen = new Set<string>();
  for (const item of candidates) {
    const normalized = paths.normalize(item.file);
    const key = win ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    if (await io.isExecutable(normalized)) {
      selected = { source: item.source, file: normalized };
      break;
    }
  }
  if (!selected) {
    const explicit = configured !== undefined || configuredRoot !== undefined;
    return failure(explicit ? "invalid" : "missing", explicit ? "INVALID_CONFIGURATION" : "NOT_FOUND",
      explicit ? "Configured Gungnir executable could not be found."
        : "Gungnir was not found. Install an SDK or configure an absolute SDK path.");
  }

  const sdkRoot = paths.dirname(paths.dirname(selected.file));
  let version: string | undefined;
  try {
    version = parseVersion(await io.probe(selected.file, "--version", timeoutMs), "cli");
    if (!version) {
      return failure("invalid", "VERSION_UNRECOGNIZED", "Gungnir --version returned an unrecognized response.",
        { source: selected.source, executable: selected.file, sdkRoot });
    }
  } catch {
    return failure("invalid", "CLI_PROBE_FAILED", "Unable to query Gungnir CLI version.",
      { source: selected.source, executable: selected.file, sdkRoot });
  }

  const diagnostics: ToolchainDiagnostic[] = [];
  const compilerPath = paths.join(paths.dirname(selected.file), compilerName);
  const compilerPresent = await io.isExecutable(compilerPath);
  let compilerVersion: string | undefined;
  let contract: CompilerContract | undefined;
  if (!compilerPresent) {
    diagnostics.push(diagnostic("COMPILER_MISSING", "Adjacent gungnirc compiler was not found."));
  } else {
    try {
      compilerVersion = parseVersion(await io.probe(compilerPath, "--version", timeoutMs), "compiler");
      if (!compilerVersion) {
        diagnostics.push(diagnostic("COMPILER_PROBE_FAILED", "Compiler version output was unrecognized."));
      } else if (compilerVersion !== version) {
        diagnostics.push(diagnostic("COMPILER_VERSION_MISMATCH", "CLI and compiler package versions differ."));
      }
    } catch {
      diagnostics.push(diagnostic("COMPILER_PROBE_FAILED", "Unable to query Gungnir compiler version."));
    }

    if (compilerVersion === version) {
      try {
        contract = parseCompilerContract(await io.probe(compilerPath, "--print-contract", timeoutMs));
        if (!contract) {
          diagnostics.push(diagnostic("CONTRACT_INVALID", "Compiler contract output is missing or invalid."));
        } else if (
          contract.packageVersion !== version ||
          contract.languageVersion !== EXPECTED_CONTRACT ||
          contract.compilerContract !== EXPECTED_CONTRACT ||
          contract.diagnosticContract !== EXPECTED_CONTRACT ||
          contract.compatibility !== "stable" ||
          !contract.structuredFeatureFreeze
        ) {
          diagnostics.push(diagnostic("CONTRACT_INCOMPATIBLE",
            "Installed compiler does not satisfy the stable Gungnir 1.0 contract."));
        }
      } catch {
        diagnostics.push(diagnostic("CONTRACT_INVALID", "Unable to query compiler contract."));
      }
    }
  }

  const header = paths.join(sdkRoot, "include", "gungnir", "gungnir.hpp");
  const cmake = [
    paths.join(sdkRoot, "lib", "cmake", "Gungnir", "GungnirConfig.cmake"),
    paths.join(sdkRoot, "lib64", "cmake", "Gungnir", "GungnirConfig.cmake"),
  ];
  const metadata = await io.readText(paths.join(sdkRoot, "share", "gungnir", "sdk.txt"));
  const sdkProfile = parseSDKProfile(metadata);
  const sdkVerified = await io.isFile(header) &&
    ((await io.isFile(cmake[0]!)) || (await io.isFile(cmake[1]!))) && sdkProfile !== undefined;
  if (!sdkVerified) {
    diagnostics.push(diagnostic("SDK_INCOMPLETE",
      "SDK headers, CMake package, or valid manifest could not be verified."));
  }
  if (metadata !== undefined && !sdkProfile) {
    diagnostics.push(diagnostic("SDK_PROFILE_UNKNOWN", "SDK manifest profile is missing or invalid."));
  }
  const bad = diagnostics.some(d => [
    "COMPILER_VERSION_MISMATCH", "CONTRACT_INVALID", "CONTRACT_INCOMPATIBLE",
  ].includes(d.code));
  const state: ToolchainState = bad ? "incompatible"
    : diagnostics.length === 0 ? "ready" : "partial";
  return selectedResult(state, selected, version, compilerPresent ? compilerPath : undefined,
    compilerVersion, sdkRoot, sdkVerified, sdkProfile, contract, diagnostics);
}
