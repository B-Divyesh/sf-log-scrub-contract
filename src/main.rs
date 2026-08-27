use clap::{Args, Parser, Subcommand, ValueEnum};
use log_scrub_contract::{Contract, ScrubResult};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

const MAX_INPUT_BYTES: u64 = 10 * 1024 * 1024;
const STARTER_POLICY: &str = r#"{
  "version": 1,
  "rules": [
    { "id": "authorization", "kind": "path", "path": "request.headers.authorization" },
    { "id": "email", "kind": "regex", "pattern": "(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}" },
    { "id": "demo-key", "kind": "regex", "pattern": "demo_sk_[A-Za-z0-9_-]{12,}" },
    { "id": "runtime-token", "kind": "token", "name": "demo_api_token", "env": "DEMO_API_TOKEN", "required": false }
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
"#;
const STARTER_FIXTURE: &str = r#"{
  "level": "info",
  "message": "Support request from ada@example.test",
  "request": {
    "path": "/account",
    "headers": { "authorization": "Bearer demo_sk_A1b2C3d4E5f6G7h8" }
  }
}
"#;

#[derive(Parser)]
#[command(
    name = "log-scrub",
    version,
    about = "Prove logs are scrubbed before they leave your environment",
    long_about = "Apply a local redaction policy to JSON, JSONL, and text fixtures, then fail if deny assertions or high-entropy values remain. No fixture or token ever leaves this process."
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Check sanitized fixtures and gate CI (exit 0 safe, 1 leak, 2 error)
    Check(CheckArgs),
    /// Emit sanitized content to stdout or a file
    Redact(RedactArgs),
    /// Write a starter log-scrub.json and fixture
    Init(InitArgs),
}

#[derive(Args)]
struct PolicyArgs {
    /// JSON policy file
    #[arg(short, long, default_value = "log-scrub.json")]
    config: PathBuf,
    /// Runtime secret to redact, as NAME=VALUE (repeatable)
    #[arg(long, value_name = "NAME=VALUE")]
    token: Vec<String>,
}

#[derive(Args)]
struct CheckArgs {
    #[command(flatten)]
    policy: PolicyArgs,
    /// Emit a stable machine-readable report to stdout
    #[arg(long)]
    json: bool,
    /// Write a privacy-safe Markdown before/after report
    #[arg(long, value_name = "FILE")]
    report: Option<PathBuf>,
    /// Fixture files or directories (directories are walked recursively)
    #[arg(required = true)]
    inputs: Vec<PathBuf>,
}

#[derive(Args)]
struct RedactArgs {
    #[command(flatten)]
    policy: PolicyArgs,
    /// Input file, or - for stdin
    #[arg(default_value = "-")]
    input: PathBuf,
    /// Input format (auto detects JSON files and a single JSON stdin value)
    #[arg(long, value_enum, default_value_t = InputFormat::Auto)]
    format: InputFormat,
    /// Write sanitized content to this file instead of stdout
    #[arg(short, long)]
    output: Option<PathBuf>,
    /// Wrap sanitized output and evidence in JSON
    #[arg(long)]
    json: bool,
}

#[derive(Clone, Copy, ValueEnum)]
enum InputFormat {
    Auto,
    Json,
    Jsonl,
    Text,
}

#[derive(Args)]
struct InitArgs {
    /// Directory in which to create the starter files
    #[arg(default_value = ".")]
    directory: PathBuf,
    /// Replace starter files if they already exist
    #[arg(long)]
    force: bool,
}

#[derive(Serialize)]
struct CheckReport {
    schema_version: u8,
    ok: bool,
    files: Vec<FileReport>,
    summary: Summary,
}

#[derive(Serialize)]
struct FileReport {
    path: String,
    format: &'static str,
    ok: bool,
    hits: Vec<log_scrub_contract::Hit>,
    violations: Vec<log_scrub_contract::Violation>,
    sanitized: String,
}

#[derive(Serialize)]
struct Summary {
    files: usize,
    redactions: usize,
    violations: usize,
}

fn main() {
    let code = match run() {
        Ok(code) => code,
        Err(error) => {
            eprintln!("log-scrub: {error}");
            2
        }
    };
    std::process::exit(code);
}

fn run() -> Result<i32, String> {
    let cli = Cli::parse();
    match cli.command {
        Command::Check(args) => check(args),
        Command::Redact(args) => redact(args),
        Command::Init(args) => init(args),
    }
}

fn load_contract(args: &PolicyArgs) -> Result<Contract, String> {
    let policy = fs::read_to_string(&args.config)
        .map_err(|error| format!("cannot read policy {}: {error}", args.config.display()))?;
    let tokens = parse_tokens(&args.token)?;
    Contract::from_json(&policy, &tokens).map_err(|error| error.to_string())
}

