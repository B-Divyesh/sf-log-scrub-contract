import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route("**/api/v1/products/log-scrub-contract/verify**", (route) => route.fulfill({
  contentType: "application/json",
  body: JSON.stringify({ valid: true, reason: "ok", expires_at: null }),
}));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
await page.goto(`${url}?license=test-license-token`, { waitUntil: "networkidle" });
if (new URL(page.url()).searchParams.has("license")) throw new Error("license query was not stripped");
if (await page.evaluate(() => localStorage.getItem("sb_license:log-scrub-contract")) !== "test-license-token") throw new Error("license was not stored");
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
console.log("e2e: mobile keyboard, fail/pass/error, paid return, and offline states passed");
await browser.close();
