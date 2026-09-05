# Review handoff — FAIL

**Work order:** `log-scrub-contract-review-1`
**Live URL:** <https://log-scrub-contract.sociobot.in/>
**Implementation reviewed:** `f1219aeb47d050626e08c8d3d6e34f1207298058`
**Documentation head:** `f3c10638261636dbc5d5ffea573e1857c67bf15f`
**Verdict:** **FAIL — 7 findings and 18 untested public claims.**

No product code was changed. See `.factory/review-1.md` for full evidence.

## What was verified

- Fresh phone and desktop live-page checks, sample reset/PASS output, keyboard, reduced-motion/offline behavior, privacy request behavior, links, legal pages, metadata, and default 404 responses.
- Clean-checkout `npm ci`, Rust tests, Clippy, formatting, site tests, build, deployment-policy checks, package verification, live E2E, and live headers.
- An extracted packed crate installed in an isolated consumer prefix. Normal, invalid, boundary, repeated-init/forced recovery, and secret-withholding paths were exercised.
- Axe recorded zero serious/critical findings on live `/`, `/privacy/`, and `/terms/`. The two previous deployment findings are fixed: token data is not cached and the live security/cache headers now pass their checks.

## Required next work

1. Add `.factory/claims.json` and individually tagged clean-state tests for all public claims, or remove unsupported copy.
2. Ship the CLI's bundled example and `demo`/`--demo` command plus a real-binary terminal recording.
3. Build the labelled, isolated direct demo route and designed 404 page.
4. Complete metadata, plain-words/copy audit, and the shared legal-page header.

## Re-run

```sh
npm ci
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
cargo fmt --check
npm test
npm run verify:deployment
cargo package --locked
npm run test:e2e -- https://log-scrub-contract.sociobot.in/
npm run verify:live-headers
```