fn parse_tokens(values: &[String]) -> Result<HashMap<String, String>, String> {
    let mut tokens = HashMap::new();
    for item in values {
        let Some((name, value)) = item.split_once('=') else {
            return Err("--token must be NAME=VALUE".to_owned());
        };
        if name.is_empty() || value.is_empty() {
            return Err("--token name and value must not be empty".to_owned());
        }
        if tokens.insert(name.to_owned(), value.to_owned()).is_some() {
            return Err(format!("duplicate --token name '{name}'"));
        }
    }
    Ok(tokens)
}

fn check(args: CheckArgs) -> Result<i32, String> {
    let contract = load_contract(&args.policy)?;
    let paths = discover_inputs(&args.inputs)?;
    if paths.is_empty() {
        return Err("no supported fixtures found (.json, .jsonl, .log, .txt)".to_owned());
    }
    let mut files = Vec::new();
    for path in paths {
        let content = read_file(&path)?;
        if content.trim().is_empty() {
            return Err(format!("fixture is empty: {}", path.display()));
        }
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        if extension.eq_ignore_ascii_case("jsonl") {
            let mut sanitized = Vec::new();
            let mut hits = Vec::new();
            let mut violations = Vec::new();
            for (index, line) in content.lines().enumerate() {
                if line.trim().is_empty() {
                    continue;
                }
                let result = contract
                    .scrub_json(line)
                    .map_err(|error| format!("{} line {}: {error}", path.display(), index + 1))?;
                sanitized.push(compact_json(&result.content)?);
                hits.extend(result.hits);
                violations.extend(result.violations);
            }
            files.push(FileReport {
                path: path.display().to_string(),
                format: "jsonl",
                ok: violations.is_empty(),
                hits,
                violations,
                sanitized: sanitized.join("\n"),
            });
        } else {
            let (format, result) = scrub_by_format(&contract, &content, extension)?;
            files.push(to_file_report(&path, format, result));
        }
    }
    let report = assemble_report(files);
    if let Some(path) = &args.report {
        fs::write(path, markdown_report(&report))
            .map_err(|error| format!("cannot write report {}: {error}", path.display()))?;
    }
    if args.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&report)
                .map_err(|error| format!("cannot serialize report: {error}"))?
        );
    } else {
        print_human_report(&report, args.report.as_deref());
    }
    Ok(if report.ok { 0 } else { 1 })
}

fn redact(args: RedactArgs) -> Result<i32, String> {
    let contract = load_contract(&args.policy)?;
    let (content, extension) = if args.input.as_os_str() == "-" {
        let mut input = String::new();
        io::stdin()
            .take(MAX_INPUT_BYTES + 1)
            .read_to_string(&mut input)
            .map_err(|error| format!("cannot read stdin: {error}"))?;
        if input.len() as u64 > MAX_INPUT_BYTES {
            return Err("stdin exceeds the 10 MiB safety limit".to_owned());
        }
        (input, "")
    } else {
        let content = read_file(&args.input)?;
        let extension = args
            .input
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        (content, extension)
    };
    let result = match args.format {
        InputFormat::Json => contract
            .scrub_json(&content)
            .map_err(|error| error.to_string())?,
        InputFormat::Jsonl => scrub_jsonl(&contract, &content, &args.input)?,
        InputFormat::Text => contract.scrub_text(&content),
        InputFormat::Auto if extension.eq_ignore_ascii_case("jsonl") => {
            scrub_jsonl(&contract, &content, &args.input)?
        }
        InputFormat::Auto => scrub_by_format(&contract, &content, extension)?.1,
    };
    let ok = result.ok();
    let output = if args.json {
        serde_json::to_string_pretty(&result)
            .map_err(|error| format!("cannot serialize result: {error}"))?
    } else {
        result.content
    };
    if let Some(path) = &args.output {
        fs::write(path, output)
            .map_err(|error| format!("cannot write output {}: {error}", path.display()))?;
    } else {
        println!("{output}");
    }
    Ok(if ok { 0 } else { 1 })
}

fn scrub_jsonl(contract: &Contract, content: &str, path: &Path) -> Result<ScrubResult, String> {
    let mut sanitized = Vec::new();
    let mut hits = Vec::new();
    let mut violations = Vec::new();
    for (index, line) in content.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let result = contract
            .scrub_json(line)
            .map_err(|error| format!("{} line {}: {error}", path.display(), index + 1))?;
        sanitized.push(compact_json(&result.content)?);
        hits.extend(result.hits);
        violations.extend(result.violations);
    }
    if sanitized.is_empty() {
        return Err(format!("{} contains no JSONL records", path.display()));
    }
    Ok(ScrubResult {
        content: sanitized.join("\n"),
        hits,
        violations,
    })
}

