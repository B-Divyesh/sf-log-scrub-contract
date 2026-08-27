export interface DemoResult {
  ok: boolean;
  content: string;
  hits: string[];
  violations: string[];
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const DEMO_KEY = /demo_sk_[A-Za-z0-9_-]{12,}/g;
const CANDIDATE = /[A-Za-z0-9_+/=.-]{24,}/g;

export const DEFAULT_FIXTURE = `{
  "level": "info",
  "user": { "email": "ada@example.test" },
  "request": {
    "path": "/support",
    "headers": { "authorization": "Bearer demo_sk_A1b2C3d4E5f6" }
  },
  "session_material": "k9Qv2Lm8Xz4Rp7Tw3Ny6Bc1D"
}`;

function marker(id: string): string {
  return `[REDACTED:${id}]`;
}

function redactPath(value: unknown, segments: string[], id: string, hits: string[], location = "$" ): void {
  if (segments.length === 0 || value === null || typeof value !== "object") return;
  const [head, ...tail] = segments;
  const container = value as Record<string, unknown> | unknown[];
  const keys = head === "*" ? Object.keys(container) : [head];
  for (const key of keys) {
    if (!(key in container)) continue;
    const nextLocation = Array.isArray(container) ? `${location}[${key}]` : `${location}.${key}`;
    if (tail.length === 0) {
      container[key as keyof typeof container] = marker(id) as never;
      hits.push(`${id} at ${nextLocation}`);
    } else {
      redactPath(container[key as keyof typeof container], tail, id, hits, nextLocation);
    }
  }
}

function visitStrings(value: unknown, visitor: (text: string, location: string) => string, location = "$" ): unknown {
  if (typeof value === "string") return visitor(value, location);
  if (Array.isArray(value)) return value.map((item, index) => visitStrings(item, visitor, `${location}[${index}]`));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) output[key] = visitStrings(item, visitor, `${location}.${key}`);
    return output;
  }
  return value;
}

function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1);
  let score = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    score -= probability * Math.log2(probability);
  }
  return score;
}

function mixed(value: string): boolean {
  return [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[_+/=.-]/.test(value)].filter(Boolean).length >= 2;
}

export function runDemo(input: string, paths: string[]): DemoResult {
  let payload: unknown;
  try {
    payload = JSON.parse(input);
  } catch (error) {
    throw new Error(`Fixture is not valid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`);
  }
  if (payload === null || typeof payload !== "object") throw new Error("Fixture must be a JSON object or array.");

  const hits: string[] = [];
  for (const path of paths) {
    const normalized = path.trim();
    if (!normalized) continue;
    if (normalized.split(".").some((part) => part.length === 0)) throw new Error(`Path “${normalized}” contains an empty segment.`);
    redactPath(payload, normalized.split("."), normalized, hits);
  }
  payload = visitStrings(payload, (text, location) => {
    let next = text.replace(EMAIL, () => {
      hits.push(`email at ${location}`);
      return marker("email");
    });
    next = next.replace(DEMO_KEY, () => {
      hits.push(`token-shape at ${location}`);
      return marker("token-shape");
    });
    return next;
  });

  const content = JSON.stringify(payload, null, 2);
  const violations: string[] = [];
  for (const found of content.matchAll(CANDIDATE)) {
    const candidate = found[0];
    if (!candidate.startsWith("REDACTED") && mixed(candidate) && entropy(candidate) >= 4.0) {
      violations.push(`High-entropy value remains at byte ${found.index ?? 0} (${candidate.length} characters; value withheld).`);
    }
  }
  return { ok: violations.length === 0, content, hits, violations };
}
