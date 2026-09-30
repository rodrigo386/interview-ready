import { describe, expect, it } from "vitest";
import { buildCvRewritePrompt } from "./cv-rewriter";

const base = {
  cvText: "Gerente de supermercado na Cia Zaffari.",
  jobDescription: "vaga de gerente geral de supermercado",
  jobTitle: "Gerente geral",
  companyName: "Zaffari",
  topFixes: [],
};

describe("buildCvRewritePrompt", () => {
  it("não força o currículo em inglês", () => {
    const { system } = buildCvRewritePrompt(base);
    expect(system).not.toMatch(/English only/i);
  });

  it("segue o idioma da vaga, com o currículo como desempate", () => {
    const { system } = buildCvRewritePrompt(base);
    expect(system).toMatch(/language of the JOB DESCRIPTION/);
    expect(system).toMatch(/language of the ORIGINAL CV/);
    expect(system).toMatch(/Resumo Profissional/);
  });

  it("resumo de mudanças sempre em português", () => {
    const { system } = buildCvRewritePrompt(base);
    expect(system).toMatch(/summary_of_changes: .*Brazilian Portuguese/);
  });
});
