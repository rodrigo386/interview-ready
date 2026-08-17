import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes de INTEGRAÇÃO dos dois gates de dinheiro — `retryPrep` (cobra?) e
 * `deleteFailedPrep` (devolve?). A lógica pura já é coberta por
 * `src/lib/billing/credit-lifecycle.test.ts`; o que falta é justamente o fio
 * que liga a decisão à chamada real de `consumePrepCredit` /
 * `creditPrepRefundUnconditional` dentro da server action — registrado como
 * dívida nas rodadas 1-3 e onde os erros de cobrança de fato aconteceram.
 *
 * O Supabase é substituído por um builder falso que registra cada operação,
 * então cada teste pode afirmar tanto o efeito no crédito quanto o que foi
 * (ou não foi) escrito/apagado na linha.
 */

type Op = {
  table: string;
  verb: "select" | "insert" | "update" | "delete";
  payload?: Record<string, unknown>;
  filters: Record<string, unknown>;
};
type Handler = (op: Op) => { data: unknown; error: unknown };

const NOW = Date.now();
const HORA_ATRAS = new Date(NOW - 60 * 60 * 1000).toISOString();
const AGORA = new Date(NOW).toISOString();
const T_CONSUMO = "2026-08-17T10:00:00.000Z";
const T_DEVOLUCAO = "2026-08-17T10:05:00.000Z";

let ops: Op[] = [];
let handler: Handler = () => ({ data: null, error: null });

function makeBuilder(table: string) {
  const op: Op = { table, verb: "select", filters: {} };
  const b = {
    select: () => b,
    insert: (p: Record<string, unknown>) => ((op.verb = "insert"), (op.payload = p), b),
    update: (p: Record<string, unknown>) => ((op.verb = "update"), (op.payload = p), b),
    delete: () => ((op.verb = "delete"), b),
    eq: (c: string, v: unknown) => ((op.filters[c] = v), b),
    is: (c: string, v: unknown) => ((op.filters[c] = v), b),
    order: () => b,
    single: () => b,
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      ops.push({ ...op, filters: { ...op.filters } });
      return Promise.resolve()
        .then(() => handler(op))
        .then(res, rej);
    },
  };
  return b;
}

const fakeClient = {
  from: (table: string) => makeBuilder(table),
  auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient }));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: async () => ({ success: true, reset: 0 }),
  LIMITS: { createPrep: {} },
  formatResetPhrase: () => "1 minuto",
}));
vi.mock("./generation", () => ({ runGeneration: async () => undefined }));

