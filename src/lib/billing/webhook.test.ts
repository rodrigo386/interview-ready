// src/lib/billing/webhook.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { verifyToken, dispatchEvent } from "./webhook";
import type { AsaasWebhookEvent } from "./types";
import { trackServer } from "@/lib/analytics/server";

vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.stubEnv("ASAAS_API_KEY", "k");
  vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "expected-token");
  vi.stubEnv("ASAAS_BASE_URL", "https://sandbox.asaas.com/api/v3");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.mocked(trackServer).mockClear();
});

describe("verifyToken", () => {
  it("returns true on exact match", () => {
    expect(verifyToken("expected-token")).toBe(true);
  });
  it("returns false on mismatch", () => {
    expect(verifyToken("wrong")).toBe(false);
  });
  it("returns false on empty", () => {
    expect(verifyToken("")).toBe(false);
    expect(verifyToken(null)).toBe(false);
    expect(verifyToken(undefined)).toBe(false);
  });
});

type DbCalls = {
  insertEvent: { args: unknown[] }[];
  /** All supabase.rpc(name, args) calls captured for assertion. */
  rpc: { name: string; args: Record<string, unknown> }[];
};

function fakeSupabase(opts: {
  eventInsertConflict?: boolean;
  /** Override what `from('profiles').select(...).eq(col, val).single()` returns. */
  profileSelectByCol?: (col: string, val: unknown) => unknown;
  /** Make a specific RPC return an error to test the failure path. */
  rpcError?: (name: string) => string | null;
  /**
   * Override what a given RPC call returns as `data`. Defaults to
   * `args.p_credits` for `handle_payment_received` (as if this were the
   * first, credit-granting call for the payment — matches migration 0024's
   * `handle_payment_received`, which returns `p_credits` the first time and
   * `0` on every subsequent call for the same payment) and `null` for
   * everything else.
   */
  rpcData?: (name: string, args: Record<string, unknown>) => unknown;
} = {}) {
  const calls: DbCalls = { insertEvent: [], rpc: [] };
  const supa = {
    from: (table: string) => ({
      insert: (row: unknown) => ({
        select: () => ({
          single: async () => {
            if (table === "subscription_events") {
              calls.insertEvent.push({ args: [row] });
              if (opts.eventInsertConflict) {
                return { data: null, error: { code: "23505" } };
              }
              return { data: row, error: null };
            }
            return { data: row, error: null };
          },
        }),
      }),
      select: () => ({
        eq: (col: string, val: unknown) => {
          const resolver = async () => {
            // For affiliate tables, return null (no referral) so commission code path exits cleanly
            if (
              table === "affiliate_referrals" ||
              table === "affiliate_partners" ||
              table === "affiliate_commissions"
            ) {
              return { data: null, error: null };
            }
            if (opts.profileSelectByCol) {
              return { data: opts.profileSelectByCol(col, val), error: null };
            }
            return { data: { id: "u1", asaas_customer_id: null, prep_credits: 0 }, error: null };
          };
          return {
            single: resolver,
            maybeSingle: resolver,
          };
        },
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.rpc.push({ name, args });
      const err = opts.rpcError?.(name);
      if (err) return { data: null, error: { message: err } };
      const data = opts.rpcData
        ? opts.rpcData(name, args)
        : name === "handle_payment_received"
          ? (args.p_credits ?? 1)
          : null;
      return { data, error: null };
    },
  };
  return { supa, calls };
}

describe("dispatchEvent", () => {
  it("idempotency: returns 'duplicate' on event_id conflict", async () => {
    const { supa } = fakeSupabase({ eventInsertConflict: true });
    const evt: AsaasWebhookEvent = {
      event: "PAYMENT_RECEIVED",
      payment: { id: "p1", customer: "c1", value: 30, status: "RECEIVED",
        billingType: "PIX", externalReference: "pro:u1" },
    };
    const result = await dispatchEvent(evt, "evt_1", supa as never);
    expect(result.handled).toBe(false);
    if (!result.handled) expect(result.reason).toBe("duplicate");
  });

  it("PAYMENT_RECEIVED with pro:uid calls handle_payment_received with kind=pro_subscription", async () => {
    const { supa, calls } = fakeSupabase();
    const evt: AsaasWebhookEvent = {
      event: "PAYMENT_RECEIVED",
      payment: { id: "p1", customer: "c1", value: 30, status: "RECEIVED",
        billingType: "PIX", externalReference: "pro:u1", nextDueDate: "2026-05-25" },
    };
    const result = await dispatchEvent(evt, "evt_2", supa as never);
    expect(result.handled).toBe(true);
    expect(calls.rpc.length).toBe(1);
    expect(calls.rpc[0].name).toBe("handle_payment_received");
    expect(calls.rpc[0].args).toMatchObject({
      p_user_id: "u1",
      p_payment_id: "p1",
      p_kind: "pro_subscription",
      p_amount_cents: 3000,
      p_next_due_date: "2026-05-25",
    });
  });

  it("PAYMENT_RECEIVED with prep:uid:nano calls handle_payment_received with kind=prep_purchase", async () => {
    const { supa, calls } = fakeSupabase();
    const evt: AsaasWebhookEvent = {
      event: "PAYMENT_RECEIVED",
      payment: { id: "p2", customer: "c1", value: 10, status: "RECEIVED",
        billingType: "PIX", externalReference: "prep:u1:n1" },
    };
    const result = await dispatchEvent(evt, "evt_3", supa as never);
    expect(result.handled).toBe(true);
    expect(calls.rpc[0].args).toMatchObject({
      p_kind: "prep_purchase",
      p_amount_cents: 1000,
      // No nextDueDate for prep_purchase.
      p_next_due_date: null,
    });
  });

  it("returns handled=false reason='error' when RPC fails (transactional rollback)", async () => {
    const { supa, calls } = fakeSupabase({
      rpcError: (name) => (name === "handle_payment_received" ? "deadlock detected" : null),
    });
    const evt: AsaasWebhookEvent = {
      event: "PAYMENT_RECEIVED",
      payment: { id: "p1", customer: "c1", value: 30, status: "RECEIVED",
        billingType: "PIX", externalReference: "pro:u1" },
    };
    const result = await dispatchEvent(evt, "evt_rpc_err", supa as never);
    expect(result.handled).toBe(false);
    if (!result.handled) {
      expect(result.reason).toBe("error");
      expect(result.detail).toMatch(/deadlock/);
    }
    expect(calls.rpc.length).toBe(1);
  });

  it("unknown event returns handled=false reason='unhandled'", async () => {
    const { supa } = fakeSupabase();
    const evt = { event: "SOMETHING_NEW" } as AsaasWebhookEvent;
    const result = await dispatchEvent(evt, "evt_4", supa as never);
    expect(result).toEqual({ handled: false, reason: "unhandled" });
  });

  describe("customer cross-check (token-leak mitigation)", () => {
    it("rejects event when externalReference uid doesn't match payment.customer's profile", async () => {
      // Profile u1 belongs to a different Asaas customer than the event claims.
      const { supa, calls } = fakeSupabase({
        profileSelectByCol: (col) =>
          col === "id"
            ? { asaas_customer_id: "cus_LEGITIMATE" }
            : { id: "u1", asaas_customer_id: "cus_LEGITIMATE", prep_credits: 0 },
      });
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_RECEIVED",
        payment: {
          id: "p1",
          customer: "cus_FORGED",
          value: 30,
          status: "RECEIVED",
          billingType: "PIX",
          externalReference: "pro:u1",
        },
      };
      const result = await dispatchEvent(evt, "evt_xcheck", supa as never);
      expect(result.handled).toBe(false);
      if (!result.handled) {
        expect(result.reason).toBe("error");
        expect(result.detail).toMatch(/customer mismatch/i);
      }
      expect(calls.rpc.length).toBe(0);
    });

    it("accepts event when customer matches profile.asaas_customer_id", async () => {
      const { supa, calls } = fakeSupabase({
        profileSelectByCol: (col) =>
          col === "id"
            ? { asaas_customer_id: "cus_OK" }
            : { id: "u1", asaas_customer_id: "cus_OK", prep_credits: 0 },
      });
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_RECEIVED",
        payment: {
          id: "p2",
          customer: "cus_OK",
          value: 30,
          status: "RECEIVED",
          billingType: "PIX",
          externalReference: "pro:u1",
        },
      };
      const result = await dispatchEvent(evt, "evt_xcheck_ok", supa as never);
      expect(result.handled).toBe(true);
      expect(calls.rpc.length).toBe(1);
      expect(calls.rpc[0].name).toBe("handle_payment_received");
    });

    it("skips check when profile has no asaas_customer_id yet (first-time customer)", async () => {
      // First payment scenario: webhook arrives before our checkout had a chance
      // to persist the customer id. Allow through, no mismatch error.
      const { supa, calls } = fakeSupabase({
        profileSelectByCol: () => ({ asaas_customer_id: null, prep_credits: 0 }),
      });
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_RECEIVED",
        payment: {
          id: "p3",
          customer: "cus_NEW",
          value: 30,
          status: "RECEIVED",
          billingType: "PIX",
          externalReference: "pro:u1",
        },
      };
      const result = await dispatchEvent(evt, "evt_first", supa as never);
      expect(result.handled).toBe(true);
      expect(calls.rpc.length).toBe(1);
      expect(calls.rpc[0].name).toBe("handle_payment_received");
    });
  });

  describe("crédito por quantidade", () => {
    it("passa p_credits igual à quantidade do externalReference", async () => {
      const { supa, calls } = fakeSupabase();
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_RECEIVED",
        payment: { id: "p1", customer: "c1", value: 25, status: "RECEIVED",
          billingType: "PIX", externalReference: "prep:u1:3:abc" },
      };
      const result = await dispatchEvent(evt, "evt_qty_3", supa as never);
      expect(result.handled).toBe(true);
      expect(calls.rpc[0].args).toMatchObject({ p_credits: 3 });
    });

    it("formato antigo credita 1", async () => {
      const { supa, calls } = fakeSupabase();
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_RECEIVED",
        payment: { id: "p2", customer: "c1", value: 10, status: "RECEIVED",
          billingType: "PIX", externalReference: "prep:u1:abc" },
      };
      const result = await dispatchEvent(evt, "evt_qty_legacy", supa as never);
      expect(result.handled).toBe(true);
      expect(calls.rpc[0].args).toMatchObject({ p_credits: 1 });
    });

    it("handle_payment_refunded também recebe p_credits da quantidade", async () => {
      const { supa, calls } = fakeSupabase();
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_REFUNDED",
        payment: { id: "p3", customer: "c1", value: 25, status: "REFUNDED",
          billingType: "PIX", externalReference: "prep:u1:3:abc" },
      };
      const result = await dispatchEvent(evt, "evt_refund_qty_3", supa as never);
      expect(result.handled).toBe(true);
      expect(calls.rpc[0].name).toBe("handle_payment_refunded");
      expect(calls.rpc[0].args).toMatchObject({ p_credits: 3 });
    });
  });

  describe("checkout_confirmado (Task 9)", () => {
    it("dispara pra prep_purchase com qty e cents do pagamento", async () => {
      const { supa } = fakeSupabase();
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_RECEIVED",
        payment: { id: "p1", customer: "c1", value: 25, status: "RECEIVED",
          billingType: "PIX", externalReference: "prep:u1:3:abc" },
      };
      const result = await dispatchEvent(evt, "evt_confirmado_1", supa as never);
      expect(result.handled).toBe(true);
      expect(trackServer).toHaveBeenCalledWith("u1", "checkout_confirmado", {
        qty: 3,
        cents: 2500,
      });
    });

    it("NÃO dispara pra pro_subscription (tem subscription_started próprio)", async () => {
      const { supa } = fakeSupabase();
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_RECEIVED",
        payment: { id: "p2", customer: "c1", value: 30, status: "RECEIVED",
          billingType: "PIX", externalReference: "pro:u1" },
      };
      const result = await dispatchEvent(evt, "evt_confirmado_2", supa as never);
      expect(result.handled).toBe(true);
      const confirmadoCalls = vi
        .mocked(trackServer)
        .mock.calls.filter(([, event]) => event === "checkout_confirmado");
      expect(confirmadoCalls).toEqual([]);
    });

    it("uma falha no trackServer não derruba o processamento do pagamento", async () => {
      vi.mocked(trackServer).mockImplementationOnce(() => {
        throw new Error("PostHog indisponível");
      });
      const { supa, calls } = fakeSupabase();
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_RECEIVED",
        payment: { id: "p3", customer: "c1", value: 10, status: "RECEIVED",
          billingType: "PIX", externalReference: "prep:u1:1:abc" },
      };
      const result = await dispatchEvent(evt, "evt_confirmado_3", supa as never);
      expect(result.handled).toBe(true);
      expect(calls.rpc[0].name).toBe("handle_payment_received");
    });

    it("NÃO dispara quando o RPC devolve 0 créditos concedidos (PAYMENT_CONFIRMED + PAYMENT_RECEIVED do mesmo pagamento)", async () => {
      // handle_payment_received (migration 0024) devolve 0 na segunda
      // entrada do mesmo pagamento — o Asaas manda PAYMENT_CONFIRMED e
      // PAYMENT_RECEIVED separados pro mesmo pagamento de cartão, cada um
      // com asaas_event_id diferente, então a idempotência por evento não
      // filtra a segunda. Esta é a regressão que a correção evita: sem o
      // gate em creditsGranted > 0, este teste dispararia checkout_confirmado
      // de novo e contaria o mesmo pagamento 2x na métrica de conversão.
      const { supa, calls } = fakeSupabase({
        rpcData: (name) => (name === "handle_payment_received" ? 0 : null),
      });
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_CONFIRMED",
        payment: { id: "p4", customer: "c1", value: 10, status: "CONFIRMED",
          billingType: "CREDIT_CARD", externalReference: "prep:u1:1:abc" },
      };
      const result = await dispatchEvent(evt, "evt_confirmado_4", supa as never);
      expect(result.handled).toBe(true);
      expect(calls.rpc[0].name).toBe("handle_payment_received");
      const confirmadoCalls = vi
        .mocked(trackServer)
        .mock.calls.filter(([, event]) => event === "checkout_confirmado");
      expect(confirmadoCalls).toEqual([]);
    });

    it("dispara quando o RPC devolve créditos > 0 (primeira entrada do pagamento)", async () => {
      const { supa } = fakeSupabase({
        rpcData: (name, args) => (name === "handle_payment_received" ? args.p_credits : null),
      });
      const evt: AsaasWebhookEvent = {
        event: "PAYMENT_CONFIRMED",
        payment: { id: "p5", customer: "c1", value: 10, status: "CONFIRMED",
          billingType: "CREDIT_CARD", externalReference: "prep:u1:1:abc" },
      };
      const result = await dispatchEvent(evt, "evt_confirmado_5", supa as never);
      expect(result.handled).toBe(true);
      expect(trackServer).toHaveBeenCalledWith("u1", "checkout_confirmado", {
        qty: 1,
        cents: 1000,
      });
    });
  });
});
