import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import type { ProbeIO } from "./types.js";

/** Read-only native-probe I/O. Never used automatically at CLI startup. */
export const nativeProbeIO: ProbeIO = {
  async isExecutable(file) {
    try {
      if (!(await stat(file)).isFile()) return false;
      await access(file, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      return true;
    } catch {
      return false;
    }
  },
  async isFile(file) {
    try { return (await stat(file)).isFile(); }
    catch { return false; }
  },
  async readText(file) {
    try {
      const details = await stat(file);
      if (!details.isFile() || details.size > 16_384) return undefined;
      return await readFile(file, "utf8");
    } catch {
      return undefined;
    }
  },
  probe(file, command, timeoutMs) {
    // Both allowed arguments return information without generating or changing files.
    if (command !== "--version" && command !== "--print-contract") {
      return Promise.reject(new Error("Unsupported read-only toolchain probe"));
    }
    return new Promise((resolve, reject) => {
      execFile(file, [command], {
        shell: false, windowsHide: true, timeout: timeoutMs,
        maxBuffer: 16_384, encoding: "utf8",
      }, (error, stdout) => {
        if (error) reject(new Error("Gungnir probe failed"));
        else resolve(stdout);
      });
    });
  },
};
