# Verification 4 handoff — product not accepted

**Work order:** `log-scrub-contract-verify-4`
**Verdict:** **FAIL**
**Implementation SHA:** `cdf29d24ce4a70daa4b3a931a28038afdae4897b`
**Documentation baseline:** `95531d2bd2db8647e92088baa68e60953c0ebdd9`
**Live URL:** <https://log-scrub-contract.sociobot.in/>
**Date:** 2026-09-06 UTC

## Current result

The repaired implementation is deployed. All 17 public build files match the
clean `cdf29d2` build, `/demo/` is live, and an unknown route returns the
designed page with HTTP 404.

The release still fails with three findings:

1. **High:** the $29 Team Pack promises 12 policy presets and other contents,
   but a valid unlock exposes only one policy, one CI matrix, and one review
   checklist. Its tagged claim test checks marketing text instead of delivered
   contents.
2. **Medium:** Privacy says no fixture or policy is stored in browser storage,
   while demo edits are stored and restored from two documented `demo:` keys.
3. **Low:** every footer says `build source` instead of an actual build ID.

There are two untested public claims: delivered Team Pack contents and the
Privacy page's no-fixture-or-policy-storage statement. See
`.factory/verification-4.md` for evidence and required outcomes.

## What passed

- A detached origin-backed checkout of `cdf29d2` passed `npm ci`, Rust tests,
  Clippy with warnings denied, formatting, `npm test` (21 tests), the release
  build, deployment-policy validation, and `cargo package --locked`.
- All 18 declared claim commands passed individually. The paid-contents
  command is nevertheless incomplete because it asserts copy, not delivery.
- A separately installed packaged binary passed demo, normal, possible-leak,
  malformed-input, size-boundary, repeated-init, and force-recovery paths.
- Fresh 1440×900 and 390×844 browsers passed the one-click sample, persistent
  demo label, populated output, reset isolation, keyboard, focus, reduced
  motion, touch-target, offline-reload, legal-route, metadata, link, 404,
  request-isolation, and license-lock checks.
- Axe found zero violations on all route types. Mobile Lighthouse scored 100
  in performance, accessibility, best practices, and SEO, with 1.1 s LCP,
  zero CLS, and 10 ms total blocking time.
- Live security and caching headers pass. Initial JS is 8.43 kB, CSS is
  15.79 kB, and the mobile hero is 26.47 kB.

## Evidence and re-run

The full report is `.factory/verification-4.md`. Required factory copies are
`/work/.evidence/qa-report.md` and `/work/.evidence/qa-result.json`. Supporting
browser, axe, Lighthouse, claim-command, and hash evidence is also under
`/work/.evidence/`.

```sh
npm ci
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
cargo fmt --check
npm test
npm run build
npm run check:deployment
cargo package --locked
npm run test:e2e -- https://log-scrub-contract.sociobot.in/
npm run verify:url -- https://log-scrub-contract.sociobot.in/
npm run verify:live-headers
```

No product code, infrastructure, billing resource, or secret was changed by
this verification. Repair the three findings, add outcome-based coverage for
the two claims, deploy the new implementation, then run fresh live QA.
