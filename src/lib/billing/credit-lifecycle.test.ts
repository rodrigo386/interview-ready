import { describe, it, expect } from "vitest";
import {
  isCreditOutstanding,
  shouldChargeRetry,
  shouldRefundOnDiscard,
  shouldRefundOnDelete,
} from "./credit-lifecycle";

const T = "2026-08-17T12:00:00.000Z";

describe("isCreditOutstanding", () => {
  it("consumido e não devolvido: pagou e não recebeu", () => {
    expect(isCreditOutstanding({ creditConsumedAt: T, creditRefundedAt: null })).toBe(true);
  });

  it("consumido e devolvido: já acertou as contas", () => {
    expect(isCreditOutstanding({ creditConsumedAt: T, creditRefundedAt: T })).toBe(false);
  });

  it("nunca consumido: não há dinheiro em jogo nesta sessão", () => {
    expect(isCreditOutstanding({ creditConsumedAt: null, creditRefundedAt: null })).toBe(false);
  });

  it("colunas ausentes do select: tratadas como nulas, sem crédito pendente", () => {
    expect(
      isCreditOutstanding({ creditConsumedAt: undefined, creditRefundedAt: undefined }),
    ).toBe(false);
  });
});

describe("shouldChargeRetry", () => {
  it("falhou E o crédito voltou: tentativa nova, cobra de novo", () => {
    expect(shouldChargeRetry({ creditConsumedAt: T, creditRefundedAt: T })).toBe(true);
  });

  it("falhou e a devolução NÃO aconteceu: já pagou por esta preparação, não cobra", () => {
    // O caso que o `generation_status` sozinho não distinguia: a linha diz
    // "failed" (a classificação antiga chamava de `failed_refunded`), mas o
    // RPC de devolução errou ou o processo morreu antes dele.
    expect(shouldChargeRetry({ creditConsumedAt: T, creditRefundedAt: null })).toBe(false);
  });

  it("zumbi que chegou a consumir: pagou e não recebeu, não cobra", () => {
    expect(shouldChargeRetry({ creditConsumedAt: T, creditRefundedAt: null })).toBe(false);
  });

  it("zumbi que morreu ANTES de consumir: nunca pagou, cobra", () => {
    // Processo morto entre o INSERT da sessão e o RPC de consumo — 15 min
    // depois a linha `pending` vira "tentar novamente". Pelo status era
    // indistinguível do caso acima; pelas colunas, não é.
    expect(shouldChargeRetry({ creditConsumedAt: null, creditRefundedAt: null })).toBe(true);
  });
});

describe("shouldRefundOnDiscard", () => {
  it("descartar uma sessão paga e não entregue devolve o crédito", () => {
    expect(shouldRefundOnDiscard({ creditConsumedAt: T, creditRefundedAt: null })).toBe(true);
  });

  it("não devolve duas vezes o que já foi devolvido", () => {
    expect(shouldRefundOnDiscard({ creditConsumedAt: T, creditRefundedAt: T })).toBe(false);
  });

  it("não devolve o que nunca foi consumido (sessão de admin, ou consumo que falhou)", () => {
    expect(shouldRefundOnDiscard({ creditConsumedAt: null, creditRefundedAt: null })).toBe(false);
  });
});

describe("shouldRefundOnDelete", () => {
  it("excluir uma sessão travada em 'generating' devolve o crédito", () => {
    // O cenário determinístico: um deploy mata o pipeline no meio, a pessoa
    // vê "Gerando…" travado e clica na lixeira do dashboard.
    expect(
      shouldRefundOnDelete({
        creditConsumedAt: T,
        creditRefundedAt: null,
        generationStatus: "generating",
      }),
    ).toBe(true);
  });

  it("excluir uma sessão 'failed' ainda não devolvida devolve o crédito", () => {
    expect(
      shouldRefundOnDelete({
        creditConsumedAt: T,
        creditRefundedAt: null,
        generationStatus: "failed",
      }),
    ).toBe(true);
  });

  it("excluir uma preparação ENTREGUE não devolve nada", () => {
    // Par de colunas idêntico ao do caso acima — só o status distingue. Sem
    // esta guarda, excluir uma prep completa (algo que a UI oferece em todo
    // card) pagaria de volta o que a pessoa já recebeu, e o PDF exportado
    // continuaria na máquina dela. Repetível: 1 crédito viraria saldo
    // infinito.
    expect(
      shouldRefundOnDelete({
        creditConsumedAt: T,
        creditRefundedAt: null,
        generationStatus: "complete",
      }),
    ).toBe(false);
  });

  it("entrega parcial já devolvida pelo pipeline não devolve de novo", () => {
    expect(
      shouldRefundOnDelete({
        creditConsumedAt: T,
        creditRefundedAt: T,
        generationStatus: "complete",
      }),
    ).toBe(false);
  });

  it("sessão que nunca consumiu (só ATS grátis, ou admin) não devolve nada", () => {
    expect(
      shouldRefundOnDelete({
        creditConsumedAt: null,
        creditRefundedAt: null,
        generationStatus: "pending",
      }),
    ).toBe(false);
  });
});
