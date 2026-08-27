# Handoff — Log Scrub Contract v0.1.0 repair

## Release status: ready for Standard static docs deployment

This repair resolves the independent report at `f5338e4251d7e7b354702717356863987703eac0` for candidate `80a7aa0e17ea8af2e235b2f95f94ff00e15eac10`.

## What changed

- Replaced the cache-every-GET worker with `log-scrub-contract-v2`. It only precaches fixed, token-free shell URLs and only runtime-caches content-hashed `/assets/*.js` and `/assets/*.css` responses.
- Navigation requests are network-only (with the known-safe root shell as the offline fallback). URLs with `license`, `license_token`, or `entitlement` query keys, and product verification/entitlement paths, are never cached.
- On activation the worker removes every old cache version and scans the active cache for any matching sensitive key, so previously persisted checkout URLs are removed during the upgrade.
- The checkout return code deletes `license` from the address bar before any storage operation, preserves unrelated query/hash state, and has a same-origin `location.replace` fallback if `history.replaceState` is unavailable. License storage failure is handled quietly rather than leaving the token in the URL or throwing.
- Kept the registered production Sociobot/Dodo Live checkout and verify URLs: `https://api.sociobot.in/api/v1/products/log-scrub-contract/checkout` and `.../verify?license=...`. A live GET to the checkout endpoint returned HTTP `303` to `checkout.dodopayments.com` on 2026-08-27 UTC.
- Added static-docs `_headers`: no-cache for documents and `sw.js`, one-year immutable caching for content-hashed JS/CSS, restrictive CSP with the Sociobot API in `connect-src`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, and a deny-by-default Permissions Policy.
- Updated privacy and README copy to make the address-bar and Cache Storage boundary explicit.

## Verification performed

From a clean dependency install:

```sh
npm ci
npm test
cargo clippy --locked --all-targets -- -D warnings
npm run build
```

- `npm test` passed: 13 Rust unit tests, 1 doctest, and 3 Vitest tests.
- Clippy passed with `-D warnings`.
- `npm run build` created `dist/site` and `dist/bin/log-scrub`. The generated initial JavaScript is 7,943 bytes and CSS is 12,952 bytes.
- Browser/PWA regression passed against a local Vite server:

  ```sh
  npm run dev -- --host 127.0.0.1
  npm run test:e2e -- http://127.0.0.1:5173/
  ```

  It seeds the old v1 Cache Storage with a license URL and a body containing a synthetic token, reinstalls the worker, performs a Dodo Live verify-route return, requests a token-bearing entitlement response, then enumerates every Cache Storage request key and response byte sequence. No token bytes remain. It also covers mobile keyboard FAIL/PASS/ERROR states and offline status.
- Axe passed at mobile size with 0 violation types and 0 serious/critical findings:

  ```sh
  mkdir -p .factory/evidence
  node scripts/a11y.mjs http://127.0.0.1:5173/ .factory/evidence/axe-repair.json
  ```

- Release CLI smoke passed: `init` and `check` pass a starter fixture; a synthetic residual secret makes `redact --json` exit 1 and neither stdout nor stderr contains the synthetic email or token bytes. This preserves the output-withholding redaction contract.

## Run, package, and deploy

```sh
npm ci
npm test
npm run build
cargo package --locked
```

Deploy `dist/site` as Standard static docs at `https://log-scrub-contract.sociobot.in`. The factory owns publishing and registry credentials; do not publish the crate from this checkout.

## Known limits

- Team Pack remains a client-side convenience unlock, not DRM. Do not place confidential material in a future client-delivered pack.
- The copied CLI binary is built for this Linux worker; release automation should create signed binaries for all supported platforms.
