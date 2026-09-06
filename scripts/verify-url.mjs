import { chromium } from "playwright";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:4173/");
const routes = ["/", "/demo/", "/privacy/", "/terms/", "/404.html"];
const browser = await chromium.launch();
const errors = [];

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport });
  for (const route of routes) {
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${route}: ${error}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${route}: ${message.text()}`);
    });
    await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
    const facts = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      title: document.title,
      h1: document.querySelectorAll("h1").length,
      main: document.querySelectorAll("main").length,
      missingAlt: [...document.images].filter((image) => !image.hasAttribute("alt")).length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      skip: Boolean(document.querySelector('.skip-link[href="#main"]')),
      header: Boolean(document.querySelector("header nav")),
      footer: Boolean(document.querySelector("footer")),
    }));
    if (facts.lang !== "en" || !facts.title || facts.h1 !== 1 || facts.main !== 1 || facts.missingAlt || facts.overflow || !facts.skip || !facts.header || !facts.footer) {
      throw new Error(`${route} at ${viewport.width}px has invalid page structure: ${JSON.stringify(facts)}`);
    }
    if (route === "/demo/") {
      await page.getByText("Demo — sample data, nothing is saved to your real data").waitFor();
      await page.locator("#result-state").getByText("PASS").waitFor();
    }
    if (route === "/404.html") {
      await page.getByRole("link", { name: "Go to the home page" }).waitFor();
    }
    await page.close();
  }
  await context.close();
}

await browser.close();
if (errors.length) throw new Error(`browser errors: ${errors.join("; ")}`);
console.log(`url verification: ${base.origin} passed desktop and phone structure checks for ${routes.length} routes`);
