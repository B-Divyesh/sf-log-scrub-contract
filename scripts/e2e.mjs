import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const origin = new URL(url).origin;
const token = "browser-cache-regression-license-token";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
let liveVerificationUrl = "";
await context.route("https://api.sociobot.in/api/v1/products/log-scrub-contract/verify**", (route) => {
  liveVerificationUrl = route.request().url();
  return route.fulfill({
  contentType: "application/json",
  headers: { "access-control-allow-origin": "*" },
  body: JSON.stringify({ valid: true, reason: "ok", expires_at: null }),
  });
});
await context.route(`${origin}/api/v1/products/log-scrub-contract/verify**`, (route) => route.fulfill({
  contentType: "application/json",
  body: JSON.stringify({ valid: true, entitlement: token }),
}));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
await page.evaluate(async (value) => {
  const legacy = await caches.open("log-scrub-contract-v1");
  await legacy.put(`/?license=${encodeURIComponent(value)}`, new Response(`legacy entitlement ${value}`));
  await Promise.all((await navigator.serviceWorker.getRegistrations()).map((registration) => registration.unregister()));
}, token);
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
if (await page.locator("#buy-link").getAttribute("href") !== "https://api.sociobot.in/api/v1/products/log-scrub-contract/checkout") {
  throw new Error("Team Pack buy link is not the registered Dodo Live checkout endpoint");
}
await page.goto(`${url}?license=${token}&source=checkout#team-pack`, { waitUntil: "networkidle" });
if (new URL(page.url()).searchParams.has("license")) throw new Error("license query was not stripped from the address bar");
if (!new URL(page.url()).searchParams.has("source")) throw new Error("safe checkout return query was not preserved");
if (await page.evaluate(() => localStorage.getItem("sb_license:log-scrub-contract")) !== token) throw new Error("license was not stored");
await page.waitForFunction(() => document.querySelector("#license-status")?.textContent?.includes("active") ?? false);
if (!liveVerificationUrl.includes(`/verify?license=${encodeURIComponent(token)}`)) {
  throw new Error("license was not verified with the Dodo Live Sociobot endpoint");
}
await page.evaluate(async (value) => {
  await fetch(`/api/v1/products/log-scrub-contract/verify?license=${encodeURIComponent(value)}`);
}, token);
const cacheEvidence = await page.evaluate(async (value) => {
  const entries = [];
  for (const cacheName of await caches.keys()) {
    const cache = await caches.open(cacheName);
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      const bytes = response ? new Uint8Array(await response.clone().arrayBuffer()) : new Uint8Array();
      entries.push({
        cacheName,
        url: request.url,
        hasTokenBytes: new TextDecoder().decode(bytes).includes(value),
      });
    }
  }
  return entries;
}, token);
if (cacheEvidence.some((entry) => entry.url.includes(token) || entry.hasTokenBytes)) {
  throw new Error(`Cache Storage contains checkout or entitlement token bytes: ${JSON.stringify(cacheEvidence)}`);
}
await page.locator("#fixture").press("Control+Enter");
await page.locator("#result-state").getByText("FAIL").waitFor();
await page.locator("#path-rules").fill("request.headers.authorization, user.email, session_material");
await page.locator("#run-contract").click();
await page.locator("#result-state").getByText("PASS").waitFor();
await page.locator("#fixture").fill("not json");
await page.locator("#run-contract").click();
await page.locator("#result-state").getByText("ERROR").waitFor();
await context.setOffline(true);
await page.evaluate(() => window.dispatchEvent(new Event("offline")));
if (await page.locator("#offline-note").isHidden()) throw new Error("offline state was not shown");
if (errors.length) throw new Error(`browser console errors: ${errors.join("; ")}`);
console.log("e2e: mobile keyboard, fail/pass/error, Dodo Live return stripping, and Cache Storage token-byte regression passed");
await browser.close();
