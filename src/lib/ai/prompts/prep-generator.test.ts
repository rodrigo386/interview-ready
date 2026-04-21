import { describe, it, expect } from "vitest";
import { buildPrepPrompt } from "./prep-generator";

describe("buildPrepPrompt", () => {
  const params = {
    cvText: "Rodrigo Costa — 10 years in procurement. Led Bayer digital transformation 2019-2022.",
    jdText: "Senior Director, AI & Digital Procurement Transformation at Hexion. $300M+ spend.",
    jobTitle: "Senior Director, AI & Digital Procurement",
    companyName: "Hexion",
  };

  it("includes CV, JD, role, and company in user message", () => {
    const { user } = buildPrepPrompt(params);
    expect(user).toContain("Rodrigo Costa");
    expect(user).toContain("Senior Director, AI & Digital Procurement Transformation at Hexion");
    expect(user).toContain("Senior Director, AI & Digital Procurement");
    expect(user).toContain("Hexion");
  });

  it("system prompt instructs JSON-only output", () => {
    const { system } = buildPrepPrompt(params);
    expect(system).toMatch(/Return ONLY the JSON object/i);
    expect(system).not.toMatch(/```json/);
  });

  it("system prompt enumerates required sections", () => {
    const { system } = buildPrepPrompt(params);
    expect(system).toContain("Likely Questions");
    expect(system).toContain("Deep Dive Questions");
    expect(system).toContain("Questions to Ask");
  });

  it("system prompt forbids generic advice", () => {
    const { system } = buildPrepPrompt(params);
    expect(system).toMatch(/NEVER generic/i);
  });
});
