import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { preview, type PreviewServer } from "vite";

const root = resolve(import.meta.dirname, "../..");
const binary = resolve(root, "target/release/log-scrub");
const origin = "http://127.0.0.1:4179";
const demoUrl = `${origin}/demo/`;
const api = "https://api.sociobot.in/api/v1/products/log-scrub-contract/verify";
const demoPolicy = resolve(root, "examples/demo/log-scrub.json");
const demoFixture = resolve(root, "examples/demo/fixtures/support.json");
let browser: Browser;
let server: PreviewServer;
const temporaryPaths: string[] = [];

function run(args: string[], cwd = root): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(binary, args, { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

async function temp(label: string): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), `log-scrub-${label}-`));
  temporaryPaths.push(path);
  return path;
}

async function pageFromDemo(): Promise<{ context: BrowserContext; page: Awaited<ReturnType<BrowserContext["newPage"]>> }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(demoUrl, { waitUntil: "networkidle" });
  await page.getByText("Demo — sample data, nothing is saved to your real data").waitFor();
  await page.locator("#result-state").getByText("PASS").waitFor();
  return { context, page };
}

async function homeFromDemo(context: BrowserContext): Promise<Awaited<ReturnType<BrowserContext["newPage"]>>> {
  const page = await context.newPage();
  await page.goto(demoUrl, { waitUntil: "networkidle" });
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  return page;
}

