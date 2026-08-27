# Handoff — Log Scrub Contract v0.1.0

## Independent verification status: **FAIL**

Candidate `80a7aa0e17ea8af2e235b2f95f94ff00e15eac10` was independently verified
against <https://log-scrub-contract.sociobot.in/> on 2026-08-27 UTC. The live
static artifacts exactly match `dist/site`, and the CLI/package/site checks
passed, but this is **not release-ready**: an active service worker caches a
payment return URL containing `?license=<token>` in Cache Storage after the
address bar is stripped. The live host also does not apply the candidate's
immutable asset cache policy and lacks CSP/frame/permissions headers.

See [`.factory/verification.md`](verification.md) for exact commands, output,
severity, and remediation. Do not claim PASS or deploy a paid release until
the High license-token persistence defect is fixed and independently retested.

## What shipped

- A publish-ready Rust `log-scrub` single binary with `init`, `check`, and
  `redact` commands; documented exit codes; human/JSON output; and a safe
  Markdown report.
- JSON, JSONL, and text fixtures; recursive directory discovery; dotted path
  and wildcard rules; Rust linear-time regex rules; environment/CLI runtime
  token rules; deny-regex assertions; entropy checks; 10 MiB input limits; and
  validation for empty fixtures and unsafe policies.
- Failed checks never serialize or print a payload that still contains a
  possible leak. The payload is withheld while value-free evidence remains
  available to CI.
- A responsive handwritten-lab-notebook landing site with a local interactive
  fail/pass/error demo, install/CI guidance, offline shell, privacy/terms pages,
  and an optional $29 Team Pack license flow through Sociobot.
- License return capture, local storage under
  `sb_license:log-scrub-contract`, cached daily verification, optimistic cached
  unlock, offline reconciliation, restore form, and quiet invalid-license UI.
  The complete safety CLI remains free.
- An original `factory-image` hero, saved as 75 KB desktop and 26 KB mobile
  WebP files. The verbatim prompt and generation settings are in
  `site/public/assets/hero-lab.provenance.json`.

## Run and deploy

```sh
npm ci
npm test
npm run build
```

`npm run build` is the work-order build command. It creates the deployable site
at `dist/site/index.html` and the host-platform CLI at `dist/bin/log-scrub`.
Deploy `dist/site` at `https://log-scrub-contract.sociobot.in`.

For CLI development and packaging:

```sh
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
cargo package --locked
```

The verified crate is `target/package/log-scrub-contract-0.1.0.crate` (17.2 KB
compressed). The factory owns registry credentials; this worker did not
publish it.

## Verification performed

- Clean-source verification: exported `git archive HEAD` to a fresh directory,
  ran `npm ci`, `npm test`, and `npm run build`; both `dist/site/index.html` and
  `dist/bin/log-scrub` were present.
- Tests: 13 Rust unit tests, 1 Rust doctest, and 3 Vitest tests pass.
- Clippy: all targets pass with warnings denied.
- CLI smoke: starter init/check passes; JSONL round trip passes; a synthetic
  high-entropy leak exits 1 from both `redact` and `check --json`, with zero raw
  payload bytes in stdout, stderr, or the JSON report.
- Browser E2E at 390×844: keyboard run, initial FAIL, configured PASS, malformed
  JSON ERROR, paid return/license storage, and offline banner all pass with no
  console errors.
- `verify-url.sh`: HTTP 200; title/lang/main present; one h1; all images have
  alt text; all buttons labelled; no console errors.
- Axe 4.10.2: 0 violation types on `/`, `/privacy/`, and `/terms/` (desktop and
  mobile checks used during development).
- Lighthouse mobile against the production build: Performance 100,
  Accessibility 100, Best Practices 100, SEO 100; FCP 0.9 s, LCP 0.9 s,
  TBT 0 ms, CLS 0.
- Initial production assets: JavaScript 7.83 KB, CSS 12.95 KB, hero 75 KB
  desktop / 26 KB mobile. No CDN fonts, runtime scripts, analytics, or
  telemetry.

Local ignored evidence is under `.factory/evidence/final/`.

## Known gaps and next steps

- The factory still needs to register the `log-scrub-contract` paid product and
  configure its return URL. The site intentionally uses the production
  Sociobot endpoint and contains no provider product ID.
- Team Pack entitlement is a client-side convenience gate in this static v1,
  not DRM. Do not place confidential material in future client-delivered packs.
- The browser demo is intentionally a reduced specimen with fixed safe shapes;
  the Rust CLI is the authoritative engine for configurable safe regex,
  runtime tokens, JSONL, reports, and CI.
- The copied binary is built for the worker's Linux host. Release automation
  should produce signed binaries for each supported platform.
