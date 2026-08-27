# Independent verification 3 — PASS

**Work order:** `log-scrub-contract-verify-3`
**Candidate:** `3d77204c6d44683df41639b8109c9831b23425c2` (`3d77204c`)
**Live URL:** <https://log-scrub-contract.sociobot.in/>
**Verified:** 2026-08-27 UTC

## Verdict

**PASS.** This candidate satisfies the researched smallest useful product: a
local, CI-gateable redaction contract for JSON, JSONL, and text fixtures with
path, regex, runtime-token, and entropy rules; privacy-safe reports; and
useful exit codes. The previous deployment-only finding is resolved from fresh
evidence: the live host now applies the candidate's security and caching
policy. No release-blocking defects were found.

## Clean-checkout evidence

An isolated `git clone --no-local` of `origin` was detached at the exact
candidate, confirmed clean, then installed with `npm ci` (59 packages audited,
0 vulnerabilities).

| Check | Result |
|---|---|
| `cargo test --locked` | PASS — 13 unit tests and 1 doctest |
| `cargo clippy --locked --all-targets -- -D warnings` | PASS |
| `cargo fmt --check` | PASS |
| `npm test` | PASS — Rust suite plus 3 Vitest tests |
| `npm run build` | PASS — release CLI and `dist/site` created |
| `npm run check:deployment` | PASS — Azure config and two immutable hashed CSS/JS assets verified |
| `cargo package --locked` | PASS — 9 files, 63.8 KiB / 17.5 KiB compressed, Cargo verification passed |

There is no separate repository lint or TypeScript-check script; `npm run`
offers the checks above, and Rust linting is covered by Clippy with warnings
denied.

## CLI/package end-to-end evidence

The produced `.crate` was extracted into a separate consumer directory and
installed with `cargo install --path … --locked` into an isolated install
prefix. The installed public binary was then exercised, not the source-tree
binary.

- `log-scrub --help` documents the three commands, CI exit semantics, and
  local-only processing.
- `init`, followed by `check --json`, passed the starter JSON fixture with two
  opaque redactions and zero violations.
- Adding a JSONL fixture passed: two fixture files, four redactions, and zero
  violations.
- A residual synthetic bearer value made `redact --json` exit **1** with
  `{"ok":false,"output_withheld":true}`. Neither stdout nor stderr contained
  that synthetic secret.
- Invalid JSON exited **2** with the actionable parse error and no payload.
  Re-running `init` exited **2** with its `--force` recovery instruction;
  `init --force` exited **0**.
- A 10 MiB + 1 byte fixture exited **2** with the documented safety-limit
  message and no stdout payload.

The normal, malformed, recovery, boundary, and unsafe-output paths therefore
meet the CI-gating job described in the brief. Static inspection also confirms
the Rust `regex` engine (linear-time matching), opaque `[REDACTED:<rule>]`
markers rather than reversible masks, and no CLI network code.

## Browser/PWA/accessibility/privacy evidence

- The supplied Playwright E2E passed against both the local production build
  and the live URL at 390 px: keyboard `Ctrl/Cmd+Enter`, deliberate FAIL then
  PASS after adding a path rule, malformed-input ERROR recovery, checkout
  license stripping, verification flow, offline notice, and Cache Storage
  token-byte regression scan.
- A controlled production-build copy first installed worker cache v2, then
  served a v3 worker. `registration.update()` activated v3 and an offline
  reload still rendered the page `h1`, with no browser errors.
- Axe found **0 violation types; 0 serious/critical** findings at 390 px for
  local `/`, live `/`, live `/privacy/`, and live `/terms/`.
- Fresh Playwright desktop (1440 px) and mobile (390 px) live audits found
  `lang=en`, title, one `h1`, one `main`, image alt text, no horizontal
  overflow, and no visible interactive targets under 44 px. Keyboard Tab
  revealed the skip link with a visible 3 px oxide focus ring. Under
  `prefers-reduced-motion`, the primary-control transition was `1e-05s` and
  transform was `none`.
- The live functional checks and those audits recorded no console errors,
  page errors, or automatic cross-origin request on a normal page load.
  Source and request inspection found no analytics, telemetry, CDN fonts, or
  third-party runtime scripts. The only possible runtime cross-origin call is
  the documented user-supplied license verification to `api.sociobot.in`; the
  browser demo stays in memory and the CLI stays local.
- The optional license path stores only the token/verdict in local storage;
  checkout-return URLs and entitlement responses are excluded from Cache
  Storage. Privacy and terms pages are live and return 200.

## Production identity, policies, and performance

The fresh `dist/site` build was compared byte-for-byte with the live origin.
All **12/12 publicly served artifacts** matched SHA-256. The thirteenth build
file, `staticwebapp.config.json`, correctly returns 404 because Azure consumes
it as deployment configuration rather than serving it. Its asserted behavior
is present in live responses:

- `/` and `/sw.js`: `Cache-Control: no-cache`; exact restrictive CSP;
  `Permissions-Policy`; `X-Frame-Options: DENY`; `X-Content-Type-Options:
  nosniff`; and `Referrer-Policy: strict-origin-when-cross-origin`.
- `main-Bygm84Sp.js` and `style-DWiDjS8b.css`: exact
  `Cache-Control: public, max-age=31536000, immutable`.

Budgets pass: initial JS is 7,943 bytes (3,603 gzip) versus 200 KB; CSS is
12,952 bytes (3,681 gzip) versus 50 KB; mobile hero is 26,474 bytes versus
300 KB; complete static output is 147,471 bytes. No webfonts are shipped.

An attempted Lighthouse 13.0.1 mobile run could not yield a score in this
container: its launcher rejects the available Playwright Chromium as a system
Chrome and reports `Unable to connect to Chrome` even when pointed at a manual
DevTools instance. This is a measurement-environment limitation, not a product
failure; browser functional, axe, semantic, responsive, and payload-budget
checks above all passed. No Lighthouse score is claimed.

## Defects by severity

| Severity | Findings |
|---|---|
| Critical | None |
| High | None |
| Medium | None |
| Low | None |

## Re-run commands

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
npm run verify:live-headers
```
