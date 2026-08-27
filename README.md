# Log Scrub Contract

Prove that logs are safe **before** a drain, support bundle, or CI artifact
leaves your environment. `log-scrub` applies path, linear-time regex, and
runtime token rules to JSON, JSONL, or text fixtures, then fails if deny
assertions or high-entropy values remain.

Everything runs locally. Fixtures, tokens, and reports are never uploaded and
there is no telemetry. This is a regression guard, not a compliance
certification.

## Install

Requires Rust 1.85 or newer:

```sh
cargo install --path .
log-scrub --help
```

The publish-ready crate starts at `0.1.0`; registry publishing is handled by
the Param Factory, not from this repository.

## Usage

Create a starter policy and fixtures:

```sh
log-scrub init
```

Check every supported fixture in a directory. Exit `0` means the sanitized
output satisfies the contract, `1` means a possible leak remains, and `2`
means the command, policy, or input is invalid.

```sh
export DEMO_API_TOKEN='replace-with-a-real-test-token'
log-scrub check --config log-scrub.json fixtures/
log-scrub check --config log-scrub.json --json fixtures/ > report.json
log-scrub check --config log-scrub.json --report scrub-report.md fixtures/
```

Redact a stream or file for a downstream command:

```sh
log-scrub redact --config log-scrub.json app.jsonl > app.scrubbed.jsonl
cat app.log | log-scrub redact --config log-scrub.json -
```

If any assertion or entropy check still fails, `redact` writes no payload at
all and exits `1`. Failed JSON and Markdown reports likewise withhold the
payload, so a diagnostic artifact cannot become the leak it caught.

Runtime token values can come from the policy's environment variable or an
explicit `--token NAME=VALUE`. Values are never printed in diagnostics:

```sh
log-scrub check --config log-scrub.json \
  --token support_key="$SUPPORT_KEY" fixtures/
```

### Policy format

```json
{
  "version": 1,
  "rules": [
    { "id": "authorization", "kind": "path", "path": "request.headers.authorization" },
    { "id": "emails", "kind": "regex", "pattern": "(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}" },
    { "id": "support-key", "kind": "token", "name": "support_key", "env": "SUPPORT_KEY" }
  ],
  "assertions": [
    { "id": "no-bearer-token", "kind": "deny_regex", "pattern": "(?i)bearer\\s+[a-z0-9._-]{12,}" }
  ],
  "entropy": {
    "enabled": true,
    "min_length": 24,
    "threshold": 4.2,
    "allow": ["^[0-9a-f]{40}$"]
  }
}
```

Path segments use dots. `*` matches every object value or array item and a
numeric segment selects an array index, for example `events.*.user.email`.
Every redaction replaces the entire matched value with an opaque marker such
as `[REDACTED:authorization]`; partial or reversible masking is not supported.
Rust's `regex` engine rejects unsupported look-around/backreferences and
guarantees linear-time matching, avoiding catastrophic backtracking.

Entropy checks inspect token-like runs after redaction. Tune them with known
non-secret allow patterns; a high-entropy finding is evidence to investigate,
not proof that a value is a secret.

## CI

```yaml
- name: Verify log scrubbing contract
  run: cargo run --locked -- check --config log-scrub.json fixtures/
  env:
    SUPPORT_KEY: ${{ secrets.SUPPORT_KEY }}
```

Commit representative fixtures for every production drain. Use fake but
realistically shaped secrets—never copy live credentials into source control.

## Develop and verify

```sh
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
cargo package --locked
npm install
npm test
npm run build          # CLI release build + site -> dist/site
npm run dev            # local documentation site
```

The static site is Vite + TypeScript and includes an offline, in-browser demo.
Its payload never leaves the tab. The optional Team Pack uses the registered
Dodo Live checkout at Sociobot; a returned `license` parameter is removed from
the address bar before use and service-worker caches never store token-bearing
URLs or entitlement responses. Production deployment serves `dist/site` as
standard static docs, including the `_headers` cache and browser-security
policy.

## Project scope

Log Scrub Contract is for developers who own log drains and support export
paths. It does not collect logs, crawl a repository for secrets, replace a
runtime logger, upload samples, or certify compliance.

See [CHANGELOG.md](CHANGELOG.md), [privacy](site/privacy/index.html), and
[terms](site/terms/index.html). Licensed under the [MIT License](LICENSE).
