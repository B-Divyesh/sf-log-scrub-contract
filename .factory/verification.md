# Independent verification — FAIL

**Work order:** `log-scrub-contract-verify-1`  
**Candidate:** `80a7aa0e17ea8af2e235b2f95f94ff00e15eac10` (`80a7aa0`)  
**Live URL:** <https://log-scrub-contract.sociobot.in/>  
**Verified:** 2026-08-27 UTC

## Verdict

**FAIL.** The CLI and companion site substantially implement the researched
job-to-be-done, and the deployed static artifacts exactly match the candidate.
However, the PWA service worker persistently caches the complete payment-return
URL, including the `license` query token. This conflicts with the stated
local-storage-only license handling and leaves a credential in Cache Storage
after the address bar has been cleaned.

## Blocking defect

### High — payment license token is persisted in Cache Storage

`site/public/sw.js` caches every same-origin GET request using the original
request URL. On an already-controlled page, navigating to
`/?license=verification-license-token` produced the following state in a clean
Playwright profile:

```json
{
  "location": "http://127.0.0.1:4173/",
  "stored": "verification-license-token",
  "cacheRequests": [
    "http://127.0.0.1:4173/?license=verification-license-token"
  ]
}
```

The application correctly stores the license and calls `history.replaceState`,
but the service worker has already cached the URL as a key. The privacy page
says the license token and verdict are stored in local storage; it does not
disclose this additional persistent Cache Storage copy. Do not cache requests
whose URL contains `license`, and remove any existing matching cache entries.

## Other defects

### Medium — deployed cache policy does not meet the immutable-asset budget

The candidate includes `dist/site/_headers` specifying one-year immutable
caching for `/assets/*`, but the live host returned the same header for the
HTML, `sw.js`, and every tested hashed asset:

```
Cache-Control: public, must-revalidate, max-age=30
```

For example, `/assets/main-B9MAjBkO.js` and
`/assets/style-DWiDjS8b.css` are content-hashed but are not long-lived or
immutable in production. This misses the stated static-product caching
requirement and should be corrected in the deploy configuration before release.

### Medium — live response headers lack common browser containment controls

The live response has HSTS, `Referrer-Policy: strict-origin-when-cross-origin`,
and `X-Content-Type-Options: nosniff`, but no `Content-Security-Policy`,
`X-Frame-Options`/`frame-ancestors`, or `Permissions-Policy`. The legacy
`X-XSS-Protection` header is present but is not a CSP replacement. Add a
restrictive static-site CSP (including the one required Sociobot API origin)
and frame/permissions controls.

## Clean-checkout quality gates

An isolated detached worktree was created at the exact candidate commit.

| Check | Result |
|---|---|
| `npm ci` | PASS; 0 npm audit vulnerabilities |
| `cargo test --locked` | PASS; 13 unit tests and 1 doctest |
| `cargo clippy --locked --all-targets -- -D warnings` | PASS |
| `npm test` | PASS; Rust suite plus 3 Vitest tests |
| `npm run build` | PASS; release CLI and `dist/site` produced |
| `cargo package --locked` | PASS; `target/package/log-scrub-contract-0.1.0.crate` produced |
| Consumer install | PASS; unpacked crate installed with `cargo install --path … --locked`; installed `log-scrub 0.1.0` passed `init` and `check` |

The production build is 188 KB total. Initial JS is 7,834 bytes and CSS is
12,952 bytes, both below the budgets; desktop/mobile hero assets are 76,394 /
26,474 bytes. A local Lighthouse CLI attempt could not be completed because
the supplied Chromium crashed under Lighthouse 13.4.1; this verifier did not
substitute an unmeasured score for that failure.

## End-to-end product exercise

Using the release binary and fresh generated fixtures:

- `init` then `check --json` passed with JSON path and email redactions.
- JSON stdin auto-detection redacted an authorization value and exited 0.
- malformed JSON exited 2 without a payload; re-running `init` reported the
  recovery action and `init --force` recovered successfully.
- a deny-regex leak exited 1 with `output_withheld: true`; neither JSON evidence
  nor stderr contained the synthetic email.
- input exceeding the 10 MiB boundary exited 2 and produced no stdout payload.
- the supplied mobile E2E passed initial FAIL, configured PASS, malformed-input
  ERROR, keyboard shortcut, paid-return URL stripping, and offline state.

## Website, accessibility, PWA, and privacy evidence

- Local production preview and live deployment both passed axe on `/`,
  `/privacy/`, and `/terms/`: **0 serious/critical findings**.
- Desktop (1440 px) and mobile (390 px) Playwright smoke tests found one `h1`,
  one `main`, no console/page errors, no undersized visible interactive
  targets, and a visible `rgb(166, 61, 47) solid 3px` focus ring on the first
  keyboard focus target (the skip link).
- Reduced motion changed the primary-button transition to `0.00001s`.
- Normal page load made no cross-origin runtime request. A supplied license
  only targets `https://api.sociobot.in/api/v1/products/log-scrub-contract/verify`;
  source inspection found no analytics, beacon, third-party font, or tracker.
- Offline reload after service-worker installation retained the page `h1`.
  A controlled update probe that served a cache-version `v2` worker installed
  the new version after `registration.update()` (the product worker uses
  `skipWaiting`, `clients.claim`, and versioned cache cleanup).
- All 13 deployable static files, including HTML, JavaScript, CSS, images,
  service worker, legal pages, and `_headers`, had matching SHA-256 hashes
  between `dist/site` and the live URL.

## Scope and release recommendation

The implementation matches the brief's local-first redaction-contract scope:
path, regex, token, entropy, JSON/JSONL/text, before/after evidence, CI exit
codes, safe regex engine, and explicit non-certification warning were all
present and exercised. Do not mark this candidate released until the High
license-token cache defect is fixed and reverified. Resolve the deployed cache
and missing header controls in the same deployment follow-up.
