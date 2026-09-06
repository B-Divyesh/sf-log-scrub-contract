import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const incoming = process.argv.slice(2);
const args = [];
for (let index = 0; index < incoming.length; index += 1) {
  if (incoming[index] === "--grep") {
    args.push("--testNamePattern", incoming[index + 1] ?? "");
    index += 1;
  } else {
    args.push(incoming[index]);
  }
}

const vitest = resolve(import.meta.dirname, "../node_modules/vitest/vitest.mjs");
const result = spawnSync(process.execPath, [vitest, "run", "--config", "site/vite.config.ts", ...args], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
