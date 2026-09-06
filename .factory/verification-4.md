# Verification 4 — test log redaction before sharing logs

**Work order:** `log-scrub-contract-verify-4`
**Verdict:** **FAIL**
**Findings:** **3** — 1 High, 1 Medium, 1 Low
**Untested public claims:** **2**
**Implementation reviewed:** `cdf29d24ce4a70daa4b3a931a28038afdae4897b`
**Documentation baseline:** `95531d2bd2db8647e92088baa68e60953c0ebdd9`
**Live URL:** <https://log-scrub-contract.sociobot.in/>
**Verified:** 2026-09-06 UTC

## Verdict

**FAIL.** The CLI, sample command, browser demo, accessibility, offline path,
metadata, 404 handling, and deployed artifact all work. All 18 declared claim
commands pass from a clean checkout. The product still cannot pass because one
paid claim is not delivered, the privacy page makes a false storage claim, and
the live footer does not show a real build identifier.

## Job, audience, and first action

Before scrolling, fresh desktop and phone browsers show:

- Job: **Test log redaction before sharing logs**.
- Audience: developers who forward structured logs and need proof that
  configured secrets are removed.
- First action: **Try it with sample data**. The adjacent text says it loads a
  safe support log in the demo.

The headline, audience sentence, action, and three facts fit within both the
1440×900 and 390×844 first screens. Screenshots are at
`/work/.evidence/desktop-first-screen.png` and
`/work/.evidence/phone-first-screen.png`.

## Findings

### V4-1 — High — the paid contents claim is not delivered or tested

The live page sells a **$29 once** Team Pack and lists **12 annotated policy
presets**, CI matrices, review and incident-response checklists, and future
template updates. A fresh browser with a mocked valid product verification
response unlocks only three copy actions:

1. one GitHub Actions matrix;
2. one support bundle policy;
3. one drain review checklist.

There are no other preset, checklist, download, or template assets in the
candidate. In particular, the unlocked product does not contain 12 policy
presets or an incident-response checklist.

The declared `@claim:team-pack-price` test is a false positive. It only asserts
that the price and two promised phrases appear in page text, plus the checkout
URL. It never unlocks the pack or inspects delivered contents. The separate
`@claim:templates-private` test confirms there are exactly three copy actions,
but checks only that their copied text excludes a license and fixture value.

Evidence: `/work/.evidence/team-pack-check.json` and
`site/src/claims.test.ts`. The fix must either deliver and test every listed
item or reduce the paid copy to the contents actually supplied.

### V4-2 — Medium — the privacy page gives false local-storage information

The live Privacy page says, **“No fixture or policy is stored there”** after
describing browser local storage. The live `/demo/` page stores the complete
edited fixture and path rules under:

- `demo:log-scrub-contract:fixture`
- `demo:log-scrub-contract:paths`

A fresh browser edit placed a unique fixture marker in the first key, and a
reload restored it. The separate namespace and Reset/Start for real clearing
behavior are appropriate, but the legal copy contradicts the product,
`.factory/demo.md`, and README. This public claim has no matching entry in
`.factory/claims.json`.

Evidence: `/work/.evidence/storage-claim.json`. The privacy page must disclose
the demo keys and retention/clearing behavior, and a tagged claim must verify
that disclosure, or the demo must stop persisting the values.

### V4-3 — Low — the footer does not contain a build identifier

Every live route shows `v0.1.0 · build source`. `source` does not identify the
deployed build. The Vite configuration uses `GITHUB_SHA` when present but falls
back to this literal value, and the legal and 404 pages hard-code it. This does
not meet the required footer build-id contract and makes field reports harder
to tie to a deployment.

The live bytes independently match `cdf29d2`, so this is a user-facing
traceability defect rather than deployment uncertainty. Build the footer with
the actual implementation SHA on every route.

## Declared claim commands

Each command in `.factory/claims.json` was run individually from a detached,
origin-backed clone of `cdf29d2`. The full output is at
`/work/.evidence/claim-commands.log`.

| Claim | Result |
| --- | --- |
| `regression-contract` | PASS |
| `local-no-upload` | PASS |
| `no-telemetry` | PASS |
| `irreversible-markers` | PASS |
| `path-rules` | PASS |
| `safe-regex` | PASS |
| `runtime-tokens` | PASS |
| `entropy` | PASS |
| `browser-tab` | PASS |
| `jsonl` | PASS |
| `private-reports` | PASS |
| `ci-exit-codes` | PASS |
| `offline-demo` | PASS |
| `license-cache` | PASS |
| `free-cli` | PASS |
| `team-pack-price` | **Command passes, promised outcome is not tested** |
| `license-lock` | PASS |
| `templates-private` | PASS |

There are two untested public claims: the delivered Team Pack contents and the
Privacy page's no-fixture-or-policy-storage statement. The first has an
incomplete tagged test; the second is absent from the registry. Both were
tested manually and disproved during this verification.

## Clean-checkout and consumer results

