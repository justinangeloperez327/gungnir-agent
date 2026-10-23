import { rm } from "node:fs/promises";
import { join } from "node:path";

for (const path of ["apps/cli", "packages/contracts", "packages/gungnir-toolchain", "packages/agent-core"]) {
  await rm(join(path, "dist"), { recursive: true, force: true });
}
await rm("coverage", { recursive: true, force: true });
