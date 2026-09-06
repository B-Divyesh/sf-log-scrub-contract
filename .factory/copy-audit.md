# Landing-page copy audit

## First screen check

- **Job:** Test log redaction before sharing logs.
- **Audience:** Developers who forward structured logs.
- **First action:** Try it with sample data. It loads a safe support log in the demo.

## Sentence audit

Visitor-facing landing copy is listed below. Code, file paths, rule IDs, and
terminal transcripts are excluded because they are literal CLI input/output.
No sentence exceeds 22 words. No banned plain-words term appears.

| Location | Copy | Words | Result |
|---|---|---:|---|
| Offline notice | Offline: the demo still works locally. | 6 | Pass |
| Offline notice | License checks resume when you reconnect. | 6 | Pass |
| Hero | For developers who forward structured logs and need proof that configured secrets are removed. | 13 | Pass |
| Hero action | Loads a safe support log in the demo. | 9 | Pass |
| Fact | Runs on your machine. | 4 | Pass |
| Fact | Does not upload log fixtures. | 5 | Pass |
| Fact | Free CLI. | 2 | Pass |
| Fact | Team Pack: $29 once. | 4 | Pass |
| Hero caption | Opaque redactions and a checked report. | 6 | Pass |
| Recording | The same sample ships with the CLI and the website demo. | 11 | Pass |
| Recording | The command creates an isolated temporary folder and prints its report location. | 12 | Pass |
| Browser preview | This browser sample checks paths, emails, token shapes, and entropy. | 10 | Pass |
| Browser preview | It runs entirely in this tab. | 6 | Pass |
| Browser preview | Add `session_material` to make the sample pass. | 7 | Pass |
| Browser preview | The CLI adds JSONL, runtime tokens, configurable regex, reports, and CI exit codes. | 12 | Pass |
| Workflow | Use fake, realistically shaped examples for every production drain and support export. | 11 | Pass |
| Workflow | Target JSON paths, regex shapes, and tokens supplied only at runtime. | 11 | Pass |
| Workflow | Matches become opaque markers. | 4 | Pass |
| Workflow | Run the same fixtures in CI. | 6 | Pass |
| Workflow | A deny assertion or high-entropy remainder exits 1 before deploy. | 10 | Pass |
| Install | Exit 0 is a passing contract, 1 is a possible leak, and 2 is an invalid invocation, policy, or fixture. | 20 | Pass |
| Team Pack | Keep the complete CLI free. | 5 | Pass |
| Team Pack | The Team Pack adds templates for shared policy work. | 10 | Pass |
| Team Pack | One-time purchase. | 2 | Pass |
| Team Pack | Sociobot/Dodo is the merchant of record; refunds are handled there and revoke the license automatically. | 15 | Pass |
| License panel | The free CLI is fully functional. | 6 | Pass |
| Templates | Your templates are ready on this device. | 7 | Pass |
| Templates | They never contain your license or fixture data. | 8 | Pass |
| Scope | It does not collect logs, scan your repository, replace runtime redaction, or certify compliance. | 14 | Pass |
| Footer | Test redaction rules before logs leave your environment. | 8 | Pass |

## Terminology

| Concept | One term |
|---|---|
| Shipped try-out input | sample log |
| A representative file committed for CI | fixture |
| The JSON/text matching configuration | policy |
| A value replaced by the tool | redaction marker |
| A possible remaining sensitive value | possible leak |
| The optional paid templates | Team Pack |
