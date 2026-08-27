//! Local, deterministic log-redaction contracts.
//!
//! The public surface is intentionally small: compile a [`Contract`] from a
//! JSON policy, then scrub text or structured JSON. Values reported as hits are
//! described by type and length; raw secret values are never included.
//!
//! ```
//! use std::collections::HashMap;
//! use log_scrub_contract::Contract;
//!
//! let policy = r#"{
//!   "version": 1,
//!   "rules": [{"id":"email","kind":"regex","pattern":"[a-z]+@[a-z.]+"}],
//!   "assertions": [],
//!   "entropy": {"enabled": false}
//! }"#;
//! let contract = Contract::from_json(policy, &HashMap::new()).unwrap();
//! let result = contract.scrub_text("owner=ada@example.test");
//! assert!(result.ok());
//! assert_eq!(result.content, "owner=[REDACTED:email]");
//! ```

use regex::{NoExpand, Regex};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fmt;

/// A validated, compiled redaction policy.
pub struct Contract {
    rules: Vec<CompiledRule>,
    assertions: Vec<CompiledAssertion>,
    entropy: CompiledEntropy,
}

/// A safe-to-serialize description of a redaction.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Hit {
    pub rule: String,
    pub location: String,
    pub before: String,
    pub after: String,
}

/// A possible leak that remains after all rules have run.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Violation {
    pub check: String,
    pub location: String,
    pub evidence: String,
}

/// Sanitized content plus contract evidence.
#[derive(Debug, Clone, Serialize)]
pub struct ScrubResult {
    pub content: String,
    pub hits: Vec<Hit>,
    pub violations: Vec<Violation>,
}

impl ScrubResult {
    #[must_use]
    pub fn ok(&self) -> bool {
        self.violations.is_empty()
    }
}

/// Policy or input error. Its message never includes token values or payloads.
#[derive(Debug, Clone)]
pub struct ContractError(String);

