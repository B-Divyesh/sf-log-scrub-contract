# Repair handoff — Azure Static Web Apps response policy

**Work order:** `log-scrub-contract-repair-2`
**Base:** `fde436d5e2893a8414988d02a81d37f185d90f8b`
**Deployment:** Azure Static Web Apps Standard static output (`dist/site`)

## What changed

- Replaced the ignored `_headers` artifact with
  `site/public/staticwebapp.config.json`, which Vite copies to the root of
  `dist/site` as required by Azure Static Web Apps.
- Added global containment headers: the restrictive CSP (including
  `frame-ancestors 'none'`), deny-by-default Permissions-Policy,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and the existing
  strict referrer policy.
- Made the document shell globally revalidate with `Cache-Control: no-cache`,
  explicitly keeps `/sw.js` on that policy, and gives only Vite's hashed
  `/assets/*.{css,js}` files `public, max-age=31536000, immutable`.
- Added `npm run check:deployment` to assert the exact emitted configuration,
  confirm no obsolete `_headers` file is in `dist/site`, and confirm hashed
  CSS and JS are covered. Added `npm run verify:live-headers` to fetch the
  live shell, worker, and shell-referenced hashed assets and require those
  exact response values.

## Verification

Completed locally:

```sh
npm ci
npm test
npm run build
npm run check:deployment
npm run test:e2e -- http://127.0.0.1:4173/
cargo clippy --locked --all-targets -- -D warnings
```

Results:

- `npm test`: passed (13 Rust unit tests, 1 doctest, 3 Vitest tests).
- `npm run build`: passed; `dist/site/staticwebapp.config.json` is emitted.
- `npm run check:deployment`: passed; found two hashed CSS/JS assets under the
  immutable Azure route.
- `npm run test:e2e` against `vite preview`: passed the mobile keyboard,
  FAIL/PASS/error recovery, license stripping/verification, offline state, and
  service-worker Cache Storage token regression checks.
- Clippy: passed with `-D warnings`.

After the Standard static deployment completes, run:

```sh
npm run verify:live-headers
cargo package --locked
```

The live-header command intentionally fails until the new artifact has reached
Azure; it is the release check for the two verifier-2 findings. `cargo package`
is left for the clean committed tree so Cargo can perform its normal dirty-tree
guard without `--allow-dirty`.

## Known gaps / next step

No product or PWA behavior changes are outstanding. Confirm the pushed build
is served by the Azure Static Web Apps **Standard** resource, then run the live
header command above and record its output. Lighthouse remains unclaimed: the
previous verifier could not run it because the container had no usable Chrome.
