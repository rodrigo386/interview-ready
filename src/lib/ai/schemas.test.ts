import { describe, it, expect } from "vitest";
import { prepGuideSchema, atsAnalysisSchema } from "./schemas";

const validCard = {
  id: "q-why-this-role",
  question: "Why are you interested in this role?",
  key_points: ["fit with CV", "growth trajectory", "company mission"],
  sample_answer:
    "I've been following the company's work on X for the last year. Given my 8 years at Y leading Z, I see strong alignment with the role's focus on...",
  tips: "Lead with a specific company fact, then tie to your experience.",
  confidence_level: "high" as const,
  references_cv: ["Y 2018-2026 — Z initiative", "published talk at W"],
};

const validSection = {
  id: "likely-questions",
  title: "Likely Questions",
  icon: "💬",
  summary: "Core behavioral and role-fit questions interviewers open with.",
  cards: [validCard],
};

const validGuide = {
  meta: { role: "Senior Director", company: "Acme", estimated_prep_time_minutes: 45 },
  sections: [validSection, validSection, validSection],
};

describe("prepGuideSchema", () => {
  it("accepts a valid guide", () => {
    expect(() => prepGuideSchema.parse(validGuide)).not.toThrow();
  });

  it("accepts guide with fewer than 3 sections (partial during generation)", () => {
    expect(() =>
      prepGuideSchema.parse({ ...validGuide, sections: [validSection] }),
    ).not.toThrow();
  });

  it("accepts guide with zero sections (initial state)", () => {
    expect(() =>
      prepGuideSchema.parse({ ...validGuide, sections: [] }),
    ).not.toThrow();
  });

  it("rejects guide with more than 7 sections", () => {
    const tooMany = Array.from({ length: 8 }, () => validSection);
    expect(() =>
      prepGuideSchema.parse({ ...validGuide, sections: tooMany }),
    ).toThrow();
  });

  it("rejects guide missing meta.role", () => {
    const g = JSON.parse(JSON.stringify(validGuide));
    delete g.meta.role;
    expect(() => prepGuideSchema.parse(g)).toThrow();
  });

  it("rejects card with empty key_points", () => {
    const g = JSON.parse(JSON.stringify(validGuide));
    g.sections[0].cards[0].key_points = [];
    expect(() => prepGuideSchema.parse(g)).toThrow();
  });

  it("rejects card with invalid confidence_level", () => {
    const g = JSON.parse(JSON.stringify(validGuide));
    g.sections[0].cards[0].confidence_level = "maybe";
    expect(() => prepGuideSchema.parse(g)).toThrow();
  });

  it("rejects section with zero cards", () => {
    const g = JSON.parse(JSON.stringify(validGuide));
    g.sections[0].cards = [];
    expect(() => prepGuideSchema.parse(g)).toThrow();
  });

  it("rejects sample_answer shorter than 50 chars", () => {
    const g = JSON.parse(JSON.stringify(validGuide));
    g.sections[0].cards[0].sample_answer = "Too short.";
    expect(() => prepGuideSchema.parse(g)).toThrow();
  });
});

const validAts = {
  score: 73,
  title_match: { cv_title: "Head of Procurement", jd_title: "Senior Director, AI Procurement", match_score: 60 },
  keyword_analysis: {
    critical: [{ keyword: "agentic AI", found: false }, { keyword: "AI Sourcing Agents", found: false }],
    high: [{ keyword: "procurement transformation", found: true, context: "led Bayer transformation" }],
    medium: [{ keyword: "change management", found: true }],
  },
  top_fixes: [{
    priority: 1,
    gap: "Missing: agentic AI",
    original_cv_language: "digital tools",
    jd_language: "agentic AI",
    suggested_rewrite: "Deployed agentic AI workflows across sourcing and category management at Bayer.",
  }],
  overall_assessment: "Strong experience but vocabulary mismatch on AI-specific terms will lose ATS ranking.",
};

describe("atsAnalysisSchema", () => {
  it("accepts a valid analysis", () => {
    expect(() => atsAnalysisSchema.parse(validAts)).not.toThrow();
  });
  it("rejects score > 100", () => {
    expect(() => atsAnalysisSchema.parse({ ...validAts, score: 150 })).toThrow();
  });
  it("rejects top_fixes empty", () => {
    expect(() => atsAnalysisSchema.parse({ ...validAts, top_fixes: [] })).toThrow();
  });
  it("rejects suggested_rewrite shorter than 20 chars", () => {
    const g = JSON.parse(JSON.stringify(validAts));
    g.top_fixes[0].suggested_rewrite = "short";
    expect(() => atsAnalysisSchema.parse(g)).toThrow();
  });
});
