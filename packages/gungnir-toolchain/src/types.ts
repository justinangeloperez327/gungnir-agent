export type ToolchainSource = "configured" | "sdkRoot" | "environment" | "PATH";
export type ToolchainState = "ready" | "partial" | "missing" | "invalid" | "incompatible";
export type SDKProfile = "core" | "application";
export type ProbeCommand = "--version" | "--print-contract";

export interface DiscoveryOptions {
  readonly executablePath?: string;
  readonly sdkRoot?: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly timeoutMs?: number;
}

export interface ProbeIO {
  isExecutable(file: string): Promise<boolean>;
  isFile(file: string): Promise<boolean>;
  readText(file: string): Promise<string | undefined>;
  /** Only fixed, read-only probe commands; never an arbitrary argv array. */
  probe(file: string, command: ProbeCommand, timeoutMs: number): Promise<string>;
}

export interface CompilerContract {
  readonly packageVersion: string;
  readonly languageVersion: string;
  readonly compilerContract: string;
  readonly diagnosticContract: string;
  readonly structuredFeatureFreeze: boolean;
  readonly compatibility: "stable" | "deprecated" | "experimental";
}

export interface ToolchainCapabilities {
  readonly compilerCheck: boolean;
  readonly irVerification: boolean;
  readonly languageServer: boolean;
  readonly nativeBuild: boolean;
  /** Package profile declaration; other adapters still require SDK inspection. */
  readonly sdkProfile?: SDKProfile;
}

export interface ToolchainDiagnostic {
  readonly code:
    | "INVALID_CONFIGURATION" | "NOT_FOUND" | "CLI_PROBE_FAILED"
    | "VERSION_UNRECOGNIZED" | "COMPILER_MISSING"
    | "COMPILER_PROBE_FAILED" | "COMPILER_VERSION_MISMATCH"
    | "CONTRACT_INVALID" | "CONTRACT_INCOMPATIBLE"
    | "SDK_INCOMPLETE" | "SDK_PROFILE_UNKNOWN";
  readonly message: string;
}

export interface ToolchainResult {
  readonly state: ToolchainState;
  readonly message: string;
  readonly source?: ToolchainSource;
  readonly executable?: string;
  readonly version?: string;
  readonly compiler?: string;
  readonly compilerVersion?: string;
  readonly sdkRoot?: string;
  readonly sdkProfile?: SDKProfile;
  readonly sdkVerified: boolean;
  readonly contract?: CompilerContract;
  readonly capabilities: ToolchainCapabilities;
  readonly diagnostics: readonly ToolchainDiagnostic[];
}
