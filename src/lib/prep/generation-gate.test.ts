import { describe, it, expect } from "vitest";
import { isPrepGenerating } from "./generation-gate";

describe("isPrepGenerating", () => {
  it("prep normal gerando: generating, sem guide, ATS ainda não rodou → true", () => {
    expect(
      isPrepGenerating({ generationStatus: "generating", prepGuide: null, atsStatus: null }),
    ).toBe(true);
  });

  it("prep normal completa: generation_status complete → false, mesmo sem guide/ATS", () => {
    expect(
      isPrepGenerating({
        generationStatus: "complete",
        prepGuide: { meta: { role: "x" } },
        atsStatus: "complete",
      }),
    ).toBe(false);
  });

  it("prep reivindicada da ferramenta anônima, sem pipeline disparado → false (não deve gatear)", () => {
    expect(
      isPrepGenerating({ generationStatus: "pending", prepGuide: null, atsStatus: "complete" }),
    ).toBe(false);
  });

  it("prep genuinamente travada: pending, sem guide, ATS não veio pronto → true", () => {
    expect(
      isPrepGenerating({ generationStatus: "pending", prepGuide: null, atsStatus: null }),
    ).toBe(true);
  });

  it("failed nunca é 'gerando'", () => {
    expect(
      isPrepGenerating({ generationStatus: "failed", prepGuide: null, atsStatus: null }),
    ).toBe(false);
  });

  it("a assinatura de 'reivindicada' exige as três condições juntas — guide presente ainda gateia", () => {
    expect(
      isPrepGenerating({
        generationStatus: "pending",
        prepGuide: { meta: { role: "x" } },
        atsStatus: "complete",
      }),
    ).toBe(true);
  });

  it("a assinatura de 'reivindicada' exige as três condições juntas — ATS não completo ainda gateia", () => {
    expect(
      isPrepGenerating({ generationStatus: "pending", prepGuide: null, atsStatus: "generating" }),
    ).toBe(true);
  });
});
