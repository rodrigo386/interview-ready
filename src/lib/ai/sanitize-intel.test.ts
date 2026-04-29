import { describe, it, expect } from "vitest";
import { sanitizeCompanyIntel } from "./gemini";
import { companyIntelSchema } from "./schemas";

describe("sanitizeCompanyIntel — guards Gemini output before strict schema parse", () => {
  it("passes a fully-valid payload through unchanged in shape", () => {
    const input = {
      overview: "Acme is a SaaS leader.".repeat(2),
      recent_developments: [
        { headline: "IPO filed", why_it_matters: "Pressure for growth metrics in next 18 months." },
      ],
      key_people: [
        {
          name: "Jane Doe",
          role: "CPO",
          background_snippet: "Joined 2024 from Bayer to lead procurement transformation.",
        },
      ],
      culture_signals: ["fast-paced", "remote-first"],
      strategic_context: "Specialty chemicals consolidating, PE-backed exit targeted 2027.",
      questions_this_creates: ["How does the IPO timeline change procurement priorities?"],
    };
    const out = sanitizeCompanyIntel(input);
    const parsed = companyIntelSchema.safeParse(out);
    expect(parsed.success).toBe(true);
  });

  it("drops recent_developments entries missing why_it_matters (Hexion bug)", () => {
    const input = {
      overview: "x".repeat(50),
      recent_developments: [
        { headline: "Good entry", why_it_matters: "Real reason that's at least ten characters long." },
        { headline: "Bad entry — no why" },
        { headline: "Another bad", why_it_matters: "" }, // < 10 chars
      ],
      key_people: [],
      culture_signals: [],
      strategic_context: "x".repeat(50),
      questions_this_creates: [],
    };
    const out = sanitizeCompanyIntel(input) as { recent_developments: unknown[] };
    expect(out.recent_developments.length).toBe(1);
    expect((out.recent_developments[0] as { headline: string }).headline).toBe("Good entry");
  });

  it("truncates culture_signals strings to 300 chars (was breaking schema at 150)", () => {
    const input = {
      overview: "x".repeat(50),
      recent_developments: [],
      key_people: [],
      culture_signals: ["a".repeat(500)],
      strategic_context: "x".repeat(50),
      questions_this_creates: [],
    };
    const out = sanitizeCompanyIntel(input) as { culture_signals: string[] };
    expect(out.culture_signals[0].length).toBe(300);
  });

  it("drops empty culture_signals strings", () => {
    const input = {
      overview: "x".repeat(50),
      recent_developments: [],
      key_people: [],
      culture_signals: ["valid", "", "  "],
      strategic_context: "x".repeat(50),
      questions_this_creates: [],
    };
    const out = sanitizeCompanyIntel(input) as { culture_signals: string[] };
    expect(out.culture_signals).toEqual(["valid"]);
  });

  it("caps array sizes (recent_developments max 6, key_people max 5, etc)", () => {
    const tooMany = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        headline: `H${i}`,
        why_it_matters: "Reason that is at least ten chars long.",
      }));
    const input = {
      overview: "x".repeat(50),
      recent_developments: tooMany(20),
      key_people: Array.from({ length: 10 }, (_, i) => ({
        name: `P${i}`,
        role: `R${i}`,
        background_snippet: "Some background.",
      })),
      culture_signals: ["a", "b", "c", "d", "e", "f", "g", "h"],
      strategic_context: "x".repeat(50),
      questions_this_creates: ["Q1?", "Q2?", "Q3?", "Q4?", "Q5?"].map((q) => q + " more text here"),
    };
    const out = sanitizeCompanyIntel(input) as {
      recent_developments: unknown[];
      key_people: unknown[];
      culture_signals: unknown[];
      questions_this_creates: unknown[];
    };
    expect(out.recent_developments.length).toBe(6);
    expect(out.key_people.length).toBe(5);
    expect(out.culture_signals.length).toBe(6);
    expect(out.questions_this_creates.length).toBe(4);
  });

  it("drops key_people entries missing required fields", () => {
    const input = {
      overview: "x".repeat(50),
      recent_developments: [],
      key_people: [
        { name: "Valid", role: "CPO", background_snippet: "Real bg." },
        { name: "No bg", role: "CFO" },
        { role: "No name", background_snippet: "x" },
        { name: "x", background_snippet: "y" },
      ],
      culture_signals: [],
      strategic_context: "x".repeat(50),
      questions_this_creates: [],
    };
    const out = sanitizeCompanyIntel(input) as { key_people: unknown[] };
    expect(out.key_people.length).toBe(1);
  });

  it("truncates oversize overview / strategic_context to 2000 chars", () => {
    const input = {
      overview: "x".repeat(5000),
      recent_developments: [],
      key_people: [],
      culture_signals: [],
      strategic_context: "y".repeat(5000),
      questions_this_creates: [],
    };
    const out = sanitizeCompanyIntel(input) as { overview: string; strategic_context: string };
    expect(out.overview.length).toBe(2000);
    expect(out.strategic_context.length).toBe(2000);
  });

  it("returns non-object input unchanged (let schema reject it)", () => {
    expect(sanitizeCompanyIntel(null)).toBe(null);
    expect(sanitizeCompanyIntel("string")).toBe("string");
    expect(sanitizeCompanyIntel(42)).toBe(42);
    expect(sanitizeCompanyIntel([1, 2])).toEqual([1, 2]);
  });
});
