import { describe, it, expect } from "vitest";
import { isPrepGenerating, isClaimedAtsOnlyPrep } from "./generation-gate";

/**
 * Base de uma prep que NUNCA teve o pipeline pago disparado — nem
 * `retryPrep` nem `generateFullPrep` tocaram nela. É a assinatura de TODA
 * prep recém-criada por `createPrep` (Task 5: só dispara o ATS grátis, não
 * o pipeline), e também da prep reivindicada da ferramenta ATS anônima.
 *
 * O estado do ATS é ortogonal a isso — `/prep/[id]/ats` já sabe renderizar
 * sozinho os 4 estados (null → CTA, generating → skeleton local, complete →
 * resultado, failed → retry grátis). O gate do layout não pode usar
 * `ats_status` pra decidir se HÁ um pipeline pago rodando, porque não há
 * relação: o ATS pode estar em qualquer estado sem que isso signifique nada
 * sobre o pipeline pago.
 */
const SEM_PIPELINE = {
  generationStatus: "pending" as const,
  prepGuide: null,
  companyIntelStatus: null,
};

describe("isPrepGenerating — prep sem pipeline pago disparado, nos 4 estados do ATS", () => {
  it("ats null (recém-criada, ATS ainda nem começou) → não gateia", () => {
    expect(isPrepGenerating({ ...SEM_PIPELINE, atsStatus: null })).toBe(false);
  });

  it("ats generating (ATS rodando em background) → não gateia", () => {
    // O bug corrigido nesta rodada: antes disso, isso caía no skeleton de
    // página inteira por até 15min e depois em PrepFailed — a análise
    // GRATUITA empurrando a pessoa pro paywall que a task existe pra adiar.
    expect(isPrepGenerating({ ...SEM_PIPELINE, atsStatus: "generating" })).toBe(false);
  });

  it("ats complete (ATS pronto) → não gateia", () => {
    expect(isPrepGenerating({ ...SEM_PIPELINE, atsStatus: "complete" })).toBe(false);
  });

  it("ats failed (ATS falhou) → não gateia", () => {
    // Mesma correção: falha na análise grátis não pode prender a pessoa —
    // `/prep/[id]/ats` já mostra `AtsFailed` com retry grátis pra este caso.
    expect(isPrepGenerating({ ...SEM_PIPELINE, atsStatus: "failed" })).toBe(false);
  });
});

describe("isPrepGenerating — não pode regredir", () => {
  it("prep normal gerando pela primeira vez: generating, sem guide, ATS ainda não rodou → true", () => {
    expect(
      isPrepGenerating({
        generationStatus: "generating",
        prepGuide: null,
        atsStatus: null,
        companyIntelStatus: "researching",
      }),
    ).toBe(true);
  });

  it("prep normal completa: complete → false, mesmo sem guide/ATS", () => {
    expect(
      isPrepGenerating({
        generationStatus: "complete",
        prepGuide: { meta: { role: "x" } },
        atsStatus: "complete",
        companyIntelStatus: "complete",
      }),
    ).toBe(false);
  });

  it("prep normal em retry: mesmas 3 primeiras colunas de uma sem-pipeline, mas companyIntelStatus preenchido gateia", () => {
    // `retryPrep` grava pending + prep_guide null; com o ATS já rodado, as
    // três primeiras condições batem com as de uma prep sem pipeline. O
    // company_intel_status herdado da geração anterior (nunca volta a NULL)
    // é o que separa: "já teve pipeline" vs "nunca teve".
    expect(
      isPrepGenerating({
        generationStatus: "pending",
        prepGuide: null,
        atsStatus: "complete",
        companyIntelStatus: "failed",
      }),
    ).toBe(true);
  });

  it("prep genuinamente travada — zumbi pós-claim do generateFullPrep: gateia", () => {
    // `generateFullPrep` grava um `prep_guide` placeholder (NÃO nulo) antes
    // de disparar o pipeline pago (full-prep-actions.ts). Se o processo
    // morrer entre essa claim e a primeira escrita do pipeline, a linha
    // fica presa em "pending" com o placeholder — real, recuperável só via
    // staleness + PrepFailed. `prep_guide` não-nulo é o que distingue este
    // caso de uma prep que nunca teve pipeline (lá é sempre null).
    expect(
      isPrepGenerating({
        generationStatus: "pending",
        prepGuide: { meta: { role: "x" } },
        atsStatus: "complete",
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
});

describe("isClaimedAtsOnlyPrep — só decide o CTA pago (full-prep.ts), continua exigindo ATS completo", () => {
  // Ao contrário de `isPrepGenerating`, esta função PRECISA continuar
  // exigindo `atsStatus === 'complete'`: ela decide se oferece o botão
  // "Gerar preparação completa" (que cobra), e isso só faz sentido depois
  // que a pessoa já viu o resultado do ATS grátis — oferecer o CTA pago
  // enquanto o ATS ainda roda distrairia do valor gratuito que a task 5
  // existe pra entregar primeiro.
  it("sem pipeline + ATS completo → true (oferece o CTA)", () => {
    expect(
      isClaimedAtsOnlyPrep({
        generationStatus: "pending",
        prepGuide: null,
        atsStatus: "complete",
        companyIntelStatus: null,
      }),
    ).toBe(true);
  });

  it("sem pipeline + ATS generating → false (não oferece o CTA antes do ATS terminar)", () => {
    expect(
      isClaimedAtsOnlyPrep({
        generationStatus: "pending",
        prepGuide: null,
        atsStatus: "generating",
        companyIntelStatus: null,
      }),
    ).toBe(false);
  });

  it("sem pipeline + ATS failed → false (não oferece o CTA antes do ATS terminar)", () => {
    expect(
      isClaimedAtsOnlyPrep({
        generationStatus: "pending",
        prepGuide: null,
        atsStatus: "failed",
        companyIntelStatus: null,
      }),
    ).toBe(false);
  });

  it("sem pipeline + ATS nulo → false (não oferece o CTA antes do ATS terminar)", () => {
    expect(
      isClaimedAtsOnlyPrep({
        generationStatus: "pending",
        prepGuide: null,
        atsStatus: null,
        companyIntelStatus: null,
      }),
    ).toBe(false);
  });

  it("guide presente (zumbi pós-claim) → false, mesmo com ATS completo", () => {
    expect(
      isClaimedAtsOnlyPrep({
        generationStatus: "pending",
        prepGuide: { meta: { role: "x" } },
        atsStatus: "complete",
        companyIntelStatus: null,
      }),
    ).toBe(false);
  });
});