The clean checkout remained unchanged after all checks.

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 59 packages audited, 0 vulnerabilities |
| `cargo test --locked` | PASS — 13 unit tests and 1 doctest |
| `cargo clippy --locked --all-targets -- -D warnings` | PASS |
| `cargo fmt --check` | PASS |
| `npm test` | PASS — 21 tests, including all 18 tagged tests |
| `npm run build` | PASS — release CLI and `dist/site` produced |
| `npm run check:deployment` | PASS |
| `cargo package --locked` | PASS — 11 files, 68.1 KiB, 18.8 KiB compressed |

The packaged crate was extracted and installed into a separate consumer
prefix. The installed `log-scrub 0.1.0` binary, not the repository binary, was
exercised:

- `log-scrub demo` created an isolated sample directory and a populated
  privacy-safe Markdown report with two opaque redactions.
- A normal initialized fixture passed with exit 0.
- A residual bearer-shaped value exited 1 with `output_withheld: true`; the
  value was absent from stdout and stderr.
- Malformed JSON exited 2 with no stdout payload.
- A 10 MiB plus one byte fixture exited 2 with the documented safety-limit
  error and no stdout payload.
- Repeating `init` exited 2 with a clear `--force` instruction; `init --force`
  then exited 0.

## Live browser and deployment results

- The landing action opens `/demo/` in one click on desktop and phone. The
  direct demo starts in PASS with three opaque redactions and a realistic
  support log. The persistent demo label, Reset demo, and Start for real are
  present. Reset preserves an unrelated local-storage sentinel.
- The demo writes only its two prefixed local keys. Its fixture flow made no
  cross-origin request. After the first visit, a fresh live context reloaded
  `/demo/` offline and retained the populated PASS state.
- Keyboard traversal reaches the skip link, navigation, Reset demo, Start for
  real, both labelled editors, result, Run contract, and footer links. Each
  focus target has a 3 px oxide outline. Ctrl+Enter runs the contract. No
  keyboard trap was found.
- Reduced motion changes the primary control transition to `0.00001s` and
  removes its transform. All visible targets on all routes are at least 44 px.
  At 200% text size, content and controls remain available.
- Axe reports zero violation types on `/`, `/demo/`, `/privacy/`, `/terms/`,
  and the designed unknown-route 404 page. Desktop and phone checks found one
  `h1`, one `main`, `lang=en`, alt text, header, footer, skip link, no normal
  horizontal overflow, and no browser console or page errors.
- The unknown route returns HTTP 404 with the designed page and home/demo
  links. `/404.html` itself returns 200, which is expected.
- Route titles, descriptions, canonical URLs, Open Graph/Twitter tags,
  180×180 touch icon, and the 1200×630 social image are present. All internal
  and documented GitHub links returned 200.
- A live invalid-license request went only to the scoped Sociobot product
  verification endpoint, left the Team Pack locked, and produced no browser
  error. The mocked valid-return flow removes the license from the address bar,
  stores it under the product key, and leaves no token bytes in Cache Storage.
- All 17 publicly served build files match the clean `cdf29d2` build byte for
  byte. The host-consumed `staticwebapp.config.json` is verified by behavior:
  shell and worker use `no-cache`; hashed JS/CSS use one-year immutable cache;
  CSP, frame denial, permissions policy, referrer policy, and nosniff are live.
- Initial JavaScript is 8.43 kB (3.76 kB gzip), CSS is 15.79 kB (4.25 kB gzip),
  and the mobile hero is 26.47 kB. Mobile Lighthouse scored 100 for performance,
  accessibility, best practices, and SEO; LCP was 1.1 s, CLS 0, and total
  blocking time 10 ms. Evidence is in `/work/.evidence/lighthouse.json`.

This is a static site plus local CLI, so backend tenant isolation, server
restart persistence, health checks, SQLite state, and 429/Retry-After behavior
do not apply.

## Earlier findings

| Earlier finding | Current disposition |
| --- | --- |
| License token persisted in Cache Storage | Fixed. Tagged and live E2E scans find no token URL or response bytes. |
| Missing containment and immutable-cache headers | Fixed. Live response policy passes and matches the candidate configuration. |
| R1: no claims registry | Structurally fixed with 18 entries, but V4-1 and V4-2 show that coverage is still incomplete. |
| R2: no CLI demo or shipped sample | Fixed. The packaged `demo` command and both sample files work in a clean consumer install. |
| R3: no labelled browser sandbox | Fixed. Direct `/demo/`, separate keys, reset, exit, and real-data sentinel checks pass. |
| R4: missing demo and designed 404 | Fixed on the live host. |
| R5: incomplete metadata | Fixed on all routes. |
| R6: missing audience and metaphor headings | Fixed. The first screen and copy audit meet the plain-words limits. |
| R7: legal routes omitted the standard header | Fixed on Privacy and Terms. |

`0534bb6` and `95531d2` are report-only commits. The implementation reviewed
and matched to the live host remains `cdf29d2`.

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
npm run verify:url -- https://log-scrub-contract.sociobot.in/
npm run verify:live-headers
node scripts/a11y.mjs https://log-scrub-contract.sociobot.in/demo/ /tmp/demo-axe.json
```
