import { DEFAULT_FIXTURE, runDemo } from "./demo";

declare const __BUILD_ID__: string;

const SLUG = "log-scrub-contract";
const API = "https://api.sociobot.in/api/v1";
const LICENSE_KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `sb_license_verdict:${SLUG}`;
const DEMO_PREFIX = `demo:${SLUG}:`;
const DAY = 86_400_000;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function optionalById<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function readLocal(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeLocal(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}

function removeLocal(key: string): void {
  try { localStorage.removeItem(key); } catch { /* Storage is optional. */ }
}

function initialiseBuildId(): void {
  document.querySelectorAll<HTMLElement>("[data-build-id]").forEach((element) => {
    element.textContent = __BUILD_ID__;
  });
}

function initialiseDemo(): void {
  const fixture = optionalById<HTMLTextAreaElement>("fixture");
  const pathRules = optionalById<HTMLInputElement>("path-rules");
  const result = optionalById<HTMLElement>("result");
  const resultState = optionalById<HTMLElement>("result-state");
  const summary = optionalById<HTMLElement>("demo-summary");
  const findings = optionalById<HTMLUListElement>("findings");
  if (!fixture || !pathRules || !result || !resultState || !summary || !findings) return;

  const sandbox = document.body.dataset.demoSandbox === "true";
  const defaultPaths = "request.headers.authorization, user.email, session_material";
  if (sandbox) {
    fixture.value = readLocal(`${DEMO_PREFIX}fixture`) ?? DEFAULT_FIXTURE;
    pathRules.value = readLocal(`${DEMO_PREFIX}paths`) ?? defaultPaths;
  }

  const saveSandbox = (): void => {
    if (!sandbox) return;
    writeLocal(`${DEMO_PREFIX}fixture`, fixture.value);
    writeLocal(`${DEMO_PREFIX}paths`, pathRules.value);
  };

  const evaluate = (): void => {
    try {
      const report = runDemo(fixture.value, pathRules.value.split(","));
      result.textContent = report.ok
        ? report.content
        : "Output withheld. A possible leak remains; add a rule and run the contract again.";
      resultState.textContent = report.ok ? "PASS" : "FAIL";
      resultState.className = `state ${report.ok ? "pass" : "fail"}`;
      summary.textContent = report.ok
        ? `Contract passed with ${report.hits.length} irreversible redactions.`
        : `Contract failed: ${report.violations.length} possible leak remains after ${report.hits.length} redactions.`;
      findings.replaceChildren(...[...report.hits.map((hit) => `Redacted: ${hit}`), ...report.violations].map((message, index) => {
        const item = document.createElement("li");
        item.className = index >= report.hits.length ? "finding-danger" : "finding-safe";
        item.textContent = message;
        return item;
      }));
    } catch (error) {
      result.textContent = "No sanitized output. Fix the sample or path rules and run again.";
      resultState.textContent = "ERROR";
      resultState.className = "state fail";
      summary.textContent = error instanceof Error ? error.message : "The sample could not be evaluated.";
      findings.replaceChildren();
    }
  };

  byId("run-contract").addEventListener("click", () => { saveSandbox(); evaluate(); });
  fixture.addEventListener("input", saveSandbox);
  pathRules.addEventListener("input", saveSandbox);
  fixture.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      saveSandbox();
      evaluate();
    }
  });

  optionalById<HTMLButtonElement>("reset-demo")?.addEventListener("click", () => {
    removeLocal(`${DEMO_PREFIX}fixture`);
    removeLocal(`${DEMO_PREFIX}paths`);
    fixture.value = DEFAULT_FIXTURE;
    pathRules.value = defaultPaths;
    evaluate();
    fixture.focus();
  });
  optionalById<HTMLAnchorElement>("start-for-real")?.addEventListener("click", () => {
    removeLocal(`${DEMO_PREFIX}fixture`);
    removeLocal(`${DEMO_PREFIX}paths`);
  });

  if (sandbox) evaluate();
}

function initialiseCopyButtons(): void {
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
}

function initialiseNetworkNote(): void {
  const offlineNote = optionalById("offline-note");
  if (!offlineNote) return;
  const syncNetworkState = (): void => { offlineNote.hidden = navigator.onLine; };
  window.addEventListener("online", syncNetworkState);
  window.addEventListener("offline", syncNetworkState);
  syncNetworkState();
}

interface CachedVerdict { token: string; valid: boolean; checkedAt: number }

