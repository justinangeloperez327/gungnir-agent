import { rm } from "node:fs/promises";
import { join } from "node:path";
for (const workspace of [
  "apps/cli", "packages/contracts", "packages/gungnir-toolchain",
  "packages/agent-core", "packages/mcp-client", "packages/model-adapters",
]) await rm(join(workspace, "dist"), { recursive: true, force: true });
await rm("coverage", { recursive: true, force: true });
