/*
 * Privacy boundary: checkout return URLs and entitlement responses are never
 * written to Cache Storage. The checkout token belongs only in localStorage,
 * after the application has removed it from the visible URL.
 */
const CACHE = "log-scrub-contract-v2";
const SHELL = ["/", "/privacy/", "/terms/", "/favicon.svg", "/assets/hero-lab-720.webp", "/assets/hero-lab.webp"];
const LICENSE_PARAMS = ["license", "license_token", "entitlement"];

function isSensitiveUrl(url) {
  return LICENSE_PARAMS.some((name) => url.searchParams.has(name))
    || /\/api\/v1\/products\/[^/]+\/(?:verify|entitlement)(?:\/|$)/.test(url.pathname);
}

function isHashedAsset(url) {
  return url.origin === self.location.origin
    && /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.(?:css|js)$/.test(url.pathname);
}

async function removeSensitiveEntries() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(async (name) => {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    await Promise.all(requests
      .filter((request) => isSensitiveUrl(new URL(request.url)))
      .map((request) => cache.delete(request)));
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await removeSensitiveEntries();
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation, checkout return, and entitlement verification are deliberately
  // network-only. A failed safe navigation can use only the known-safe shell.
  if (event.request.mode === "navigate" || isSensitiveUrl(url)) {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

  if (!isHashedAsset(url)) return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
