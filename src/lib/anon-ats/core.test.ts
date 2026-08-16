import { describe, it, expect } from "vitest";
import {
  normalizeAnonInput,
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
