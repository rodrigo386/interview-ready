import { describe, it, expect, vi } from "vitest";
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
  it("usa o Cerebras quando ele responde válido, sem tocar no Gemini", async () => {
    const gemini = vi.fn();
    const r = await analyzeAnonAts(input, {
      callCerebras: async () => ({ ok: true, text: JSON.stringify(valido), modelId: "qwen" }),
      callGemini: gemini,
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.modelUsed).toBe("cerebras");
    expect(gemini).not.toHaveBeenCalled();
  });

  it("cai pro Gemini quando o Cerebras devolve JSON fora do schema", async () => {
    const r = await analyzeAnonAts(input, {
      callCerebras: async () => ({ ok: true, text: '{"score":"muito alto"}', modelId: "qwen" }),
      callGemini: async () => valido as never,
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.modelUsed).toBe("gemini");
  });

  it("cai pro Gemini quando o Cerebras está indisponível", async () => {
    const r = await analyzeAnonAts(input, {
      callCerebras: async () => ({ ok: false, reason: "all_failed" as const }),
      callGemini: async () => valido as never,
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.modelUsed).toBe("gemini");
  });

  it("devolve erro em PT-BR quando os dois falham", async () => {
    const r = await analyzeAnonAts(input, {
      callCerebras: async () => ({ ok: false, reason: "all_failed" as const }),
      callGemini: async () => {
        throw new Error("503 overloaded");
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tente/i);
  });

  it("aceita top_fixes vazio — CV que casa perfeitamente", async () => {
    const r = await analyzeAnonAts(input, {
      callCerebras: async () => ({
        ok: true,
        text: JSON.stringify({ ...valido, score: 94, top_fixes: [] }),
        modelId: "qwen",
      }),
      callGemini: vi.fn(),
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.analysis.top_fixes).toEqual([]);
  });
});
