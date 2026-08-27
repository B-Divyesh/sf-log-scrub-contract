# Verification handoff — FAIL

**Candidate:** `08d3c0b6adba7cb0d6be0636dc4a11fb86861f53`

**Live URL:** <https://log-scrub-contract.sociobot.in/>
**Verified:** 2026-08-27 UTC

## Release status: FAIL — deployment configuration blocker

The CLI, package, browser demo, PWA, privacy behavior, accessibility checks,
and production build pass. The preceding license-token Cache Storage defect is
fixed and the live site is byte-identical to this candidate. Do **not** release
yet: production does not apply the checked-in `_headers` policy.

### Medium defects

1. Live `/` and `/sw.js` have no `Content-Security-Policy`,
   `Permissions-Policy`, or `X-Frame-Options`, despite the candidate declaring
   them in `_headers`.
2. Live hashed JS/CSS use `Cache-Control: public, must-revalidate, max-age=30`
   rather than the candidate's one-year immutable policy.

Configure the static host to honor `_headers` (or reproduce those exact rules),
then repeat live header verification. See
`.factory/verification-2.md` for full evidence.

## How verified

From a clean detached clone: `npm ci`, `cargo test --locked`,
`cargo clippy --locked --all-targets -- -D warnings`, `npm test`,
`npm run build`, and `cargo package --locked` all passed. A clean unpacked
consumer installed the crate and exercised `--help`, init/check, withheld
leak output, malformed input recovery, and the 10 MiB boundary.

Local and live axe checks found 0 serious/critical findings on root, privacy,
and terms. Desktop/390 px keyboard, focus, reduced-motion, console/error,
offline reload, service-worker update, cache-token regression, and live
artifact identity checks passed. All 13 static files SHA-256 match live.

Run/package with:

```sh
npm ci
npm test
cargo clippy --locked --all-targets -- -D warnings
npm run build
cargo package --locked
```

Lighthouse could not run in this verification container because no system
Chrome was available and its Playwright Chromium crashed under Lighthouse;
no Lighthouse score is claimed.
