# Repair handoff — implementation complete; production propagation pending

**Work order:** `log-scrub-contract-repair-3`  
**Implementation SHA:** `cdf29d24ce4a70daa4b3a931a28038afdae4897b`  
**Live URL:** <https://log-scrub-contract.sociobot.in/>  
**Date:** 2026-09-06 UTC

## Job, audience, and first action

Log Scrub Contract lets security-conscious developers test that configured
secrets and personal data are removed before structured logs leave a drain,
support bundle, or CI artifact. The first screen says this, names developers
who forward structured logs, and leads with **Try it with sample data**. That
action opens `/demo/` with a populated support-log result.

## Completed repair work

| Review finding | Resolution |
|---|---|
| R1: no claims registry | Added `.factory/claims.json` with 18 public claims. Each names exactly one `@claim:<id>` clean-state test command. The browser/CLI checks are outcome-based, not source-string checks. |
| R2: no CLI demo or sample | Added `examples/demo/`, packaged it in the crate, and added `log-scrub demo [--output DIRECTORY]`. It creates an isolated temporary sample, runs the real check, writes `scrub-report.md`, and prints its location. Added a self-hosted SVG terminal recording of that command. |
| R3: ordinary browser sample was not a sandbox | Added `/demo/` with a persistent **Demo — sample data, nothing is saved to your real data** banner, a populated passing sample, **Reset demo**, and **Start for real**. Edits use only `demo:log-scrub-contract:` local-storage keys. |
| R4: missing demo/404 pages | Added the built `/demo/` page and a product-styled `404.html`; Azure `responseOverrides` rewrites real 404s to it with status 404. |
| R5: incomplete metadata | Added canonical, Open Graph, Twitter, Apple touch icon, and a 1200×630 product-derived social card to every route. |
| R6: first-screen/copy gaps | Rewrote the first screen in plain words, replaced mood headings, added the self-hosted terminal recording, and added `.factory/copy-audit.md`. |
| R7: legal headers | Privacy and Terms now have the shared wordmark, skip link, navigation, footer, build marker, metadata, and touch icon. |

The former cache-token and response-header fixes remain present. The new
browser regression verifies the cache contains no license bytes after a return
flow; the static deployment-policy check retains CSP, headers, immutable
hashed assets, and worker revalidation.

## Verification

### Fresh checkout

An isolated clone of `cdf29d2` completed:

```sh
npm ci
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
cargo fmt --check
npm run build
npm run check:deployment
cargo package --locked
```

All passed. `cargo package` verified an 11-file crate containing the bundled
examples. Every one of the 18 commands declared in `.factory/claims.json` was
then run from that clone; all passed. The `free-cli` claim packages, extracts,
installs, and invokes the public binary in an isolated consumer prefix.

### Local built-site checks

- `npm test` passed: 13 Rust tests, 1 doctest, 3 demo tests, and 18 claim
  tests.
- `npm run build` passed and emitted `dist/site`.
- `npm run check:deployment` passed.
- `npm run test:e2e -- http://127.0.0.1:4173/` passed after the direct demo,
  404 page, reset isolation, keyboard PASS/FAIL/ERROR recovery, offline note,
  license return stripping, and Cache Storage scan were exercised.
- `npm run verify:url -- http://127.0.0.1:4173/` passed at 1440×900 and
  390×844 for `/`, `/demo/`, `/privacy/`, `/terms/`, and `/404.html`.
- Axe recorded zero violation types on each of those local production routes.
- A fresh desktop and phone browser showed the job, audience, and sample-demo
  first action before scrolling. The phone view stacks the content without
  horizontal overflow.
- Production build budgets: initial JS 8.43 kB (3.73 kB gzip), CSS 15.79 kB
  (4.24 kB gzip), and the existing mobile hero remains below 300 kB. No
  third-party font, script, or analytics request is shipped.

Lighthouse remains unmeasured because the supplied Chromium cannot be launched
by the available Lighthouse runner. No Lighthouse score is claimed.

## Deployment status and known gap

`cdf29d2` was pushed to `origin/main`. At the time of this handoff, the HTTPS
origin still returns the previous page title and `main-Bygm84Sp.js`; `/demo/`
still returns the old host 404. This is an external static-host propagation
gap, not a product-build mismatch. The repository contains no deployment
credential or product deployment wrapper. A scoped `swa deploy dist/site`
attempt authenticated Azure but stalled while discovering project settings, so
it was cancelled; its generated local credential file was removed. No
infrastructure or shared service was changed. The next operator should
trigger/confirm the product's normal static deployment for `cdf29d2`, then run:

```sh
npm run test:e2e -- https://log-scrub-contract.sociobot.in/
npm run verify:url -- https://log-scrub-contract.sociobot.in/
node scripts/a11y.mjs https://log-scrub-contract.sociobot.in/demo/ /tmp/live-demo-axe.json
npm run verify:live-headers
```

After the deployment moves, verify an unknown live URL returns HTTP 404 with
the designed page and compare the live `main-*.js` hash with the built asset.
