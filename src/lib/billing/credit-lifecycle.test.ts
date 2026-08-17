import { describe, it, expect } from "vitest";
import {
  isCreditOutstanding,
  shouldChargeRetry,
  shouldRefundOnDiscard,
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