const consumePrepCredit = vi.fn(async () => true);
const refundPrepCredit = vi.fn(async () => undefined);
const creditPrepRefundUnconditional = vi.fn(async () => undefined);
vi.mock("@/lib/billing/consume", () => ({
  consumePrepCredit: (...a: unknown[]) => consumePrepCredit(...(a as [])),
  refundPrepCredit: (...a: unknown[]) => refundPrepCredit(...(a as [])),
  creditPrepRefundUnconditional: (...a: unknown[]) =>
    creditPrepRefundUnconditional(...(a as [])),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;${url}`;
    throw err;
  },
}));

import { retryPrep, deleteFailedPrep } from "./actions";

/** Roda a action tratando o `redirect()` como desfecho, não como erro. */
async function run<T>(fn: () => Promise<T>): Promise<{ value?: T; redirect?: string }> {
  try {
    return { value: await fn() };
  } catch (err) {
    const digest = (err as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;")) {
      return { redirect: digest.slice("NEXT_REDIRECT;".length) };
    }
    throw err;
  }
}

type SessionRow = {
  generation_status: string | null;
  updated_at?: string | null;
  credit_consumed_at?: string | null;
  credit_refunded_at?: string | null;
};

/** Banco falso: uma sessão, um profile, e updates/deletes que sempre pegam. */
function comBanco(session: SessionRow, opts: { prepCredits?: number; isAdmin?: boolean } = {}) {
  handler = (op) => {
    if (op.table === "profiles") {
      return {
        data: { prep_credits: opts.prepCredits ?? 1, is_admin: opts.isAdmin ?? false },
        error: null,
      };
    }
    if (op.verb === "select") {
      return {
        data: {
          id: "p1",
          user_id: "u1",
          error_message: null,
          prep_guide: null,
          created_at: HORA_ATRAS,
          updated_at: session.updated_at ?? HORA_ATRAS,
          credit_consumed_at: null,
          credit_refunded_at: null,
          ...session,
        },
        error: null,
      };
    }
    if (op.verb === "delete") {
      return {
        data: [
          {
            id: "p1",
            credit_consumed_at: session.credit_consumed_at ?? null,
            credit_refunded_at: session.credit_refunded_at ?? null,
          },
        ],
        error: null,
      };
    }
    // update (cadeado do reset) — ganha a corrida
    return { data: [{ id: "p1" }], error: null };
  };
}

const resets = () => ops.filter((o) => o.verb === "update" && o.table === "prep_sessions");
const deletes = () => ops.filter((o) => o.verb === "delete" && o.table === "prep_sessions");

beforeEach(() => {
  ops = [];
  consumePrepCredit.mockClear().mockResolvedValue(true);
  refundPrepCredit.mockClear();
  creditPrepRefundUnconditional.mockClear();
});

describe("retryPrep — de onde sai a decisão de cobrar", () => {
  it("falhou E o crédito voltou pro saldo: cobra a nova tentativa", async () => {
    comBanco({
      generation_status: "failed",
      credit_consumed_at: T_CONSUMO,
      credit_refunded_at: T_DEVOLUCAO,
    });
    const out = await run(() => retryPrep("p1", {}, new FormData()));
    expect(consumePrepCredit).toHaveBeenCalledTimes(1);
    expect(consumePrepCredit).toHaveBeenCalledWith(fakeClient, "u1", "p1", false);
    expect(out.redirect).toBe("/prep/p1");
  });

  it("status 'failed' mas a devolução NUNCA aconteceu: não cobra de novo", async () => {
    // O buraco que o `generation_status` sozinho não via: a classificação
    // antiga chamava isso de `failed_refunded` e cobrava — a pessoa pagava
    // duas vezes pela preparação que não recebeu.
    comBanco({
      generation_status: "failed",
      credit_consumed_at: T_CONSUMO,
      credit_refunded_at: null,
    });
    const out = await run(() => retryPrep("p1", {}, new FormData()));
    expect(consumePrepCredit).not.toHaveBeenCalled();
    expect(resets()).toHaveLength(1);
    expect(out.redirect).toBe("/prep/p1");
  });

  it("zumbi que morreu ANTES de consumir: cobra, senão gera de graça", async () => {
    // Processo morto entre o INSERT e o RPC de consumo. Pelo status é
    // idêntico ao zumbi já pago abaixo; pelas colunas, não é.
    comBanco({
      generation_status: "pending",
      updated_at: HORA_ATRAS,
      credit_consumed_at: null,
      credit_refunded_at: null,
    });
    await run(() => retryPrep("p1", {}, new FormData()));
    expect(consumePrepCredit).toHaveBeenCalledTimes(1);
  });

  it("zumbi que já tinha consumido: não cobra, já pagou por esta preparação", async () => {
    comBanco({
      generation_status: "pending",
      updated_at: HORA_ATRAS,
      credit_consumed_at: T_CONSUMO,
      credit_refunded_at: null,
    });
    await run(() => retryPrep("p1", {}, new FormData()));
    expect(consumePrepCredit).not.toHaveBeenCalled();
    expect(resets()).toHaveLength(1);
  });

  it("sem saldo quando a tentativa é cobrável: barra sem tocar na linha", async () => {
    comBanco(
      {
        generation_status: "failed",
        credit_consumed_at: T_CONSUMO,
        credit_refunded_at: T_DEVOLUCAO,
      },
      { prepCredits: 0 },
    );
    const out = await run(() => retryPrep("p1", {}, new FormData()));
    expect(out.value).toEqual({ error: "quota_exceeded" });
    expect(consumePrepCredit).not.toHaveBeenCalled();
    expect(resets()).toHaveLength(0);
  });

  it("geração em andamento (pending recente): recusa sem cobrar nem resetar", async () => {
    comBanco({
      generation_status: "generating",
      updated_at: AGORA,
      credit_consumed_at: T_CONSUMO,
      credit_refunded_at: null,
    });
    const out = await run(() => retryPrep("p1", {}, new FormData()));
    expect(out.redirect).toBe("/prep/p1");
    expect(consumePrepCredit).not.toHaveBeenCalled();
    expect(resets()).toHaveLength(0);
  });
});

describe("deleteFailedPrep — de onde sai a decisão de devolver", () => {
  it("prep ENTREGUE (outra aba terminou): não apaga e não devolve", async () => {
    // Aba A parada na tela de falha, aba B tentou de novo (cobrou 1) e deu
    // certo. Sem esta guarda, o clique em "excluir" na aba A apagava a
    // preparação entregue e ainda devolvia o crédito dela.
    comBanco({
      generation_status: "complete",
      credit_consumed_at: T_CONSUMO,
      credit_refunded_at: null,
    });
    const out = await run(() => deleteFailedPrep("p1"));
    expect(deletes()).toHaveLength(0);
    expect(creditPrepRefundUnconditional).not.toHaveBeenCalled();
    expect(out.redirect).toBe("/prep/p1");
  });

  it("falha com crédito pendente de uso: apaga e devolve", async () => {
    comBanco({
      generation_status: "failed",
      credit_consumed_at: T_CONSUMO,
      credit_refunded_at: null,
    });
    const out = await run(() => deleteFailedPrep("p1"));
    expect(deletes()).toHaveLength(1);
    expect(creditPrepRefundUnconditional).toHaveBeenCalledWith(fakeClient, "u1", false);
    expect(out.redirect).toBe("/prep/new");
  });

  it("falha cujo crédito já voltou: apaga e NÃO devolve de novo", async () => {
    comBanco({
      generation_status: "failed",
      credit_consumed_at: T_CONSUMO,
      credit_refunded_at: T_DEVOLUCAO,
    });
    await run(() => deleteFailedPrep("p1"));
    expect(deletes()).toHaveLength(1);
    expect(creditPrepRefundUnconditional).not.toHaveBeenCalled();
  });

  it("sessão que nunca consumiu crédito: apaga e não devolve nada", async () => {
    comBanco({
      generation_status: "failed",
      credit_consumed_at: null,
      credit_refunded_at: null,
    });
    await run(() => deleteFailedPrep("p1"));
    expect(deletes()).toHaveLength(1);
    expect(creditPrepRefundUnconditional).not.toHaveBeenCalled();
  });

  it("geração em andamento: não apaga por baixo do pipeline", async () => {
    comBanco({
      generation_status: "generating",
      updated_at: AGORA,
      credit_consumed_at: T_CONSUMO,
      credit_refunded_at: null,
    });
    const out = await run(() => deleteFailedPrep("p1"));
    expect(deletes()).toHaveLength(0);
    expect(creditPrepRefundUnconditional).not.toHaveBeenCalled();
    expect(out.redirect).toBe("/prep/p1");
  });
});
