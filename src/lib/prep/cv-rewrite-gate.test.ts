import { describe, expect, it } from "vitest";
import { canGenerateCvRewrite, decideCvRewriteAccess } from "./cv-rewrite-gate";

/**
 * Task 10 — o vazamento: `runCvRewrite` só checava `ats_status === "complete"`,
 * e como a análise ATS virou grátis, qualquer usuário logado gerava e baixava
 * o CV reescrito (o entregável dos R$10) sem pagar. O gate correto é
 * `prep_guide` não nulo: quem pagou gerou a preparação completa e já tem o
 * CV reescrito incluso; quem não pagou não tem `prep_guide`.
 *
 * Não consome nem devolve crédito aqui — só lê o que já está gravado. Os
 * três call sites (action, rota de download, página) usam esta mesma função.
 */
describe("decideCvRewriteAccess", () => {
  it("recusa quando a prep não tem prep_guide (não pagou a preparação completa)", () => {
    expect(
      decideCvRewriteAccess({ prepGuide: null, atsStatus: "complete" }),
    ).toEqual({ kind: "prep_guide_missing" });
  });

  it("permite quando tem prep_guide e o ATS está completo", () => {
    expect(
      decideCvRewriteAccess({
        prepGuide: { meta: {}, sections: [] },
        atsStatus: "complete",
      }),
    ).toEqual({ kind: "allowed" });
  });

  it("recusa quando tem prep_guide mas o ATS ainda não terminou — a reescrita depende da análise", () => {
    expect(
      decideCvRewriteAccess({
        prepGuide: { meta: {}, sections: [] },
        atsStatus: "generating",
      }),
    ).toEqual({ kind: "ats_not_complete" });

    expect(
      decideCvRewriteAccess({
        prepGuide: { meta: {}, sections: [] },
        atsStatus: null,
      }),
    ).toEqual({ kind: "ats_not_complete" });
  });

  it("recusa quando a prep não existe", () => {
    expect(decideCvRewriteAccess(null)).toEqual({ kind: "prep_not_found" });
  });
});

describe("canGenerateCvRewrite", () => {
  it("é o complemento booleano de decideCvRewriteAccess", () => {
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