describe("public product claims", () => {
  beforeAll(async () => {
    execFileSync("cargo", ["build", "--release", "--locked"], { cwd: root, stdio: "pipe" });
    execFileSync("npm", ["run", "build:site"], { cwd: root, stdio: "pipe" });
    server = await preview({ configFile: resolve(root, "site/vite.config.ts"), preview: { host: "127.0.0.1", port: 4179 } });
    browser = await chromium.launch();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
    await Promise.all(temporaryPaths.map((path) => rm(path, { recursive: true, force: true })));
  });

  it("@claim:regression-contract", async () => {
    const output = resolve(await temp("contract"), "demo");
    const result = run(["demo", "--output", output]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Contract passed");
    expect(await readFile(resolve(output, "scrub-report.md"), "utf8")).toContain("[REDACTED:authorization]");
  });

  it("@claim:local-no-upload", async () => {
    const { context, page } = await pageFromDemo();
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.locator("#fixture").fill('{"user":{"email":"person@example.test"},"request":{"headers":{"authorization":"Bearer demo_sk_A1b2C3d4E5f6"}},"session_material":"k9Qv2Lm8Xz4Rp7Tw3Ny6Bc1D"}');
    await page.locator("#run-contract").click();
    await page.locator("#result-state").getByText("PASS").waitFor();
    expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
    await context.close();
  });

  it("@claim:no-telemetry", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(demoUrl, { waitUntil: "networkidle" });
    expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
    await context.close();
  });

  it("@claim:irreversible-markers", async () => {
    const result = run(["redact", "--config", demoPolicy, demoFixture]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[REDACTED:authorization]");
    expect(result.stdout).not.toContain("demo_sk_A1b2C3d4E5f6G7h8");
  });

  it("@claim:path-rules", async () => {
    const { context, page } = await pageFromDemo();
    await page.locator("#path-rules").fill("request.headers.authorization, user.email");
    await page.locator("#run-contract").click();
    await page.locator("#result-state").getByText("FAIL").waitFor();
    await page.locator("#path-rules").fill("request.headers.authorization, user.email, session_material");
    await page.locator("#run-contract").click();
    await page.locator("#result-state").getByText("PASS").waitFor();
    expect(await page.locator("#result").textContent()).toContain("[REDACTED:session_material]");
    await context.close();
  });

  it("@claim:safe-regex", async () => {
    const directory = await temp("regex");
    const policy = resolve(directory, "policy.json");
    const fixture = resolve(directory, "fixture.log");
    await writeFile(policy, '{"version":1,"rules":[{"id":"nested","kind":"regex","pattern":"^(a+)+$"}],"assertions":[],"entropy":{"enabled":false}}');
    await writeFile(fixture, `${"a".repeat(100_000)}!`);
    const started = performance.now();
    const result = run(["redact", "--config", policy, fixture]);
    expect(result.status).toBe(0);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it("@claim:runtime-tokens", async () => {
    const directory = await temp("token");
    const policy = resolve(directory, "policy.json");
    const fixture = resolve(directory, "fixture.log");
    const token = "sample_runtime_token_9K4p";
    await writeFile(policy, '{"version":1,"rules":[{"id":"runtime","kind":"token","name":"support_key"}],"assertions":[],"entropy":{"enabled":false}}');
    await writeFile(fixture, `key=${token}`);
    const result = run(["redact", "--config", policy, "--token", `support_key=${token}`, fixture]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[REDACTED:runtime]");
    expect(await readFile(policy, "utf8")).not.toContain(token);
  });

  it("@claim:entropy", async () => {
    const directory = await temp("entropy");
    const policy = resolve(directory, "policy.json");
    const fixture = resolve(directory, "fixture.log");
    const candidate = "Az9_xY8-qW7.rT6+uI5/pO4=";
    await writeFile(policy, '{"version":1,"rules":[],"assertions":[],"entropy":{"enabled":true,"min_length":20,"threshold":3.5,"allow":[]}}');
    await writeFile(fixture, `token=${candidate}`);
    const result = run(["redact", "--json", "--config", policy, fixture]);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, output_withheld: true });
    expect(result.stdout).not.toContain(candidate);
  });

  it("@claim:browser-tab", async () => {
    const { context, page } = await pageFromDemo();
    await page.locator("#fixture").fill('{"request":{"headers":{"authorization":"Bearer demo_sk_A1b2C3d4E5f6"}},"user":{"email":"browser@example.test"},"session_material":"k9Qv2Lm8Xz4Rp7Tw3Ny6Bc1D"}');
    await page.locator("#run-contract").click();
    await page.locator("#result-state").getByText("PASS").waitFor();
    const storage = await page.evaluate(() => Object.keys(localStorage));
    expect(storage.every((key) => key.startsWith("demo:log-scrub-contract:"))).toBe(true);
    await context.close();
  });

  it("@claim:jsonl", async () => {
    const directory = await temp("jsonl");
    const fixture = await readFile(demoFixture, "utf8");
    const jsonl = resolve(directory, "support.jsonl");
    await writeFile(jsonl, `${JSON.stringify(JSON.parse(fixture))}\n${JSON.stringify(JSON.parse(fixture))}\n`);
    const result = run(["check", "--json", "--config", demoPolicy, jsonl]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, summary: { files: 1, redactions: 4, violations: 0 } });
  });

  it("@claim:private-reports", async () => {
    const output = resolve(await temp("report"), "demo");
    expect(run(["demo", "--output", output]).status).toBe(0);
    const report = await readFile(resolve(output, "scrub-report.md"), "utf8");
    expect(report).toContain("[REDACTED:customer-email]");
    expect(report).not.toContain("ada@example.test");
    expect(report).not.toContain("demo_sk_A1b2C3d4E5f6G7h8");
  });

  it("@claim:ci-exit-codes", async () => {
    const directory = await temp("exit");
    const leakingPolicy = resolve(directory, "leak-policy.json");
    const fixture = resolve(directory, "leak.log");
    await writeFile(leakingPolicy, '{"version":1,"rules":[],"assertions":[{"id":"no-email","kind":"deny_regex","pattern":"[a-z]+@[a-z.]+"}],"entropy":{"enabled":false}}');
    await writeFile(fixture, "owner=private@example.test");
    expect(run(["demo", "--output", resolve(directory, "safe")]).status).toBe(0);
    expect(run(["check", "--config", leakingPolicy, fixture]).status).toBe(1);
    expect(run(["check", "--config", resolve(directory, "missing.json"), fixture]).status).toBe(2);
  });

  it("@claim:offline-demo", async () => {
    const { context, page } = await pageFromDemo();
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await page.locator("h1").textContent()).toBe("Test the sample support log");
    await page.locator("#result-state").getByText("PASS").waitFor();
    await context.close();
  });

  it("@claim:license-cache", async () => {
    const token = "claim-license-cache-token";
    const context = await browser.newContext();
    await context.route(`${api}**`, (route) => route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ valid: true, reason: "ok" }) }));
    const page = await homeFromDemo(context);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.goto(`${origin}/?license=${token}`, { waitUntil: "networkidle" });
    await page.getByText("Team Pack license active.").waitFor();
    const cacheEntries = await page.evaluate(async () => {
      const entries: { url: string; body: string }[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          const response = await cache.match(request);
          entries.push({ url: request.url, body: response ? await response.clone().text() : "" });
        }
      }
      return entries;
    });
    expect(new URL(page.url()).searchParams.has("license")).toBe(false);
    expect(cacheEntries.some((entry) => entry.url.includes(token) || entry.body.includes(token))).toBe(false);
    await context.close();
  });

  it("@claim:free-cli", async () => {
    const directory = await temp("consumer");
    execFileSync("cargo", ["package", "--allow-dirty", "--locked"], { cwd: root, stdio: "pipe" });
    const crate = resolve(root, "target/package/log-scrub-contract-0.1.0.crate");
    const unpacked = resolve(directory, "unpacked");
    await mkdir(unpacked);
    execFileSync("tar", ["-xzf", crate, "-C", unpacked], { cwd: root });
    const consumer = resolve(unpacked, "log-scrub-contract-0.1.0");
    const installRoot = resolve(directory, "install");
    execFileSync("cargo", ["install", "--path", consumer, "--root", installRoot, "--locked"], { cwd: root, stdio: "pipe" });
    const consumerBinary = resolve(installRoot, "bin/log-scrub");
    const output = resolve(directory, "sample");
    const result = spawnSync(consumerBinary, ["demo", "--output", output], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout ?? "").toContain("Contract passed");
    expect(await readFile(resolve(output, "scrub-report.md"), "utf8")).toContain("[REDACTED:authorization]");
  });

  it("@claim:team-pack-price", async () => {
    const context = await browser.newContext();
    const page = await homeFromDemo(context);
    const packText = await page.locator("#team-pack").textContent();
    expect(packText).toContain("$29 once");
    expect(packText).toContain("12 annotated policy presets");
    expect(packText).toContain("CI matrices for multiple drains");
    expect(await page.locator("#buy-link").getAttribute("href")).toBe("https://api.sociobot.in/api/v1/products/log-scrub-contract/checkout");
    await context.close();
  });

  it("@claim:license-lock", async () => {
    const context = await browser.newContext();
    await context.route(`${api}**`, (route) => route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ valid: false, reason: "revoked" }) }));
    const page = await homeFromDemo(context);
    await page.goto(`${origin}/?license=invalid-license`, { waitUntil: "networkidle" });
    await page.getByText("License no longer active. You can purchase or restore another license.").waitFor();
    expect(await page.locator("#pack-unlocked").isHidden()).toBe(true);
    await context.close();
  });

  it("@claim:templates-private", async () => {
    const token = "template-license-value";
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const copied: string[] = [];
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { copied.push(value); } } });
      Object.defineProperty(window, "claimCopiedTemplates", { configurable: true, value: copied });
    });
    await context.route(`${api}**`, (route) => route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ valid: true, reason: "ok" }) }));
    const page = await homeFromDemo(context);
    await page.goto(`${origin}/?license=${token}`, { waitUntil: "networkidle" });
    await page.getByText("Team Pack license active.").waitFor();
    await page.locator("[data-pack-template]").allTextContents();
    for (const button of await page.locator("[data-pack-template]").all()) await button.click();
    const copied = await page.evaluate(() => (window as Window & { claimCopiedTemplates: string[] }).claimCopiedTemplates);
    expect(copied).toHaveLength(3);
    expect(copied.join("\n")).not.toContain(token);
    expect(copied.join("\n")).not.toContain("ada@example.test");
    await context.close();
  });
});
