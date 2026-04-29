// src/lib/billing/webhook.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { verifyToken, dispatchEvent } from "./webhook";
import type { AsaasWebhookEvent } from "./types";

beforeEach(() => {
  vi.stubEnv("ASAAS_API_KEY", "k");
  vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "expected-token");
  vi.stubEnv("ASAAS_BASE_URL", "https://sandbox.asaas.com/api/v3");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
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
  insertEvent: { sql: string; args: unknown[] }[];
  updateProfile: { sql: string; args: unknown[] }[];
  upsertPayment: { sql: string; args: unknown[] }[];
};

function fakeSupabase(opts: {
  eventInsertConflict?: boolean;
  /** Override what `from('profiles').select(...).eq(col, val).single()` returns.
   *  Used to test the customer-mismatch defense and reverse customer lookup. */
  profileSelectByCol?: (col: string, val: unknown) => unknown;
} = {}) {
  const calls: DbCalls = { insertEvent: [], updateProfile: [], upsertPayment: [] };
  const supa = {
    from: (table: string) => ({
      insert: (row: unknown) => ({
        select: () => ({
          single: async () => {
            if (table === "subscription_events") {
              calls.insertEvent.push({ sql: "insert", args: [row] });
              if (opts.eventInsertConflict) {
                return { data: null, error: { code: "23505" } };
              }
              return { data: row, error: null };
            }
            return { data: row, error: null };
          },
        }),
        then(resolve: (v: unknown) => void) {
          resolve({ data: null, error: null });
        },
      }),
      upsert: (row: unknown) => ({
        then(resolve: (v: unknown) => void) {
          calls.upsertPayment.push({ sql: "upsert", args: [row] });
          resolve({ data: null, error: null });
        },
      }),
      update: (patch: unknown) => ({
        eq: (_col: string, _val: unknown) => ({
          then(resolve: (v: unknown) => void) {
            calls.updateProfile.push({ sql: "update", args: [patch] });
            resolve({ data: null, error: null });
          },
        }),
      }),
      select: () => ({
        eq: (col: string, val: unknown) => ({
          single: async () => {
            if (opts.profileSelectByCol) {
              return { data: opts.profileSelectByCol(col, val), error: null };
            }
            return { data: { id: "u1", asaas_customer_id: null, prep_credits: 0 }, error: null };
          },
        }),
      }),
    }),
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

  it("PAYMENT_RECEIVED with pro:uid sets tier=pro + writes payment", async () => {
    const { supa, calls } = fakeSupabase();
    const evt: AsaasWebhookEvent = {
      event: "PAYMENT_RECEIVED",
      payment: { id: "p1", customer: "c1", value: 30, status: "RECEIVED",
        billingType: "PIX", externalReference: "pro:u1", nextDueDate: "2026-05-25" },
    };
    const result = await dispatchEvent(evt, "evt_2", supa as never);
    expect(result.handled).toBe(true);
    expect(calls.upsertPayment.length).toBe(1);
    expect(calls.updateProfile.length).toBe(1);
    const patch = calls.updateProfile[0].args[0] as Record<string, unknown>;
    expect(patch.tier).toBe("pro");
    expect(patch.subscription_status).toBe("active");
  });

  it("PAYMENT_RECEIVED with prep:uid:nano increments credits", async () => {
    const { supa, calls } = fakeSupabase();
    const evt: AsaasWebhookEvent = {
      event: "PAYMENT_RECEIVED",
      payment: { id: "p2", customer: "c1", value: 10, status: "RECEIVED",
        billingType: "PIX", externalReference: "prep:u1:n1" },
    };
    const result = await dispatchEvent(evt, "evt_3", supa as never);
    expect(result.handled).toBe(true);
    const patch = calls.updateProfile[0].args[0] as Record<string, unknown>;
    expect(patch).toHaveProperty("prep_credits");
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
      expect(calls.upsertPayment.length).toBe(0);
      expect(calls.updateProfile.length).toBe(0);
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
      expect(calls.upsertPayment.length).toBe(1);
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
      expect(calls.upsertPayment.length).toBe(1);
    });
  });
});
