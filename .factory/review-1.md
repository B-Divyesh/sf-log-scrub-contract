# Review — test log redaction before it leaves

**Work order:** `log-scrub-contract-review-1`
**Reviewed:** 2026-09-05 UTC
**Live URL:** <https://log-scrub-contract.sociobot.in/>
**Implementation candidate:** `f1219aeb47d050626e08c8d3d6e34f1207298058`
**Documentation head:** `f3c10638261636dbc5d5ffea573e1857c67bf15f`

## Verdict: FAIL

**7 findings; 18 untested public claims.** This is not a release pass.

Before scrolling, the expected job is to prove that configured secret and personal-data rules remove sensitive values from representative logs before a drain or support bundle leaves a developer's environment. The intended audience is security-conscious developers who forward structured logs. On the live desktop and phone pages, the first primary action is **Install the CLI**; the one-click sample is the secondary **Try a fixture in this tab** link.

Fresh desktop (1440 × 900) and phone (390 × 844) contexts both loaded without console or page errors. The sample is realistic, resets to its initial fixture, and stores no editor data in local storage. With `session_material` added to the supplied path rules, it produces populated, opaque redacted output and a PASS. It does not, however, enter the required labelled demo sandbox.

## Findings

| ID | Severity | Finding | Evidence and required outcome |
| --- | --- | --- | --- |
| R1 | High | The required claims registry is absent. | `.factory/claims.json` does not exist, so there are no tagged claim commands to run from a clean checkout. The 18 distinct public claims listed below have no required `@claim:` test mapping. Add the registry and one clean-state observable test per claim, or remove each claim. |
| R2 | High | The shipped CLI has no required one-command demo. | `log-scrub --help` exposes only `check`, `redact`, and `init`; there is no `log-scrub demo` or `--demo`. The repository also has no shipped `examples/` fixture and the landing page has no self-hosted terminal recording of the real binary. Ship the bundled sample and command/recording required for a CLI product. |
| R3 | High | The browser sample is not the required persistent demo sandbox. | `?demo=1` only loads the ordinary landing page. Neither desktop nor phone contains “Demo — sample data, nothing is saved” or “Start for real.” The current Reset specimen control restores text but does not establish a separate demo namespace or labelled mode. Add a direct `/demo` or functioning `?demo=1` sandbox, persistent label, reset, and explicit exit-to-real control. |
| R4 | Medium | Required demo and 404 pages are missing. | Live `/demo`, `/404`, and an unknown route all return Azure's default `Azure Static Web Apps - 404: Not found` page. A 404 status is correct, but this is not a designed product 404 with a way back. Add the direct demo route and a styled 404 document/rewrite with product landmarks and a home link. |
| R5 | Medium | Required page metadata is incomplete. | The landing page has title, description, lang, and favicon, but no canonical link, Open Graph tags, Twitter card tags, or 180 px Apple touch icon. Add the missing product-specific metadata and asset. |
| R6 | Medium | The first screen does not name the audience, and plain-words proof is missing. | The hero says what the tool does but never says it is for developers forwarding logs. Several visible headings are mood/metaphor labels rather than section names, including “Live bench test,” “Introduce a leak. Watch the contract object.” and “A small contract at every exit.” `.factory/copy-audit.md` is also absent. Rewrite to name the job and audience in plain words, use descriptive section headings, and commit the required copy audit. |
| R7 | Low | Legal routes omit the standard site header. | `/privacy/` and `/terms/` have a main and footer but no consistent header containing the home wordmark, skip link, and navigation. Add the required shared header on every route. |

### Untested public claims (18)

No `.factory/claims.json` entry or tagged sandbox command covers these distinct visitor-facing claims: regression redaction contracts; local/no-upload processing; no telemetry; irreversible masking; path-rule scrubbing; linear-time safe regex; runtime tokens staying out of configuration; entropy detection; the browser sample running entirely in the tab; JSONL support; privacy-safe reports; CI exit-code behavior; offline demo operation; exclusion of license returns from Cache Storage; a fully functional free CLI; the $29 Team Pack and its listed contents; one-time purchase/refund behavior; and unlocked templates not containing the visitor's fixture data or license.

Some have incidental unit or E2E coverage, but the claims contract requires a listed, individually tagged observable test. They remain untested claims until that mapping exists and passes from a clean demo entry point.

## Checks that passed

- A fresh clean clone installed with `npm ci`; `cargo test --locked`, Clippy with warnings denied, `cargo fmt --check`, `npm test`, `npm run build`, `npm run check:deployment`, `npm run verify:deployment`, and `cargo package --locked` passed. The published commands do not declare any claim-specific test because the registry is missing.
- The live `npm run test:e2e -- https://log-scrub-contract.sociobot.in/` and `npm run verify:live-headers` passed from both the repository and clean checkout. All 12 public build artifacts hash-match the live origin.
- A packed crate was extracted and installed into an isolated consumer prefix. Its installed binary passed normal `init`/`check`, malformed JSON recovery, repeated-init and `--force` recovery, possible-leak output withholding, and the 10 MiB plus one byte boundary. The normal sample reported two redactions and zero violations; invalid, unsafe, and boundary paths exited 2, 1, and 2 respectively with zero stdout payload where required.
- Axe found zero violations (and zero serious/critical findings) on live `/`, `/privacy/`, and `/terms/` at desktop and phone sizes. These pages have one `h1` and one `main`; the live browser checks found no console/page errors. The supplied mobile E2E also passed keyboard, FAIL → PASS → ERROR recovery, offline state, license-return stripping, and Cache Storage token scanning.
- All site links returned 200 or were valid in-page anchors. The default 404 status itself is expected; R4 concerns the missing required designed page.

## Earlier findings and current disposition

| Earlier report | Earlier finding | Current evidence | Disposition |
| --- | --- | --- | --- |
| `verification.md` | License value could persist in Cache Storage. | The live E2E seeds the legacy case, follows a return flow, then scans Cache Storage keys and bodies; it passed with no token bytes. | Fixed and reverified. |
| `verification.md`, `verification-2.md` | Live containment headers and immutable hashed-asset cache policy were absent. | `npm run verify:live-headers` passed: CSP, permissions policy, frame denial, referrer policy, nosniff, shell/worker `no-cache`, and immutable CSS/JS caching are live. | Fixed and reverified. |
| `verification-3.md` | No Critical, High, Medium, or Low findings were recorded. | This review found the seven independent contract gaps above. | Superseded by this FAIL review. |

The last implementation-affecting commit is `f1219ae`; `3d77204` and `f3c1063` are documentation-only verification commits. The live byte comparison confirms the implementation output reviewed here is the one deployed.

## Re-run commands

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
node scripts/a11y.mjs https://log-scrub-contract.sociobot.in/ /tmp/live-axe.json
```
