import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "site/public/staticwebapp.config.json");
const output = resolve(root, "dist/site/staticwebapp.config.json");
const assets = resolve(root, "dist/site/assets");
const cacheForever = "public, max-age=31536000, immutable";
const csp = "default-src 'self'; base-uri 'self'; connect-src 'self' https://api.sociobot.in; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'";

function fail(message) {
  throw new Error(`deployment policy: ${message}`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!await exists(output)) fail("run `npm run build` first; dist/site/staticwebapp.config.json is missing");
if (await exists(resolve(root, "dist/site/_headers"))) fail("stale _headers file was emitted; Azure Static Web Apps ignores it");

const [sourceText, outputText] = await Promise.all([readFile(source, "utf8"), readFile(output, "utf8")]);
if (sourceText !== outputText) fail("built staticwebapp.config.json does not exactly match site/public");

let config;
try {
  config = JSON.parse(outputText);
} catch (error) {
  fail(`built configuration is not valid JSON (${error.message})`);
}

const expectedHeaders = {
  "Cache-Control": "no-cache",
  "Content-Security-Policy": csp,
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};
for (const [header, value] of Object.entries(expectedHeaders)) {
  if (config.globalHeaders?.[header] !== value) fail(`global ${header} must be ${JSON.stringify(value)}`);
}

const assetRoute = config.routes?.find(({ route }) => route === "/assets/*.{css,js}");
if (assetRoute?.headers?.["Cache-Control"] !== cacheForever) {
  fail("the CSS/JS asset route must have a one-year immutable cache policy");
}
const workerRoute = config.routes?.find(({ route }) => route === "/sw.js");
if (workerRoute?.headers?.["Cache-Control"] !== "no-cache") {
  fail("/sw.js must explicitly revalidate");
}

const assetFiles = await readdir(assets);
const hashedScriptsAndStyles = assetFiles.filter((file) => /-[A-Za-z0-9_-]{8,}\.(?:css|js)$/.test(file));
if (!hashedScriptsAndStyles.some((file) => file.endsWith(".js")) || !hashedScriptsAndStyles.some((file) => file.endsWith(".css"))) {
  fail("built output must include hashed JavaScript and CSS assets covered by the immutable route");
}

console.log(`deployment policy: built Azure config verified; ${hashedScriptsAndStyles.length} hashed CSS/JS assets are immutable`);
