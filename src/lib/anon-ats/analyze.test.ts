import { describe, it, expect } from "vitest";
import { analyzeAnonAts } from "./analyze";

const input = {
  cvText: "Analista de RH com 8 anos de experiência em recrutamento e seleção.",
  jobDescription: "Gerente de RH generalista, foco em cultura e desempenho.",
  jobTitle: "esta vaga",
  companyName: "a empresa",
};

const valido = {
  score: 62,
  title_match: { cv_title: "Analista de RH", jd_title: "Gerente de RH", match_score: 40 },
  keyword_analysis: { critical: [], high: [], medium: [] },
  top_fixes: [],
  overall_assessment:
    "O currículo cobre parte dos termos da vaga, mas falta vocabulário de gestão.",
};

describe("analyzeAnonAts", () => {
  it("devolve a análise quando o Gemini responde válido", async () => {
    const r = await analyzeAnonAts(input, {
      callGemini: async () => valido,
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.analysis).toEqual(valido);
  });

  it("devolve erro em PT-BR quando o Gemini falha", async () => {
    const r = await analyzeAnonAts(input, {
      callGemini: async () => {
        throw new Error("503 overloaded");
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tente/i);
  });

  it("aceita top_fixes vazio — CV que casa perfeitamente", async () => {
    const r = await analyzeAnonAts(input, {
      callGemini: async () => ({ ...valido, score: 94, top_fixes: [] }),
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.analysis.top_fixes).toEqual([]);
  });
});