function readVerdict(): CachedVerdict | null {
  try {
    const value = JSON.parse(readLocal(VERDICT_KEY) ?? "null") as CachedVerdict | null;
    return value && typeof value.token === "string" && typeof value.valid === "boolean" ? value : null;
  } catch { return null; }
}

function initialiseLicensing(): void {
  const packUnlocked = optionalById<HTMLElement>("pack-unlocked");
  const licenseStatus = optionalById<HTMLElement>("license-status");
  const licenseForm = optionalById<HTMLFormElement>("license-form");
  if (!packUnlocked || !licenseStatus || !licenseForm) return;

  const setUnlocked = (unlocked: boolean, message: string): void => {
    packUnlocked.hidden = !unlocked;
    licenseStatus.textContent = message;
  };
  const verifyLicense = async (token: string): Promise<void> => {
    const cached = readVerdict();
    if (cached?.token === token && Date.now() - cached.checkedAt < DAY) {
      setUnlocked(cached.valid, cached.valid ? "Team Pack license active." : "License no longer active. You can restore another license below.");
      return;
    }
    if (!navigator.onLine) {
      setUnlocked(cached?.token === token && cached.valid, cached?.valid ? "Team Pack available from the last verified license." : "Offline. The free CLI and demo remain available; reconnect to verify your license.");
      return;
    }
    licenseStatus.textContent = "Checking license…";
    try {
      const response = await fetch(`${API}/products/${SLUG}/verify?license=${encodeURIComponent(token)}`, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("verification service unavailable");
      const verdict = await response.json() as { valid: boolean };
      const value = { token, valid: Boolean(verdict.valid), checkedAt: Date.now() };
      writeLocal(VERDICT_KEY, JSON.stringify(value));
      setUnlocked(value.valid, value.valid ? "Team Pack license active." : "License no longer active. You can purchase or restore another license.");
    } catch {
      setUnlocked(cached?.token === token && cached.valid, cached?.valid ? "Using the last verified license while the service is unavailable." : "Could not verify just now. The free CLI and demo remain available.");
    }
  };

  const query = new URLSearchParams(location.search);
  const returnedLicense = query.get("license");
  if (query.has("license")) {
    query.delete("license");
    const cleanAddress = `${location.pathname}${query.size ? `?${query}` : ""}${location.hash}`;
    try { history.replaceState(null, "", cleanAddress); } catch { location.replace(cleanAddress); }
  }
  if (returnedLicense) writeLocal(LICENSE_KEY, returnedLicense);
  const storedLicense = returnedLicense ?? readLocal(LICENSE_KEY);
  if (storedLicense) {
    const cached = readVerdict();
    if (cached?.token === storedLicense && cached.valid) setUnlocked(true, "Team Pack license active.");
    void verifyLicense(storedLicense);
  }
  licenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const token = byId<HTMLInputElement>("license-token").value.trim();
    if (!token) return;
    writeLocal(LICENSE_KEY, token);
    void verifyLicense(token);
  });

  const templates: Record<string, string> = {
    github: "strategy:\n  matrix:\n    drain: [support, observability, audit]\nsteps:\n  - run: log-scrub check --config contracts/${{ matrix.drain }}.json fixtures/${{ matrix.drain }}/",
    support: "{\n  \"version\": 1,\n  \"rules\": [\n    {\"id\":\"auth\",\"kind\":\"path\",\"path\":\"request.headers.authorization\"},\n    {\"id\":\"cookies\",\"kind\":\"path\",\"path\":\"request.headers.cookie\"}\n  ],\n  \"assertions\": [],\n  \"entropy\": {\"enabled\":true,\"min_length\":24,\"threshold\":4.2,\"allow\":[]}\n}",
    review: "Drain review\n[ ] Fixture represents every emitted log shape\n[ ] Runtime tokens come from CI secrets, not config\n[ ] Entropy allow patterns have an owner and rationale\n[ ] Report reviewed after logger or SDK upgrades",
  };
  document.querySelectorAll<HTMLButtonElement>("[data-pack-template]").forEach((button) => {
    button.addEventListener("click", async () => {
      const template = templates[button.dataset.packTemplate ?? ""];
      if (!template) return;
      try {
        await navigator.clipboard.writeText(template);
        const label = button.querySelector("span");
        if (label) {
          const original = label.textContent;
          label.textContent = "Copied";
          window.setTimeout(() => { label.textContent = original; }, 1600);
        }
      } catch {
        licenseStatus.textContent = "Could not copy the template. Select its text from the source repository instead.";
      }
    });
  });
}

initialiseBuildId();
initialiseDemo();
initialiseCopyButtons();
initialiseNetworkNote();
initialiseLicensing();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js"); });
}
