import { copyFile, mkdir } from "node:fs/promises";
import { platform } from "node:os";

const suffix = platform() === "win32" ? ".exe" : "";
await mkdir(new URL("../dist/bin/", import.meta.url), { recursive: true });
await copyFile(
  new URL(`../target/release/log-scrub${suffix}`, import.meta.url),
  new URL(`../dist/bin/log-scrub${suffix}`, import.meta.url),
);
