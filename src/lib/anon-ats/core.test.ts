import { describe, it, expect } from "vitest";
import {
  normalizeAnonInput,
  resolveAnonLabels,
  isExpired,
  expiresAtFrom,
  anonAnalysisToPrepSession,
  MAX_CV_CHARS,
} from "./core";

const cv = "Analista de RH com 8 anos de experiência em recrutamento.";
const jd = "Buscamos Gerente de RH generalista com foco em cultura.";

describe("normalizeAnonInput", () => {
  it("aceita entrada válida e apara espaços", () => {
    const r = normalizeAnonInput({ cvText: `  ${cv}  `, jobDescription: jd });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cvText).toBe(cv);
  });

  it("recusa currículo vazio", () => {
    const r = normalizeAnonInput({ cvText: "   ", jobDescription: jd });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/currículo/i);
  });

  it("recusa vaga vazia", () => {
    const r = normalizeAnonInput({ cvText: cv, jobDescription: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/vaga/i);
  });

  it("recusa currículo curto demais pra ser um CV", () => {
    const r = normalizeAnonInput({ cvText: "meu cv", jobDescription: jd });
    expect(r.ok).toBe(false);
  });

  it("corta currículo gigante no limite", () => {
    const r = normalizeAnonInput({
      cvText: "a".repeat(MAX_CV_CHARS + 5000),
      jobDescription: jd,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cvText.length).toBe(MAX_CV_CHARS);
  });

  it("usa rótulos neutros quando vaga e empresa não vêm", () => {
    const r = normalizeAnonInput({ cvText: cv, jobDescription: jd });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.jobTitle).toBe("esta vaga");
      expect(r.value.companyName).toBe("a empresa");
    }
  });
});

describe("isExpired", () => {
  const agora = new Date("2026-08-15T12:00:00Z");

  it("considera expirada uma linha com prazo no passado", () => {
    expect(isExpired("2026-08-14T12:00:00Z", agora)).toBe(true);
  });

  it("mantém válida uma linha dentro do prazo", () => {
    expect(isExpired("2026-08-20T12:00:00Z", agora)).toBe(false);
  });

  it("expiresAtFrom devolve 7 dias à frente", () => {
    expect(expiresAtFrom(agora)).toBe(new Date("2026-08-22T12:00:00Z").toISOString());
  });
});

describe("anonAnalysisToPrepSession", () => {
  const analysis = { score: 62, top_fixes: [] } as never;
  const row = {
    cv_text: cv,
    job_description: jd,
    job_title: "Gerente de RH",
    company_name: "Acme",
    analysis,
  };

  it("nasce com o ATS pronto e a prep por gerar", () => {
    const insert = anonAnalysisToPrepSession(row, "user-1");
    expect(insert.user_id).toBe("user-1");
    expect(insert.ats_status).toBe("complete");
    expect(insert.ats_analysis).toBe(analysis);
    expect(insert.generation_status).toBe("pending");
    expect(insert.prep_guide).toBeNull();
  });

  it("preserva o texto original sem re-executar nada", () => {
    const insert = anonAnalysisToPrepSession(row, "user-1");
    expect(insert.cv_text).toBe(cv);
    expect(insert.job_description).toBe(jd);
  });
});

describe("resolveAnonLabels", () => {
  // O schema completo é grande e irrelevante aqui: resolveAnonLabels só lê
  // jd_context e title_match.jd_title.
  const analise = (patch: Record<string, unknown>) =>
    ({
      score: 70,
      title_match: { cv_title: "analista", jd_title: "", match_score: 50 },
      keyword_analysis: { critical: [], high: [], medium: [] },
      top_fixes: [],
      overall_assessment: "x".repeat(40),
      ...patch,
    }) as never;

  it("usa cargo e empresa extraídos da vaga", () => {
    const r = resolveAnonLabels(
      analise({ jd_context: { role: "Analista de Logística", company: "Molem Planten" } }),
    );
    expect(r).toEqual({
      jobTitle: "Analista de Logística",
      companyName: "Molem Planten",
    });
  });

  it("ignora o eco do placeholder — o bug que gravou 'a empresa · esta vaga'", () => {
    // Observado em produção: sem cargo declarado na vaga, o modelo devolvia
    // o TARGET ROLE recebido no prompt.
    const r = resolveAnonLabels(
      analise({
        jd_context: { role: "esta vaga", company: "a empresa" },
        title_match: { cv_title: "x", jd_title: "esta vaga", match_score: 0 },
      }),
    );
    expect(r).toEqual({ jobTitle: "esta vaga", companyName: "a empresa" });
  });

  it("cai no jd_title quando jd_context não veio (resposta de fallback)", () => {
    const r = resolveAnonLabels(
      analise({ title_match: { cv_title: "x", jd_title: "REGIONAL PROCUREMENT MANAGER", match_score: 40 } }),
    );
    expect(r.jobTitle).toBe("REGIONAL PROCUREMENT MANAGER");
    expect(r.companyName).toBe("a empresa");
  });

  it("limpa aspas, marcadores e espaço duplicado", () => {
    const r = resolveAnonLabels(
      analise({ jd_context: { role: '  "ANALISTA   DE LOGÍSTICA" ', company: "- Amazon •" } }),
    );
    expect(r.jobTitle).toBe("ANALISTA DE LOGÍSTICA");
    expect(r.companyName).toBe("Amazon");
  });

  it("recusa parágrafo no lugar de rótulo", () => {
    // company_name alimenta a pesquisa de empresa do pipeline: um texto longo
    // aqui vira busca lixo num entregável pago.
    const r = resolveAnonLabels(
      analise({ jd_context: { role: "x".repeat(200), company: "y".repeat(130) } }),
    );
    expect(r).toEqual({ jobTitle: "esta vaga", companyName: "a empresa" });
  });

  it("recusa frase — rótulo não termina em pontuação final", () => {
    const r = resolveAnonLabels(
      analise({
        jd_context: { role: "A vaga não informa o cargo.", company: "Não foi possível identificar!" },
      }),
    );
    expect(r).toEqual({ jobTitle: "esta vaga", companyName: "a empresa" });
  });

  it("trata 'n/a' e 'não informado' como ausência", () => {
    const r = resolveAnonLabels(
      analise({ jd_context: { role: "N/A", company: "não informado" } }),
    );
    expect(r).toEqual({ jobTitle: "esta vaga", companyName: "a empresa" });
  });

  it("aceita empresa mesmo quando o cargo falta, e vice-versa", () => {
    expect(
      resolveAnonLabels(analise({ jd_context: { role: "", company: "Amazon" } })),
    ).toEqual({ jobTitle: "esta vaga", companyName: "Amazon" });
    expect(
      resolveAnonLabels(analise({ jd_context: { role: "Vendedor de Loja", company: "" } })),
    ).toEqual({ jobTitle: "Vendedor de Loja", companyName: "a empresa" });
  });
});
