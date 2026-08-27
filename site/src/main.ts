import { DEFAULT_FIXTURE, runDemo } from "./demo";

const SLUG = "log-scrub-contract";
const API = "https://api.sociobot.in/api/v1";
const LICENSE_KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `sb_license_verdict:${SLUG}`;
const DAY = 86_400_000;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

const fixture = byId<HTMLTextAreaElement>("fixture");
const pathRules = byId<HTMLInputElement>("path-rules");
const result = byId<HTMLElement>("result");
const resultState = byId<HTMLElement>("result-state");
const summary = byId<HTMLElement>("demo-summary");
const findings = byId<HTMLUListElement>("findings");

function evaluate(): void {
  try {
    const report = runDemo(fixture.value, pathRules.value.split(","));
    result.textContent = report.content;
    resultState.textContent = report.ok ? "PASS" : "FAIL";
    resultState.className = `state ${report.ok ? "pass" : "fail"}`;
    summary.textContent = report.ok
      ? `Contract passed with ${report.hits.length} irreversible redactions.`
      : `Contract failed: ${report.violations.length} possible leak remains after ${report.hits.length} redactions.`;
    findings.replaceChildren(
      ...[...report.hits.map((hit) => `Redacted: ${hit}`), ...report.violations].map((message, index) => {
        const item = document.createElement("li");
        item.className = index >= report.hits.length ? "finding-danger" : "finding-safe";
        item.textContent = message;
        return item;
      }),
    );
  } catch (error) {
    result.textContent = "No sanitized output. Fix the fixture or path rules and run again.";
    resultState.textContent = "ERROR";
    resultState.className = "state fail";
    summary.textContent = error instanceof Error ? error.message : "The specimen could not be evaluated.";
    findings.replaceChildren();
  }
}

byId("run-contract").addEventListener("click", evaluate);
byId("reset-demo").addEventListener("click", () => {
  fixture.value = DEFAULT_FIXTURE;
  pathRules.value = "request.headers.authorization, user.email";
  result.textContent = "Run the contract to inspect this specimen.";
  resultState.textContent = "Waiting";
  resultState.className = "state waiting";
  summary.textContent = "Nothing has been evaluated yet.";
  findings.replaceChildren();
  fixture.focus();
});
fixture.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") evaluate();
});

document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? "");
      const original = button.textContent;
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = original; }, 1600);
    } catch {
      button.textContent = "Select and copy the commands below";
    }
  });
});

const offlineNote = byId("offline-note");
function syncNetworkState(): void {
  offlineNote.hidden = navigator.onLine;
}
window.addEventListener("online", syncNetworkState);
window.addEventListener("offline", syncNetworkState);
syncNetworkState();

interface CachedVerdict { token: string; valid: boolean; checkedAt: number }

function readVerdict(): CachedVerdict | null {
  try {
    const value = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? "null") as CachedVerdict | null;
    return value && typeof value.token === "string" && typeof value.valid === "boolean" ? value : null;
  } catch { return null; }
}

function setUnlocked(unlocked: boolean, message: string): void {
  byId("pack-unlocked").hidden = !unlocked;
  byId("license-status").textContent = message;
}

async function verifyLicense(token: string): Promise<void> {
  const cached = readVerdict();
  if (cached?.token === token && Date.now() - cached.checkedAt < DAY) {
    setUnlocked(cached.valid, cached.valid ? "Team Pack license active." : "License no longer active. You can restore another license below.");
    return;
  }
  if (!navigator.onLine) {
    setUnlocked(cached?.token === token && cached.valid, cached?.valid ? "Team Pack available from the last verified license." : "Offline. The free CLI and demo remain available; reconnect to verify your license.");
    return;
  }
  byId("license-status").textContent = "Checking license…";
  try {
    const response = await fetch(`${API}/products/${SLUG}/verify?license=${encodeURIComponent(token)}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("verification service unavailable");
    const verdict = await response.json() as { valid: boolean };
    const value = { token, valid: Boolean(verdict.valid), checkedAt: Date.now() };
    localStorage.setItem(VERDICT_KEY, JSON.stringify(value));
    setUnlocked(value.valid, value.valid ? "Team Pack license active." : "License no longer active. You can purchase or restore another license.");
  } catch {
    setUnlocked(cached?.token === token && cached.valid, cached?.valid ? "Using the last verified license while the service is unavailable." : "Could not verify just now. The free CLI and demo remain available.");
  }
}

const query = new URLSearchParams(location.search);
const returnedLicense = query.get("license");
if (returnedLicense) {
  localStorage.setItem(LICENSE_KEY, returnedLicense);
  query.delete("license");
  history.replaceState(null, "", `${location.pathname}${query.size ? `?${query}` : ""}${location.hash}`);
}
const storedLicense = returnedLicense ?? localStorage.getItem(LICENSE_KEY);
if (storedLicense) {
  const cached = readVerdict();
  if (cached?.token === storedLicense && cached.valid) setUnlocked(true, "Team Pack license active.");
  void verifyLicense(storedLicense);
}

byId<HTMLFormElement>("license-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const token = byId<HTMLInputElement>("license-token").value.trim();
  if (!token) return;
  localStorage.setItem(LICENSE_KEY, token);
  void verifyLicense(token);
});

const templates: Record<string, string> = {
  github: `strategy:\n  matrix:\n    drain: [support, observability, audit]\nsteps:\n  - run: log-scrub check --config contracts/\${{ matrix.drain }}.json fixtures/\${{ matrix.drain }}/`,
  support: `{\n  "version": 1,\n  "rules": [\n    {"id":"auth","kind":"path","path":"request.headers.authorization"},\n    {"id":"cookies","kind":"path","path":"request.headers.cookie"},\n    {"id":"email","kind":"regex","pattern":"(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\\\\.[a-z]{2,}"}\n  ],\n  "assertions": [],\n  "entropy": {"enabled":true,"min_length":24,"threshold":4.2,"allow":[]}\n}`,
  review: `Drain review\n[ ] Fixture represents every emitted log shape\n[ ] Runtime tokens come from CI secrets, not config\n[ ] Entropy allow patterns have an owner and rationale\n[ ] Report reviewed after logger or SDK upgrades\n[ ] Known exposure paths have credential rotation steps`,
};
document.querySelectorAll<HTMLButtonElement>("[data-pack-template]").forEach((button) => {
  button.addEventListener("click", async () => {
    const template = templates[button.dataset.packTemplate ?? ""];
    if (!template) return;
    await navigator.clipboard.writeText(template);
    const label = button.querySelector("span");
    if (label) {
      label.textContent = "Copied";
      window.setTimeout(() => { label.textContent = "Copy template"; }, 1600);
    }
  });
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js"); });