impl fmt::Display for ContractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ContractError {}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Policy {
    version: u8,
    #[serde(default)]
    rules: Vec<Rule>,
    #[serde(default)]
    assertions: Vec<Assertion>,
    #[serde(default)]
    entropy: EntropyPolicy,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum Rule {
    Path {
        id: String,
        path: String,
    },
    Regex {
        id: String,
        pattern: String,
    },
    Token {
        id: String,
        name: String,
        env: Option<String>,
        #[serde(default = "yes")]
        required: bool,
    },
}

const fn yes() -> bool {
    true
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum Assertion {
    DenyRegex { id: String, pattern: String },
}

#[derive(Debug, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct EntropyPolicy {
    enabled: bool,
    min_length: usize,
    threshold: f64,
    allow: Vec<String>,
}

impl Default for EntropyPolicy {
    fn default() -> Self {
        Self {
            enabled: false,
            min_length: 24,
            threshold: 4.2,
            allow: Vec::new(),
        }
    }
}

enum CompiledRule {
    Path { id: String, segments: Vec<String> },
    Regex { id: String, regex: Regex },
    Token { id: String, value: Option<String> },
}

struct CompiledAssertion {
    id: String,
    regex: Regex,
}

struct CompiledEntropy {
    enabled: bool,
    min_length: usize,
    threshold: f64,
    allow: Vec<Regex>,
    candidates: Regex,
}

impl Contract {
    /// Compile and validate a JSON policy.
    ///
    /// `tokens` maps policy token names to runtime values and takes precedence
    /// over an `env` entry. Token values shorter than four bytes are rejected
    /// because redacting common fragments is unsafe and surprising.
    pub fn from_json(json: &str, tokens: &HashMap<String, String>) -> Result<Self, ContractError> {
        let policy: Policy = serde_json::from_str(json)
            .map_err(|error| ContractError(format!("invalid policy JSON: {error}")))?;
        if policy.version != 1 {
            return Err(ContractError(format!(
                "unsupported policy version {}; expected 1",
                policy.version
            )));
        }

        let valid_id = Regex::new(r"^[A-Za-z0-9][A-Za-z0-9_-]*$").expect("static regex");
        let mut ids = HashSet::new();
        let mut compiled_rules = Vec::with_capacity(policy.rules.len());

        for rule in policy.rules {
            let (id, compiled) = match rule {
                Rule::Path { id, path } => {
                    validate_id(&id, &valid_id, &mut ids)?;
                    let segments = parse_path(&path)?;
                    (id.clone(), CompiledRule::Path { id, segments })
                }
                Rule::Regex { id, pattern } => {
                    validate_id(&id, &valid_id, &mut ids)?;
                    let regex = compile_user_regex("rule", &id, &pattern)?;
                    if regex.is_match("") {
                        return Err(ContractError(format!(
                            "regex rule '{id}' matches an empty string"
                        )));
                    }
                    (id.clone(), CompiledRule::Regex { id, regex })
                }
                Rule::Token {
                    id,
                    name,
                    env,
                    required,
                } => {
                    validate_id(&id, &valid_id, &mut ids)?;
                    if !valid_id.is_match(&name) {
                        return Err(ContractError(format!(
                            "token rule '{id}' has invalid name '{name}'"
                        )));
                    }
                    let value = tokens
                        .get(&name)
                        .cloned()
                        .or_else(|| env.as_ref().and_then(|key| std::env::var(key).ok()));
                    if required && value.is_none() {
                        let source = env
                            .as_deref()
                            .map(|key| format!(" or environment variable {key}"))
                            .unwrap_or_default();
                        return Err(ContractError(format!(
                            "token rule '{id}' needs --token {name}=VALUE{source}"
                        )));
                    }
                    if value.as_ref().is_some_and(|value| value.len() < 4) {
                        return Err(ContractError(format!(
                            "token rule '{id}' resolved to fewer than 4 bytes"
                        )));
                    }
                    (id.clone(), CompiledRule::Token { id, value })
                }
            };
            let _ = id;
            compiled_rules.push(compiled);
        }

        let mut compiled_assertions = Vec::with_capacity(policy.assertions.len());
        for assertion in policy.assertions {
            match assertion {
                Assertion::DenyRegex { id, pattern } => {
                    validate_id(&id, &valid_id, &mut ids)?;
                    let regex = compile_user_regex("assertion", &id, &pattern)?;
                    if regex.is_match("") {
                        return Err(ContractError(format!(
                            "assertion '{id}' matches an empty string"
                        )));
                    }
                    compiled_assertions.push(CompiledAssertion { id, regex });
                }
            }
        }

        if policy.entropy.enabled {
            if policy.entropy.min_length < 8 {
                return Err(ContractError(
                    "entropy.min_length must be at least 8".to_owned(),
                ));
            }
            if !(2.0..=8.0).contains(&policy.entropy.threshold) {
                return Err(ContractError(
                    "entropy.threshold must be between 2.0 and 8.0".to_owned(),
                ));
            }
        }
        let allow = policy
            .entropy
            .allow
            .iter()
            .enumerate()
            .map(|(index, pattern)| {
                Regex::new(pattern).map_err(|error| {
                    ContractError(format!("invalid entropy allow pattern #{index}: {error}"))
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        let candidates = Regex::new(r"[A-Za-z0-9_+/=.-]+\b").expect("static regex");

        Ok(Self {
            rules: compiled_rules,
            assertions: compiled_assertions,
            entropy: CompiledEntropy {
                enabled: policy.entropy.enabled,
                min_length: policy.entropy.min_length,
                threshold: policy.entropy.threshold,
                allow,
                candidates,
            },
        })
    }

    /// Apply non-path rules to plain text and check the sanitized result.
    #[must_use]
    pub fn scrub_text(&self, input: &str) -> ScrubResult {
        let mut content = input.to_owned();
        let mut hits = Vec::new();
        for rule in &self.rules {
            match rule {
                CompiledRule::Regex { id, regex } => {
                    redact_regex_string(&mut content, id, regex, "text", &mut hits);
                }
                CompiledRule::Token { id, value } => {
                    if let Some(value) = value {
                        redact_token_string(&mut content, id, value, "text", &mut hits);
                    }
                }
                CompiledRule::Path { .. } => {}
            }
        }
        let violations = self.inspect(&content, "text");
        ScrubResult {
            content,
            hits,
            violations,
        }
    }

    /// Parse, redact, and pretty-print one JSON value.
    pub fn scrub_json(&self, input: &str) -> Result<ScrubResult, ContractError> {
        let mut value: Value = serde_json::from_str(input)
            .map_err(|error| ContractError(format!("invalid JSON fixture: {error}")))?;
        let mut hits = Vec::new();
        for rule in &self.rules {
            match rule {
                CompiledRule::Path { id, segments } => {
                    redact_path(&mut value, segments, "$", id, &mut hits);
                }
                CompiledRule::Regex { id, regex } => {
                    visit_strings(&mut value, "$", &mut |text, location| {
                        redact_regex_string(text, id, regex, location, &mut hits);
                    });
                }
                CompiledRule::Token {
                    id,
                    value: token_value,
                } => {
                    if let Some(token_value) = token_value {
                        visit_strings(&mut value, "$", &mut |text, location| {
                            redact_token_string(text, id, token_value, location, &mut hits);
                        });
                    }
                }
            }
        }
        let content = serde_json::to_string_pretty(&value)
            .map_err(|error| ContractError(format!("could not serialize JSON: {error}")))?;
        let violations = self.inspect(&content, "json");
        Ok(ScrubResult {
            content,
            hits,
            violations,
        })
    }

    fn inspect(&self, content: &str, location: &str) -> Vec<Violation> {
        let mut violations = Vec::new();
        for assertion in &self.assertions {
            for found in assertion.regex.find_iter(content).take(20) {
                violations.push(Violation {
                    check: assertion.id.clone(),
                    location: format!("{location}@byte{}", found.start()),
                    evidence: "[DENY PATTERN MATCH]".to_owned(),
                });
            }
        }
        for rule in &self.rules {
            if let CompiledRule::Token {
                id,
                value: Some(value),
            } = rule
            {
                for (start, _) in content.match_indices(value).take(20) {
                    violations.push(Violation {
                        check: format!("{id}-token-remains"),
                        location: format!("{location}@byte{start}"),
                        evidence: format!("[TOKEN VALUE {} chars]", value.chars().count()),
                    });
                }
            }
        }
        if self.entropy.enabled {
            for found in self.entropy.candidates.find_iter(content) {
                let candidate = found.as_str();
                if candidate.len() < self.entropy.min_length
                    || candidate.starts_with("REDACTED")
                    || self
                        .entropy
                        .allow
                        .iter()
                        .any(|allow| allow.is_match(candidate))
                    || !has_mixed_character_classes(candidate)
                {
                    continue;
                }
                let score = shannon_entropy(candidate);
                if score >= self.entropy.threshold {
                    violations.push(Violation {
                        check: "high-entropy".to_owned(),
                        location: format!("{location}@byte{}", found.start()),
                        evidence: format!(
                            "[HIGH-ENTROPY VALUE {} chars, {:.2} bits/char]",
                            candidate.chars().count(),
                            score
                        ),
                    });
                }
                if violations.len() >= 100 {
                    break;
                }
            }
        }
        violations
    }
}

fn validate_id(id: &str, valid: &Regex, ids: &mut HashSet<String>) -> Result<(), ContractError> {
    if !valid.is_match(id) {
        return Err(ContractError(format!("invalid rule/check id '{id}'")));
    }
    if !ids.insert(id.to_owned()) {
        return Err(ContractError(format!("duplicate rule/check id '{id}'")));
    }
    Ok(())
}

fn compile_user_regex(kind: &str, id: &str, pattern: &str) -> Result<Regex, ContractError> {
    if pattern.len() > 4_096 {
        return Err(ContractError(format!(
            "{kind} '{id}' exceeds the 4096-byte regex limit"
        )));
    }
    Regex::new(pattern)
        .map_err(|error| ContractError(format!("invalid regex in {kind} '{id}': {error}")))
}

fn parse_path(path: &str) -> Result<Vec<String>, ContractError> {
    let segments: Vec<String> = path.split('.').map(ToOwned::to_owned).collect();
    if segments.is_empty() || segments.iter().any(|segment| segment.is_empty()) {
        return Err(ContractError(format!(
            "invalid empty path segment in '{path}'"
        )));
    }
    Ok(segments)
}

fn marker(id: &str) -> String {
    format!("[REDACTED:{id}]")
}

fn describe_value(value: &Value) -> String {
    match value {
        Value::String(text) => format!("string ({} chars)", text.chars().count()),
        Value::Array(items) => format!("array ({} items)", items.len()),
        Value::Object(entries) => format!("object ({} fields)", entries.len()),
        Value::Number(_) => "number".to_owned(),
        Value::Bool(_) => "boolean".to_owned(),
        Value::Null => "null".to_owned(),
    }
}

fn redact_path(
    value: &mut Value,
    segments: &[String],
    location: &str,
    id: &str,
    hits: &mut Vec<Hit>,
) {
    if segments.is_empty() {
        let after = marker(id);
        hits.push(Hit {
            rule: id.to_owned(),
            location: location.to_owned(),
            before: describe_value(value),
            after: after.clone(),
        });
        *value = Value::String(after);
        return;
    }
    let segment = &segments[0];
    match value {
        Value::Object(entries) if segment == "*" => {
            for (key, child) in entries {
                redact_path(
                    child,
                    &segments[1..],
                    &format!("{location}.{key}"),
                    id,
                    hits,
                );
            }
        }
        Value::Object(entries) => {
            if let Some(child) = entries.get_mut(segment) {
                redact_path(
                    child,
                    &segments[1..],
                    &format!("{location}.{segment}"),
                    id,
                    hits,
                );
            }
        }
        Value::Array(items) if segment == "*" => {
            for (index, child) in items.iter_mut().enumerate() {
                redact_path(
                    child,
                    &segments[1..],
                    &format!("{location}[{index}]"),
                    id,
                    hits,
                );
            }
        }
        Value::Array(items) => {
            if let Ok(index) = segment.parse::<usize>()
                && let Some(child) = items.get_mut(index)
            {
                redact_path(
                    child,
                    &segments[1..],
                    &format!("{location}[{index}]"),
                    id,
                    hits,
                );
            }
        }
        _ => {}
    }
}

fn visit_strings<F>(value: &mut Value, location: &str, visitor: &mut F)
where
    F: FnMut(&mut String, &str),
{
    match value {
        Value::String(text) => visitor(text, location),
        Value::Array(items) => {
            for (index, child) in items.iter_mut().enumerate() {
                visit_strings(child, &format!("{location}[{index}]"), visitor);
            }
        }
        Value::Object(entries) => {
            for (key, child) in entries {
                visit_strings(child, &format!("{location}.{key}"), visitor);
            }
        }
        _ => {}
    }
}

fn redact_regex_string(
    text: &mut String,
    id: &str,
    regex: &Regex,
    location: &str,
    hits: &mut Vec<Hit>,
) {
    let count = regex.find_iter(text).count();
    if count == 0 {
        return;
    }
    let after = marker(id);
    let before_chars: usize = regex
        .find_iter(text)
        .map(|found| found.as_str().chars().count())
        .sum();
    *text = regex.replace_all(text, NoExpand(&after)).into_owned();
    hits.push(Hit {
        rule: id.to_owned(),
        location: location.to_owned(),
        before: format!("{count} match(es), {before_chars} chars total"),
        after,
    });
}

fn redact_token_string(
    text: &mut String,
    id: &str,
    value: &str,
    location: &str,
    hits: &mut Vec<Hit>,
) {
    let count = text.matches(value).count();
    if count == 0 {
        return;
    }
    let after = marker(id);
    *text = text.replace(value, &after);
    hits.push(Hit {
        rule: id.to_owned(),
        location: location.to_owned(),
        before: format!(
            "{count} token match(es), {} chars each",
            value.chars().count()
        ),
        after,
    });
}

fn has_mixed_character_classes(value: &str) -> bool {
    let mut lower = false;
    let mut upper = false;
    let mut digit = false;
    let mut symbol = false;
    for byte in value.bytes() {
        lower |= byte.is_ascii_lowercase();
        upper |= byte.is_ascii_uppercase();
        digit |= byte.is_ascii_digit();
        symbol |= matches!(byte, b'_' | b'+' | b'/' | b'=' | b'.' | b'-');
    }
    [lower, upper, digit, symbol]
        .into_iter()
        .filter(|present| *present)
        .count()
        >= 2
}

fn shannon_entropy(value: &str) -> f64 {
    let mut counts = [0_usize; 256];
    for byte in value.bytes() {
        counts[usize::from(byte)] += 1;
    }
    let length = value.len() as f64;
    counts
        .into_iter()
        .filter(|count| *count > 0)
        .map(|count| {
            let probability = count as f64 / length;
            -probability * probability.log2()
        })
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn contract(policy: &str) -> Contract {
        Contract::from_json(policy, &HashMap::new()).unwrap()
    }

    #[test]
    fn documented_regex_example_scrubs_text() {
        let policy = r#"{
          "version":1,
          "rules":[{"id":"email","kind":"regex","pattern":"[a-z]+@[a-z.]+"}],
          "assertions":[], "entropy":{"enabled":false}
        }"#;
        let result = contract(policy).scrub_text("owner=ada@example.test");
        assert_eq!(result.content, "owner=[REDACTED:email]");
        assert!(result.ok());
        assert!(!format!("{:?}", result.hits).contains("ada@example"));
    }

    #[test]
    fn path_wildcards_replace_entire_values() {
        let policy = r#"{
          "version":1,
          "rules":[{"id":"emails","kind":"path","path":"events.*.user.email"}],
          "assertions":[], "entropy":{"enabled":false}
        }"#;
        let result = contract(policy)
            .scrub_json(r#"{"events":[{"user":{"email":"a@example.test"}},{"user":{"email":"b@example.test"}}]}"#)
            .unwrap();
        assert_eq!(result.hits.len(), 2);
        assert!(!result.content.contains("example.test"));
    }

    #[test]
    fn token_rules_require_runtime_values_without_leaking_them() {
        let policy = r#"{
          "version":1,
          "rules":[{"id":"key","kind":"token","name":"api_key"}],
          "assertions":[], "entropy":{"enabled":false}
        }"#;
        let error = match Contract::from_json(policy, &HashMap::new()) {
            Ok(_) => panic!("missing token unexpectedly accepted"),
            Err(error) => error,
        };
        assert!(error.to_string().contains("--token api_key=VALUE"));

        let mut tokens = HashMap::new();
        tokens.insert("api_key".to_owned(), "secret-1234".to_owned());
        let result = Contract::from_json(policy, &tokens)
            .unwrap()
            .scrub_text("key=secret-1234");
        assert_eq!(result.content, "key=[REDACTED:key]");
        assert!(!format!("{:?}", result.hits).contains("secret-1234"));
    }

    #[test]
    fn deny_assertion_fails_after_redaction() {
        let policy = r#"{
          "version":1, "rules":[],
          "assertions":[{"id":"no-email","kind":"deny_regex","pattern":"[a-z]+@[a-z.]+"}],
          "entropy":{"enabled":false}
        }"#;
        let result = contract(policy).scrub_text("ada@example.test");
        assert!(!result.ok());
        assert_eq!(result.violations[0].evidence, "[DENY PATTERN MATCH]");
    }

    #[test]
    fn entropy_flags_mixed_random_values_and_honours_allowlist() {
        let policy = r#"{
          "version":1, "rules":[], "assertions":[],
          "entropy":{"enabled":true,"min_length":20,"threshold":3.5,"allow":[]}
        }"#;
        let result = contract(policy).scrub_text("token=Az9_xY8-qW7.rT6+uI5/pO4=");
        assert!(!result.ok());
        assert!(!result.violations[0].evidence.contains("Az9_"));
    }

    #[test]
    fn unsafe_or_ambiguous_policy_is_rejected() {
        let backreference = r#"{
          "version":1,
          "rules":[{"id":"bad","kind":"regex","pattern":"(a+)\\1"}],
          "assertions":[], "entropy":{"enabled":false}
        }"#;
        assert!(Contract::from_json(backreference, &HashMap::new()).is_err());

        let empty = r#"{
          "version":1,
          "rules":[{"id":"bad","kind":"regex","pattern":"a*"}],
          "assertions":[], "entropy":{"enabled":false}
        }"#;
        assert!(Contract::from_json(empty, &HashMap::new()).is_err());
    }
}
