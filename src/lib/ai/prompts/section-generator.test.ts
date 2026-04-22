import { describe, it, expect } from "vitest";
import { buildSectionPrompt } from "./section-generator";
import type { CompanyIntel } from "@/lib/ai/schemas";

const baseParams = {
  kind: "likely" as const,
  cvText: "CV content here",
  jdText: "JD content here",
  jobTitle: "Senior Director",
  companyName: "Acme",
};

const sampleIntel: CompanyIntel = {
  overview: "Acme is a $3B specialty chemicals company.",
  recent_developments: [
    { headline: "IPO filed", why_it_matters: "Liquidity pressure on leadership." },
  ],
  key_people: [
    { name: "Jane Doe", role: "CPO", background_snippet: "Ex-Bayer, joined 2024." },
  ],
  culture_signals: ["PE-owned speed"],
  strategic_context: "Targeting 2027 exit; needs EBITDA expansion.",
  questions_this_creates: ["How will the IPO timeline shape priorities?"],
};

describe("buildSectionPrompt", () => {
  it("omits COMPANY INTELLIGENCE block when intel is null", () => {
    const { user } = buildSectionPrompt({ ...baseParams, companyIntel: null });
    expect(user).not.toMatch(/COMPANY INTELLIGENCE/);
  });

  it("omits COMPANY INTELLIGENCE block when intel is undefined", () => {
    const { user } = buildSectionPrompt(baseParams);
    expect(user).not.toMatch(/COMPANY INTELLIGENCE/);
  });

  it("includes intel fields when companyIntel provided", () => {
    const { user } = buildSectionPrompt({ ...baseParams, companyIntel: sampleIntel });
    expect(user).toMatch(/COMPANY INTELLIGENCE/);
    expect(user).toContain("Acme is a $3B specialty chemicals");
    expect(user).toContain("IPO filed");
    expect(user).toContain("Jane Doe");
    expect(user).toContain("PE-owned speed");
    expect(user).toContain("2027 exit");
  });

  it("system prompt mentions COMPANY INTELLIGENCE guidance", () => {
    const { system } = buildSectionPrompt({ ...baseParams, companyIntel: sampleIntel });
    expect(system).toMatch(/COMPANY INTELLIGENCE/);
  });
});
