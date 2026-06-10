import { describe, it, expect } from "vitest";
import { clampJobDescription, MAX_JD_CHARS } from "./clamp-jd";

describe("clampJobDescription", () => {
  it("returns short JDs unchanged", () => {
    const jd = "Vaga de analista de TI. Requisitos: SQL, Excel, suporte.";
    expect(clampJobDescription(jd)).toBe(jd);
  });

  it("returns a JD exactly at the limit unchanged", () => {
    const jd = "x".repeat(MAX_JD_CHARS);
    expect(clampJobDescription(jd)).toBe(jd);
  });

  it("truncates a JD over the limit, keeps the prefix, and marks it", () => {
    const jd = "x".repeat(MAX_JD_CHARS + 5000);
    const out = clampJobDescription(jd);
    expect(out.length).toBeLessThan(jd.length);
    expect(out.startsWith("x".repeat(100))).toBe(true);
    expect(out).toContain("truncada");
    // The JD body never exceeds the cap (marker is short, bounded overhead).
    expect(out.length).toBeLessThanOrEqual(MAX_JD_CHARS + 200);
  });

  it("respects a custom max", () => {
    const jd = "abcdefghij".repeat(10); // 100 chars
    const out = clampJobDescription(jd, 20);
    expect(out.startsWith("abcdefghijabcdefghij")).toBe(true);
    expect(out).toContain("truncada");
  });

  it("treats null/undefined/empty as empty string", () => {
    expect(clampJobDescription(null)).toBe("");
    expect(clampJobDescription(undefined)).toBe("");
    expect(clampJobDescription("")).toBe("");
  });
});
