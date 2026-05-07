/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { recordCommission, recordClawback } from "./commission";

function makeSupabase(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    payment: { id: "pay-1", user_id: "user-1", amount_cents: 3000 },
    referral: { partner_id: "partner-1" },
    partner: { id: "partner-1", status: "active", commission_rate_pct: 30 },
    insertResult: { error: null },
    updateResult: { data: [{ id: "c-1" }], error: null },
  };
  const cfg: Record<string, any> = { ...defaults, ...overrides };

  const fromMock = vi.fn((table: string) => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.in = vi.fn().mockReturnValue(builder);
    builder.lt = vi.fn().mockReturnValue(builder);
    builder.is = vi.fn().mockReturnValue(builder);
    builder.maybeSingle = vi.fn(async () => {
      if (table === "payments") return { data: cfg.payment, error: null };
      if (table === "affiliate_referrals") return { data: cfg.referral, error: null };
      if (table === "affiliate_partners") return { data: cfg.partner, error: null };
      return { data: null, error: null };
    });
    builder.single = builder.maybeSingle;
    builder.insert = vi.fn(async () => cfg.insertResult);
    builder.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn(async () => cfg.updateResult),
      }),
    });
    return builder;
  });

  return { from: fromMock } as any;
}

describe("recordCommission", () => {
  it("inserts a pending commission for a referred payment", async () => {
    const sb = makeSupabase();
    const res = await recordCommission("pay-1", sb);
    expect(res.recorded).toBe(true);
  });

  it("skips when payment has no referral", async () => {
    const sb = makeSupabase({ referral: null });
    const res = await recordCommission("pay-1", sb);
    expect(res.recorded).toBe(false);
    if (!res.recorded) expect(res.reason).toBe("no_referral");
  });

  it("skips when partner is suspended", async () => {
    const sb = makeSupabase({
      partner: { id: "partner-1", status: "suspended", commission_rate_pct: 30 },
    });
    const res = await recordCommission("pay-1", sb);
    expect(res.recorded).toBe(false);
    if (!res.recorded) expect(res.reason).toBe("partner_inactive");
  });

  it("computes amount as commission_rate_pct of payment.amount_cents", async () => {
    const sb = makeSupabase({
      payment: { id: "pay-1", user_id: "user-1", amount_cents: 3000 },
      partner: { id: "partner-1", status: "active", commission_rate_pct: 30 },
    });
    const res = await recordCommission("pay-1", sb);
    expect(res.recorded).toBe(true);
    if (res.recorded) expect(res.amountCents).toBe(900);
  });

  it("returns already_recorded on UNIQUE violation", async () => {
    const sb = makeSupabase({
      insertResult: { error: { code: "23505", message: "duplicate key" } },
    });
    const res = await recordCommission("pay-1", sb);
    expect(res.recorded).toBe(false);
    if (!res.recorded) expect(res.reason).toBe("already_recorded");
  });
});

describe("recordClawback", () => {
  it("updates commission row to clawback status", async () => {
    const sb = makeSupabase();
    const res = await recordClawback("pay-1", sb);
    expect(res.clawed).toBe(true);
  });

  it("returns no_commission when no row exists", async () => {
    const sb = makeSupabase({
      updateResult: { data: [], error: null },
    });
    const res = await recordClawback("pay-1", sb);
    expect(res.clawed).toBe(false);
    if (!res.clawed) expect(res.reason).toBe("no_commission");
  });
});
