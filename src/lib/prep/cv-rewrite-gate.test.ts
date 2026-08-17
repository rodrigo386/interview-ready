import { describe, expect, it } from "vitest";
import {
  canDownloadCvRewrite,
  canGenerateCvRewrite,
  decideCvRewriteDownload,
  decideCvRewriteGeneration,
} from "./cv-rewrite-gate";

/**
 * Task 10 — o vazamento: `runCvRewrite` só checava `ats_status === "complete"`,
 * e como a análise ATS virou grátis, qualquer usuário logado gerava e baixava
 * o CV reescrito (o entregável dos R$10) sem pagar. O gate correto é
 * `prep_guide` não nulo: quem pagou gerou a preparação completa e já tem o
 * CV reescrito incluso; quem não pagou não tem `prep_guide`.
 *
 * Não consome nem devolve crédito aqui — só lê o que já está gravado.
 *
 * Rodada de correção 1: GERAR e BAIXAR são decisões diferentes, não a mesma
 * função reaproveitada. Gerar depende do ATS (o prompt usa `top_fixes` da
 * análise). Baixar um arquivo que já existe não depende do ATS — só de a
 * pessoa ter direito (`prep_guide`) e do arquivo existir
 * (`cv_rewrite_status === "complete"`). Exigir `ats_status === "complete"`
 * pra baixar quebrava o acesso de quem já pagou e já tem o arquivo pronto
 * sempre que a pessoa clicava em "↻ Rerodar análise" (grava `ats_status:
 * "generating"`/`"failed"` sem tocar em `cv_rewrite_status`).
 */
describe("decideCvRewriteGeneration", () => {
  it("recusa quando a prep não tem prep_guide (não pagou a preparação completa)", () => {
    expect(
      decideCvRewriteGeneration({ prepGuide: null, atsStatus: "complete" }),
    ).toEqual({ kind: "prep_guide_missing" });
  });

  it("permite quando tem prep_guide e o ATS está completo", () => {
    expect(
      decideCvRewriteGeneration({
        prepGuide: { meta: {}, sections: [] },
        atsStatus: "complete",
      }),
    ).toEqual({ kind: "allowed" });
  });

  it("recusa quando tem prep_guide mas o ATS ainda não terminou — a reescrita depende da análise", () => {
    expect(
      decideCvRewriteGeneration({
        prepGuide: { meta: {}, sections: [] },
        atsStatus: "generating",
      }),
    ).toEqual({ kind: "ats_not_complete" });

    expect(
      decideCvRewriteGeneration({
        prepGuide: { meta: {}, sections: [] },
        atsStatus: null,
      }),
    ).toEqual({ kind: "ats_not_complete" });
  });

  it("recusa quando a prep não existe", () => {
    expect(decideCvRewriteGeneration(null)).toEqual({ kind: "prep_not_found" });
  });
});

describe("canGenerateCvRewrite", () => {
  it("é o complemento booleano de decideCvRewriteGeneration", () => {
    expect(
      canGenerateCvRewrite({ prepGuide: { meta: {}, sections: [] }, atsStatus: "complete" }),
    ).toBe(true);
    expect(canGenerateCvRewrite({ prepGuide: null, atsStatus: "complete" })).toBe(false);
    expect(
      canGenerateCvRewrite({ prepGuide: { meta: {}, sections: [] }, atsStatus: "failed" }),
    ).toBe(false);
    expect(canGenerateCvRewrite(null)).toBe(false);
  });
});

describe("decideCvRewriteDownload", () => {
  it("permite quando tem prep_guide e o arquivo está pronto", () => {
    expect(
      decideCvRewriteDownload({
        prepGuide: { meta: {}, sections: [] },
        cvRewriteStatus: "complete",
      }),
    ).toEqual({ kind: "allowed" });
  });

  it('permite mesmo com ats_status "generating"/"failed" — baixar não depende do ATS, só gerar depende', () => {
    // O tipo de entrada nem aceita `atsStatus`: baixar é decidido só por
    // `prepGuide` + `cvRewriteStatus`. Isso é o que corrige a brecha da
    // rodada 1 — "↻ Rerodar análise" grava ats_status generating/failed sem
    // tocar cv_rewrite_status, e o arquivo já gerado continua existindo.
    const sessaoComAtsRerodando = {
      prepGuide: { meta: {}, sections: [] },
      cvRewriteStatus: "complete",
    };
    expect(decideCvRewriteDownload(sessaoComAtsRerodando)).toEqual({ kind: "allowed" });
  });

  it("recusa quando a prep não tem prep_guide, mesmo com reescrita pronta — a brecha legada que esta task fecha", () => {
    expect(
      decideCvRewriteDownload({
        prepGuide: null,
        cvRewriteStatus: "complete",
      }),
    ).toEqual({ kind: "prep_guide_missing" });
  });

  it("recusa quando tem prep_guide mas o arquivo ainda não está pronto", () => {
    expect(
      decideCvRewriteDownload({
        prepGuide: { meta: {}, sections: [] },
        cvRewriteStatus: "generating",
      }),
    ).toEqual({ kind: "rewrite_not_ready" });

    expect(
      decideCvRewriteDownload({
        prepGuide: { meta: {}, sections: [] },
        cvRewriteStatus: null,
      }),
    ).toEqual({ kind: "rewrite_not_ready" });
  });

  it("recusa quando a prep não existe", () => {
    expect(decideCvRewriteDownload(null)).toEqual({ kind: "prep_not_found" });
  });
});

describe("canDownloadCvRewrite", () => {
  it("é o complemento booleano de decideCvRewriteDownload", () => {
    expect(
      canDownloadCvRewrite({
        prepGuide: { meta: {}, sections: [] },
        cvRewriteStatus: "complete",
      }),
    ).toBe(true);
    expect(
      canDownloadCvRewrite({ prepGuide: null, cvRewriteStatus: "complete" }),
    ).toBe(false);
    expect(
      canDownloadCvRewrite({
        prepGuide: { meta: {}, sections: [] },
        cvRewriteStatus: "failed",
      }),
    ).toBe(false);
    expect(canDownloadCvRewrite(null)).toBe(false);
  });
});
