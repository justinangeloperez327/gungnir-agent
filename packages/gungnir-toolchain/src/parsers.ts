import type { CompilerContract, SDKProfile } from "./types.js";

const VERSION = "(v?\\d+\\.\\d+\\.\\d+(?:[-+][\\w.-]+)?|development)";
const CLIENT_VERSION = new RegExp("^Gungnir\\s+" + VERSION + "(?=\\s|$)", "i");
const COMPILER_VERSION = new RegExp("^Gungnir compiler\\s+" + VERSION + "(?=\\s|$|\\()", "i");
const KEY = /^(\w+)=([^\r\n]+)$/;

export function parseVersion(output: string, executable: "cli" | "compiler"): string | undefined {
  if (output.length > 4096) return undefined;
  const first = output.trimStart().split(/\r?\n/, 1)[0] ?? "";
  const match = first.match(executable === "cli" ? CLIENT_VERSION : COMPILER_VERSION);
  return match?.[1]?.replace(/^v(?=\d)/i, "");
}

export function parseCompilerContract(output: string): CompilerContract | undefined {
  if (output.length > 8192) return undefined;
  const pairs = new Map<string, string>();
  for (const rawLine of output.trim().split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const pair = rawLine.match(KEY);
    if (!pair || pairs.has(pair[1]!)) return undefined;
    pairs.set(pair[1]!, pair[2]!.trim());
  }
  const get = (key: string): string | undefined => pairs.get(key);
  const packageVersion = get("package_version");
  const languageVersion = get("language_version");
  const compilerContract = get("compiler_contract");
  const diagnosticContract = get("diagnostic_contract");
  const freeze = get("structured_feature_freeze");
  const compatibility = get("compatibility");
  if (!packageVersion || !languageVersion || !compilerContract || !diagnosticContract ||
      !/^(?:\d+\.\d+\.\d+(?:[-+][\w.-]+)?|development)$/.test(packageVersion) ||
      !/^\d+\.\d+$/.test(languageVersion) ||
      !/^\d+\.\d+$/.test(compilerContract) ||
      !/^\d+\.\d+$/.test(diagnosticContract) ||
      (freeze !== "true" && freeze !== "false") ||
      (compatibility !== "stable" && compatibility !== "deprecated" && compatibility !== "experimental")) {
    return undefined;
  }
  return Object.freeze({
    packageVersion, languageVersion, compilerContract, diagnosticContract,
    structuredFeatureFreeze: freeze === "true", compatibility,
  });
}

export function parseSDKProfile(manifest: string | undefined): SDKProfile | undefined {
  if (!manifest || manifest.length > 16384) return undefined;
  const matches = [...manifest.matchAll(/^profile\s*=\s*(core|application)\s*$/gim)];
  if (matches.length !== 1) return undefined;
  const value = matches[0]?.[1]?.toLowerCase();
  return value === "core" || value === "application" ? value : undefined;
}
