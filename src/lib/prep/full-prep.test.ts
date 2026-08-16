import { describe, expect, it } from "vitest";
import { decideFullPrepGeneration, shouldOfferFullPrep } from "./full-prep";
import { isPrepGenerating } from "./generation-gate";

const claimed = {
  generationStatus: "pending" as const,
  prepGuide: null,
  atsStatus: "complete",
};

describe("decideFullPrepGeneration", () => {
  it("libera a geração pra prep reivindicada (pending + guide nulo + ATS pronto)", () => {
    expect(decideFullPrepGeneration(claimed)).toEqual({ kind: "generate" });
  });

  it("não libera prep normal recém-criada, cujo pipeline já está a caminho", () => {
    expect(
      decideFullPrepGeneration({ ...claimed, atsStatus: null }),
    ).toEqual({ kind: "not_eligible" });
  });

  it("não libera enquanto o pipeline está rodando", () => {
    expect(
      decideFullPrepGeneration({ ...claimed, generationStatus: "generating" }),
    ).toEqual({ kind: "already_running" });
  });

  it("não libera prep já gerada", () => {
    expect(
      decideFullPrepGeneration({
        generationStatus: "complete",
        prepGuide: { meta: {}, sections: [] },
        atsStatus: "complete",
      }),
    ).toEqual({ kind: "already_generated" });
  });

  it("trata guide presente como já gerado mesmo com status incoerente", () => {
    // Estado observado quando o pipeline morre entre o primeiro update
    // (guide vazio + generating) e o fim: gerar de novo por cima seria
    // trabalho jogado fora e cota queimada. O caminho aqui é o retryPrep.
    expect(
      decideFullPrepGeneration({
        generationStatus: "pending",
        prepGuide: { meta: {}, sections: [] },
        atsStatus: "complete",
      }),
    ).toEqual({ kind: "already_generated" });
  });

  it("manda prep falhada pro caminho do retryPrep, não pra esta action", () => {
    expect(
      decideFullPrepGeneration({ ...claimed, generationStatus: "failed" }),
    ).toEqual({ kind: "not_eligible" });
  });
});

describe("shouldOfferFullPrep", () => {
  it("só oferece o CTA no mesmo estado em que a action aceita gerar", () => {
    expect(shouldOfferFullPrep(claimed)).toBe(true);
    expect(shouldOfferFullPrep({ ...claimed, atsStatus: "failed" })).toBe(false);
    expect(
      shouldOfferFullPrep({ ...claimed, generationStatus: "complete" }),
    ).toBe(false);
  });

  it("é o complemento exato do gate do layout: ou mostra skeleton, ou oferece gerar", () => {
    // Invariante que impede regressão: se o layout considera a prep
    // "gerando", ela não pode simultaneamente exibir o CTA de gerar.
    expect(isPrepGenerating(claimed)).toBe(false);
    expect(shouldOfferFullPrep(claimed)).toBe(true);

    const gerando = { ...claimed, generationStatus: "generating" as const };
    expect(isPrepGenerating(gerando)).toBe(true);
    expect(shouldOfferFullPrep(gerando)).toBe(false);
  });
});