fn init(args: InitArgs) -> Result<i32, String> {
    let policy_path = args.directory.join("log-scrub.json");
    let fixture_dir = args.directory.join("fixtures");
    let fixture_path = fixture_dir.join("example.json");
    if !args.force && (policy_path.exists() || fixture_path.exists()) {
        return Err(format!(
            "starter files already exist in {}; pass --force to replace them",
            args.directory.display()
        ));
    }
    fs::create_dir_all(&fixture_dir)
        .map_err(|error| format!("cannot create {}: {error}", fixture_dir.display()))?;
    fs::write(&policy_path, STARTER_POLICY)
        .map_err(|error| format!("cannot write {}: {error}", policy_path.display()))?;
    fs::write(&fixture_path, STARTER_FIXTURE)
        .map_err(|error| format!("cannot write {}: {error}", fixture_path.display()))?;
    println!("Created {}", policy_path.display());
    println!("Created {}", fixture_path.display());
    println!(
        "Next: log-scrub check --config {} {}",
        policy_path.display(),
        fixture_dir.display()
    );
    Ok(0)
}

fn discover_inputs(inputs: &[PathBuf]) -> Result<Vec<PathBuf>, String> {
    let mut found = Vec::new();
    for input in inputs {
        if input.is_file() {
            found.push(input.clone());
        } else if input.is_dir() {
            walk(input, &mut found)?;
        } else {
            return Err(format!("input does not exist: {}", input.display()));
        }
    }
    found.sort();
    found.dedup();
    Ok(found)
}

fn walk(directory: &Path, found: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(directory)
        .map_err(|error| format!("cannot read directory {}: {error}", directory.display()))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("cannot read directory entry: {error}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("cannot inspect {}: {error}", path.display()))?;
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            walk(&path, found)?;
        } else if file_type.is_file() && supported(&path) {
            found.push(path);
        }
    }
    Ok(())
}

fn supported(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("json" | "jsonl" | "log" | "txt")
    )
}

fn read_file(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("cannot inspect {}: {error}", path.display()))?;
    if metadata.len() > MAX_INPUT_BYTES {
        return Err(format!(
            "{} exceeds the 10 MiB safety limit",
            path.display()
        ));
    }
    fs::read_to_string(path)
        .map_err(|error| format!("cannot read UTF-8 fixture {}: {error}", path.display()))
}

fn scrub_by_format(
    contract: &Contract,
    content: &str,
    extension: &str,
) -> Result<(&'static str, ScrubResult), String> {
    if extension.eq_ignore_ascii_case("json") {
        return contract
            .scrub_json(content)
            .map(|result| ("json", result))
            .map_err(|error| error.to_string());
    }
    if extension.eq_ignore_ascii_case("jsonl") {
        return Err("JSONL is only accepted as a file, not stdin".to_owned());
    }
    if extension.is_empty() && serde_json::from_str::<serde_json::Value>(content).is_ok() {
        return contract
            .scrub_json(content)
            .map(|result| ("json", result))
            .map_err(|error| error.to_string());
    }
    Ok(("text", contract.scrub_text(content)))
}

fn compact_json(pretty: &str) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(pretty).map_err(|error| format!("cannot compact JSON: {error}"))?;
    serde_json::to_string(&value).map_err(|error| format!("cannot compact JSON: {error}"))
}

fn to_file_report(path: &Path, format: &'static str, result: ScrubResult) -> FileReport {
    FileReport {
        path: path.display().to_string(),
        format,
        ok: result.ok(),
        hits: result.hits,
        violations: result.violations,
        sanitized: result.content,
    }
}

fn assemble_report(files: Vec<FileReport>) -> CheckReport {
    let redactions = files.iter().map(|file| file.hits.len()).sum();
    let violations = files.iter().map(|file| file.violations.len()).sum();
    CheckReport {
        schema_version: 1,
        ok: violations == 0,
        summary: Summary {
            files: files.len(),
            redactions,
            violations,
        },
        files,
    }
}

fn print_human_report(report: &CheckReport, markdown: Option<&Path>) {
    for file in &report.files {
        let state = if file.ok { "PASS" } else { "FAIL" };
        println!(
            "{state} {} — {} redaction(s), {} violation(s)",
            file.path,
            file.hits.len(),
            file.violations.len()
        );
        for violation in &file.violations {
            println!(
                "  ! {} at {} {}",
                violation.check, violation.location, violation.evidence
            );
        }
    }
    println!(
        "{}: {} file(s), {} redaction(s), {} violation(s)",
        if report.ok {
            "Contract passed"
        } else {
            "Contract failed"
        },
        report.summary.files,
        report.summary.redactions,
        report.summary.violations
    );
    if let Some(path) = markdown {
        println!("Report written to {}", path.display());
    }
}

