# Independent verification 2 — FAIL

**Work order:** `log-scrub-contract-verify-2`  
**Candidate:** `08d3c0b6adba7cb0d6be0636dc4a11fb86861f53` (`08d3c0b`)  
**Live URL:** <https://log-scrub-contract.sociobot.in/>  
**Verified:** 2026-08-27 UTC

## Verdict

**FAIL — deployment configuration required.** The candidate fully implements
the local redaction-contract job and the previous license-token Cache Storage
defect is fixed. The public deployment serves byte-identical candidate files,
including the repaired worker and `_headers` file, but the host does not apply
the declared browser-security or immutable-cache headers. It therefore fails
the production response-policy and caching acceptance requirements.

## Release-blocking deployment defects

### Medium — declared browser containment policy is absent on the live host

`dist/site/_headers` declares a restrictive CSP, `frame-ancestors 'none'`,
`X-Frame-Options: DENY`, and a deny-by-default `Permissions-Policy`. Fresh
`curl -I` checks of `/` and `/sw.js` found none of `Content-Security-Policy`,
`Permissions-Policy`, or `X-Frame-Options`. The host does provide HSTS,
`Referrer-Policy: strict-origin-when-cross-origin`, and
`X-Content-Type-Options: nosniff`, but `X-XSS-Protection` is not a CSP
substitute. Configure the static host to honor `_headers` (or its equivalent)
before release.

### Medium — content-hashed assets are not immutable in production

The candidate correctly declares one-year immutable caching for `/assets/*.js`
and `/assets/*.css`. Live `/assets/main-Bygm84Sp.js` and
`/assets/style-DWiDjS8b.css` instead both return:

```
Cache-Control: public, must-revalidate, max-age=30
```

The same short policy is returned for `/` and `/sw.js`. Apply the candidate's
document/worker `no-cache` and hashed-asset `public, max-age=31536000,
immutable` rules at the deployment layer.

No Critical or High defects were found.

## Clean-checkout quality gates

An isolated clone of `origin/main` was detached at the exact candidate and was
clean before dependency installation.

| Check | Result |
|---|---|
| `npm ci` | PASS; 59 packages audited, 0 vulnerabilities |
| `cargo test --locked` | PASS; 13 unit tests and 1 doctest |
| `cargo clippy --locked --all-targets -- -D warnings` | PASS |
| `npm test` | PASS; Rust suite plus 3 Vitest tests |
| `npm run build` | PASS; release CLI and `dist/site` produced |
| `cargo package --locked` | PASS; 9-file, 63.4 KiB crate (17.4 KiB compressed) verified by Cargo |
| Clean consumer | PASS; unpacked `.crate` installed with `cargo install --path … --locked` and the installed binary exercised |

The production initial JavaScript is 7,943 bytes (3.58 kB gzip), CSS 12,952
bytes (3.69 kB gzip), and mobile hero 26,474 bytes; all are within the stated
200 kB JS, 50 kB CSS, and 300 kB mobile-image budgets. The complete static
output is 147,245 bytes. A fresh Lighthouse 13.4.1 attempt could not produce a
score: no system Chrome was installed, and the Playwright Chromium supplied via
`CHROME_PATH` crashed its tab. Browser functional and axe checks below passed;
no score is claimed.

## CLI and package end-to-end evidence

The packed crate was extracted into a fresh consumer directory and installed
under a clean `CARGO_INSTALL_ROOT`.

- `log-scrub --help` documented `check`, `redact`, `init`, exit behavior, and
  local-only processing.
- `init` then `check --json` on its generated JSON fixture passed with two
  redactions and zero violations; the output contained irreversible markers.
- A text fixture containing a residual bearer secret made `redact --json` exit
  **1**, return `output_withheld: true`, and emit neither the synthetic bearer
  value nor its token fragment in stdout/stderr.
- Invalid JSON exited **2** with an actionable parse error and no stdout;
  repeat `init` exited **2** with its `--force` recovery instruction, while
  `init --force` succeeded.
- An 11 MiB fixture exited **2** at the documented 10 MiB safety boundary and
  produced zero stdout bytes.

## Browser, PWA, privacy, and accessibility evidence

- The supplied mobile E2E passed against a local production-equivalent build:
  keyboard shortcut, FAIL → PASS → malformed-input ERROR recovery, checkout
  return stripping, live Sociobot verification routing, offline status, and
  Cache Storage inspection.
- A fresh controlled service-worker probe installed v2, served an update with
  cache name v3, observed v3 activation after `registration.update()`, then
  offline-reloaded successfully with the site `h1` present.
- The historical v1 cache seeded with a URL and response body containing a
  synthetic license token was removed by the current worker. After a new
  `?license=` return and entitlement request, every Cache Storage request key
  and response body was inspected: no token bytes remained.
- Axe at 390 px found **0 violation types and 0 serious/critical findings** on
  local `/`, `/privacy/`, and `/terms/`, and independently on the same three
  live URLs.
- Live desktop (1440 px) and mobile (390 px) checks found `lang=en`, a title,
  exactly one `h1`, exactly one `main`, no missing image alt text, no horizontal
  overflow, no visible interactive target under 44 px, and no console or page
  errors. Keyboard Tab focused the skip link with a visible
  `rgb(166, 61, 47) solid 3px` outline. Reduced motion resolved button
  transition duration to `1e-05s` and transform to `none`.
- A normal live load made no cross-origin runtime request. Static inspection
  found no analytics, tracking, CDN fonts, or third-party scripts. The only
  runtime external endpoint is the documented, user-initiated Sociobot license
  verification route; CLI fixtures stay local.

## Live candidate identity

All 13 static files in `dist/site` were fetched from the live origin and
SHA-256 compared, including `index.html`, legal pages, worker, binary-linked
assets, images, and `_headers`: **13/13 matched**. The running site therefore
is the candidate artifact; the two failures are confirmed host behavior, not
an artifact propagation lag.

## Recommendation

Do not release until the static hosting configuration applies the checked-in
header policy. Re-run the live header checks after that change; no product-code
change is indicated by this verification.
