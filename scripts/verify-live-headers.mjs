const base = new URL(process.argv[2] ?? "https://log-scrub-contract.sociobot.in/");
const cacheForever = "public, max-age=31536000, immutable";
const expectedSecurityHeaders = {
  "content-security-policy": "default-src 'self'; base-uri 'self'; connect-src 'self' https://api.sociobot.in; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  "permissions-policy": "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

function fail(message) {
  throw new Error(`live header check: ${message}`);
}

async function responseFor(path) {
  const response = await fetch(new URL(path, base), { redirect: "error" });
  if (!response.ok) fail(`${path} returned HTTP ${response.status}`);
  return response;
}

function expectHeader(response, path, name, expected) {
  const actual = response.headers.get(name);
  if (actual !== expected) fail(`${path} ${name} was ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const shell = await responseFor("/");
for (const [name, value] of Object.entries(expectedSecurityHeaders)) expectHeader(shell, "/", name, value);
expectHeader(shell, "/", "cache-control", "no-cache");

const worker = await responseFor("/sw.js");
expectHeader(worker, "/sw.js", "cache-control", "no-cache");

const html = await shell.text();
const assetPaths = [...new Set([...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+-[A-Za-z0-9_-]{8,}\.(?:css|js))["']/g)].map((match) => match[1]))];
if (!assetPaths.some((path) => path.endsWith(".js")) || !assetPaths.some((path) => path.endsWith(".css"))) {
  fail("the shell did not reference both hashed JavaScript and CSS assets");
}
for (const path of assetPaths) {
  const response = await responseFor(path);
  expectHeader(response, path, "cache-control", cacheForever);
}

console.log(`live header check: ${base.origin} serves containment, revalidation, and immutable caching for ${assetPaths.length} hashed assets`);