fn markdown_report(report: &CheckReport) -> String {
    let mut output = format!(
        "# Log scrub report\n\n**{}** — {} files, {} redactions, {} possible leaks.\n\nRaw matched values are never included in this report. “Before” records only type/length; “After” is the irreversible marker.\n\n",
        if report.ok { "PASS" } else { "FAIL" },
        report.summary.files,
        report.summary.redactions,
        report.summary.violations
    );
    for file in &report.files {
        output.push_str(&format!(
            "## {} — {}\n\n",
            if file.ok { "PASS" } else { "FAIL" },
            file.path
        ));
        if file.hits.is_empty() {
            output.push_str("No redaction rules matched.\n\n");
        } else {
            output.push_str("| Rule | Location | Before | After |\n|---|---|---|---|\n");
            for hit in &file.hits {
                output.push_str(&format!(
                    "| {} | `{}` | {} | `{}` |\n",
                    hit.rule, hit.location, hit.before, hit.after
                ));
            }
            output.push('\n');
        }
        for violation in &file.violations {
            output.push_str(&format!(
                "- **Possible leak:** {} at `{}` {}\n",
                violation.check, violation.location, violation.evidence
            ));
        }
        if !file.violations.is_empty() {
            output.push('\n');
        }
        output.push_str(&format!(
            "### Sanitized output\n\n```{}\n{}\n```\n\n",
            file.format, file.sanitized
        ));
    }
    output.push_str(
        "---\n\nLog Scrub Contract is a regression guard, not a compliance certification.\n",
    );
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discovers_supported_files_without_following_other_types() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("nested")).unwrap();
        fs::write(root.path().join("one.json"), "{}").unwrap();
        fs::write(root.path().join("nested/two.log"), "hello").unwrap();
        fs::write(root.path().join("ignore.md"), "no").unwrap();
        let paths = discover_inputs(&[root.path().to_owned()]).unwrap();
        assert_eq!(paths.len(), 2);
    }

    #[test]
    fn token_parser_rejects_duplicates_and_malformed_values() {
        assert!(parse_tokens(&["missing".to_owned()]).is_err());
        assert!(parse_tokens(&["x=1".to_owned(), "x=2".to_owned()]).is_err());
    }

    #[test]
    fn starter_contract_passes_starter_fixture() {
        let contract = Contract::from_json(STARTER_POLICY, &HashMap::new()).unwrap();
        let result = contract.scrub_json(STARTER_FIXTURE).unwrap();
        assert!(result.ok(), "{:?}", result.violations);
        assert_eq!(result.hits.len(), 2);
    }

    #[test]
    fn markdown_report_never_contains_raw_match() {
        let contract = Contract::from_json(STARTER_POLICY, &HashMap::new()).unwrap();
        let result = contract.scrub_json(STARTER_FIXTURE).unwrap();
        let report = assemble_report(vec![to_file_report(
            Path::new("fixture.json"),
            "json",
            result,
        )]);
        let markdown = markdown_report(&report);
        assert!(!markdown.contains("ada@example.test"));
        assert!(!markdown.contains("demo_sk_A1"));
        assert!(markdown.contains("[REDACTED:email]"));
    }

    #[test]
    fn documented_policy_parses() {
        let policy = r#"{
          "version":1,
          "rules":[
            {"id":"authorization","kind":"path","path":"request.headers.authorization"},
            {"id":"emails","kind":"regex","pattern":"(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}"},
            {"id":"support-key","kind":"token","name":"support_key","env":"SUPPORT_KEY","required":false}
          ],
          "assertions":[{"id":"no-bearer-token","kind":"deny_regex","pattern":"(?i)bearer\\s+[a-z0-9._-]{12,}"}],
          "entropy":{"enabled":true,"min_length":24,"threshold":4.2,"allow":["^[0-9a-f]{40}$"]}
        }"#;
        assert!(Contract::from_json(policy, &HashMap::new()).is_ok());
    }

    #[test]
    fn jsonl_redaction_preserves_records() {
        let contract = Contract::from_json(STARTER_POLICY, &HashMap::new()).unwrap();
        let value: serde_json::Value = serde_json::from_str(STARTER_FIXTURE).unwrap();
        let line = serde_json::to_string(&value).unwrap();
        let input = format!("{line}\n{line}\n");
        let result = scrub_jsonl(&contract, &input, Path::new("fixture.jsonl")).unwrap();
        assert_eq!(result.content.lines().count(), 2);
        assert_eq!(result.hits.len(), 4);
        assert!(result.ok());
    }
}
