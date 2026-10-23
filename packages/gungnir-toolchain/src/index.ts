/** Target contract documented by Gungnir v1.0.2. Installed binaries are probed explicitly. */
export const TARGET_LANGUAGE_CONTRACT = "1.0" as const;

export { discoverToolchain } from "./discovery.js";
export { parseVersion, parseCompilerContract, parseSDKProfile } from "./parsers.js";
export type {
  ToolchainSource, ToolchainState, SDKProfile, ProbeCommand, DiscoveryOptions,
  ProbeIO, CompilerContract, ToolchainCapabilities, ToolchainDiagnostic, ToolchainResult,
} from "./types.js";
