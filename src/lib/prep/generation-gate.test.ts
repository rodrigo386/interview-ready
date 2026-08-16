import { describe, it, expect } from "vitest";
import { isPrepGenerating } from "./generation-gate";

describe("isPrepGenerating", () => {
  it("prep normal gerando: generating, sem guide, ATS ainda não rodou → true", () => {
    expect(
      isPrepGenerating({
        generationStatus: "generating",
        prepGuide: null,
        atsStatus: null,
        companyIntelStatus: "researching",
      }),
    ).toBe(true);
  });

  it("prep normal completa: generation_status complete → false, mesmo sem guide/ATS", () => {
    expect(
      isPrepGenerating({
        generationStatus: "complete",
        prepGuide: { meta: { role: "x" } },
        atsStatus: "complete",
        companyIntelStatus: "complete",
      }),
    ).toBe(false);
  });

  it("prep reivindicada da ferramenta anônima, sem pipeline disparado → false (não deve gatear)", () => {
    expect(
      isPrepGenerating({
        generationStatus: "pending",
        prepGuide: null,
        atsStatus: "complete",
        companyIntelStatus: null,
      }),
    ).toBe(false);
  });

  it("prep normal em retry tem as MESMAS 3 primeiras colunas e ainda assim gateia", () => {
    // `retryPrep` grava pending + prep_guide null; com o ATS já rodado, as
    // três primeiras condições batem com as de uma prep reivindicada. O
    // company_intel_status herdado da geração anterior é o que separa.
    expect(
      isPrepGenerating({
        generationStatus: "pending",
        prepGuide: null,
        atsStatus: "complete",
        companyIntelStatus: "failed",
      }),
    ).toBe(true);
  });

  it("prep genuinamente travada: pending, sem guide, ATS não veio pronto → true", () => {
    expect(
      isPrepGenerating({
        generationStatus: "pending",
        prepGuide: null,
        atsStatus: null,
        companyIntelStatus: null,
      }),
    ).toBe(true);
  });

  it("failed nunca é 'gerando'", () => {
    expect(
      isPrepGenerating({
        generationStatus: "failed",
        prepGuide: null,
        atsStatus: null,
        companyIntelStatus: null,
      }),
    ).toBe(false);
  });

  it("a assinatura de 'reivindicada' exige as condições juntas — guide presente ainda gateia", () => {
    expect(
      isPrepGenerating({
        generationStatus: "pending",
        prepGuide: { meta: { role: "x" } },
        atsStatus: "complete",
        companyIntelStatus: null,
      }),
    ).toBe(true);
  });

  it("a assinatura de 'reivindicada' exige as condições juntas — ATS não completo ainda gateia", () => {
    expect(
      isPrepGenerating({
        generationStatus: "pending",
        prepGuide: null,
        atsStatus: "generating",
        companyIntelStatus: null,
      }),
    ).toBe(true);
  });
});
