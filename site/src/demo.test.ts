import { describe, expect, it } from "vitest";
import { DEFAULT_FIXTURE, runDemo } from "./demo";

describe("browser contract specimen", () => {
  it("redacts configured paths and safe built-in shapes", () => {
    const result = runDemo(DEFAULT_FIXTURE, ["request.headers.authorization", "user.email", "session_material"]);
    expect(result.ok).toBe(true);
    expect(result.content).not.toContain("ada@example.test");
    expect(result.content).not.toContain("demo_sk_");
    expect(result.hits.length).toBe(3);
  });

  it("flags an unconfigured high-entropy field without echoing it", () => {
    const result = runDemo(DEFAULT_FIXTURE, ["request.headers.authorization", "user.email"]);
    expect(result.ok).toBe(false);
    expect(result.violations[0]).not.toContain("k9Qv2Lm8");
  });

  it("rejects invalid fixtures and paths", () => {
    expect(() => runDemo("not-json", [])).toThrow("not valid JSON");
    expect(() => runDemo("{}", ["user..email"])).toThrow("empty segment");
  });
});
