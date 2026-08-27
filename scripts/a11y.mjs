import { writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const output = process.argv[3] ?? ".factory/evidence/axe.json";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle" });
const results = await new AxeBuilder({ page }).analyze();
await writeFile(output, JSON.stringify(results, null, 2));
const blocking = results.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
console.log(`axe: ${results.violations.length} violation types; ${blocking.length} serious/critical`);
for (const violation of blocking) console.error(`${violation.impact}: ${violation.id} — ${violation.help}`);
await browser.close();
process.exitCode = blocking.length > 0 ? 1 : 0;
