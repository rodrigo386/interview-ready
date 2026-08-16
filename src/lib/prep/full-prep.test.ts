import { describe, expect, it } from "vitest";
import { decideFullPrepGeneration, shouldOfferFullPrep } from "./full-prep";
import { isPrepGenerating, type GenerationGateInput } from "./generation-gate";

/**
 * Os quatro estados que precisam ser distinguidos. Os dois primeiros são os
 * que colidiam: `retryPrep` grava `pending` + `prep_guide: null`, e numa prep
 * cujo ATS já rodou o `ats_status` também é "complete" — as três primeiras
 * colunas ficam idênticas às de uma prep reivindicada. O que separa é
 * `company_intel_status`: NULL só em quem nunca teve pipeline.
 */
const REIVINDICADA: GenerationGateInput = {
  generationStatus: "pending",
  prepGuide: null,
  atsStatus: "complete",
  companyIntelStatus: null,
};

const NORMAL_EM_RETRY: GenerationGateInput = {
  generationStatus: "pending",
  prepGuide: null,
  atsStatus: "complete",
  // Ficou da geração anterior. `retryPrep` não zera essa coluna, e nada mais
  // no código a devolve pra NULL.
  companyIntelStatus: "complete",
};

const NORMAL_GERANDO_PRIMEIRA_VEZ: GenerationGateInput = {
  generationStatus: "generating",
  prepGuide: { meta: {}, sections: [] },
  atsStatus: null,
  companyIntelStatus: "researching",
};

const NORMAL_COMPLETA: GenerationGateInput = {
  generationStatus: "complete",
  prepGuide: { meta: {}, sections: [{}] },
  atsStatus: "complete",
  companyIntelStatus: "complete",
};

describe("os quatro estados", () => {
  it("prep reivindicada: oferece gerar, não gateia com skeleton", () => {
    expect(decideFullPrepGeneration(REIVINDICADA)).toEqual({ kind: "generate" });
    expect(shouldOfferFullPrep(REIVINDICADA)).toBe(true);
    expect(isPrepGenerating(REIVINDICADA)).toBe(false);
  });

  it("prep normal em retry: NUNCA oferece o CTA pago, e gateia com skeleton", () => {
    // O defeito: a regeração é gratuita e já está rodando. Oferecer "Gerar
    // preparação completa" aqui convida a pagar de novo quem já pagou — e se
    // o job de retry morre antes da primeira escrita do pipeline, o convite
    // fica permanente.
    expect(decideFullPrepGeneration(NORMAL_EM_RETRY)).toEqual({
      kind: "already_running",
    });
    expect(shouldOfferFullPrep(NORMAL_EM_RETRY)).toBe(false);
    expect(isPrepGenerating(NORMAL_EM_RETRY)).toBe(true);
  });

  it("prep normal gerando pela primeira vez: sem CTA, com skeleton", () => {
    expect(decideFullPrepGeneration(NORMAL_GERANDO_PRIMEIRA_VEZ)).toEqual({
      kind: "already_generated",
    });
    expect(shouldOfferFullPrep(NORMAL_GERANDO_PRIMEIRA_VEZ)).toBe(false);
    expect(isPrepGenerating(NORMAL_GERANDO_PRIMEIRA_VEZ)).toBe(true);
  });

  it("prep normal completa: sem CTA, sem skeleton", () => {
    expect(decideFullPrepGeneration(NORMAL_COMPLETA)).toEqual({
      kind: "already_generated",
    });
    expect(shouldOfferFullPrep(NORMAL_COMPLETA)).toBe(false);
    expect(isPrepGenerating(NORMAL_COMPLETA)).toBe(false);
  });

  it("o retry só é distinguível pelo company_intel_status", () => {
    // Prova de que as outras três colunas são idênticas nos dois casos: a
    // única diferença entre os objetos é a marca de "já teve pipeline".
    const { companyIntelStatus: _a, ...reivindicadaSemMarca } = REIVINDICADA;
    const { companyIntelStatus: _b, ...retrySemMarca } = NORMAL_EM_RETRY;
    expect(reivindicadaSemMarca).toEqual(retrySemMarca);
  });
});

describe("decideFullPrepGeneration — outros estados", () => {
  it("manda prep falhada pro caminho do retryPrep, não pra esta action", () => {
    expect(
      decideFullPrepGeneration({ ...REIVINDICADA, generationStatus: "failed" }),
    ).toEqual({ kind: "not_eligible" });
  });

  it("trata guide presente como já gerado mesmo com status incoerente", () => {
    // Estado observado quando o pipeline morre entre o primeiro update
    // (guide vazio + generating) e o fim: gerar de novo por cima seria
    // trabalho jogado fora e cota queimada. O caminho aqui é o retryPrep.
    expect(
      decideFullPrepGeneration({
        ...REIVINDICADA,
        prepGuide: { meta: {}, sections: [] },
      }),
    ).toEqual({ kind: "already_generated" });
  });

  it("não libera enquanto o ATS ainda não está pronto", () => {
    expect(shouldOfferFullPrep({ ...REIVINDICADA, atsStatus: "generating" })).toBe(
      false,
    );
    expect(shouldOfferFullPrep({ ...REIVINDICADA, atsStatus: "failed" })).toBe(false);
  });
});

describe("shouldOfferFullPrep", () => {
  it("é o complemento exato do gate do layout: ou mostra skeleton, ou oferece gerar", () => {
    // Invariante que impede regressão: uma prep nunca pode simultaneamente
    // estar "gerando" (skeleton) e exibir o CTA que dispara a geração.
    for (const estado of [
      REIVINDICADA,
      NORMAL_EM_RETRY,
      NORMAL_GERANDO_PRIMEIRA_VEZ,
      NORMAL_COMPLETA,
    ]) {
      expect(isPrepGenerating(estado) && shouldOfferFullPrep(estado)).toBe(false);
    }
  });
});
