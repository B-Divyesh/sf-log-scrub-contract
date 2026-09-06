# Demo sandbox

## Browser demo

Open <https://log-scrub-contract.sociobot.in/demo/> or run the local site and
open `/demo/`. The page immediately evaluates a realistic support-log sample:
an email, an authorization header, and a high-entropy session value. The
output is populated with opaque markers and a passing result.

The persistent banner says **“Demo — sample data, nothing is saved to your
real data”**. **Reset demo** restores the shipped fixture and path rules.
**Start for real** removes the demo-only values and goes to the landing page.

The demo uses only `localStorage` keys prefixed
`demo:log-scrub-contract:`. It never reads or writes non-demo product data.
The worker precaches `/demo/`, so the direct demo reloads offline after the
first online visit. The demo sends no fixture request away from the site.

## CLI demo

Run `log-scrub demo`. It writes the bundled files from `examples/demo/` to a
new temporary directory, runs the same contract, writes `scrub-report.md`,
and prints the directory path. Use `log-scrub demo --output NEW_DIRECTORY` to
choose an empty output directory. It never modifies project fixtures.
