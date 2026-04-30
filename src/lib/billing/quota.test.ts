import { describe, expect, it } from "vitest";
import {
  checkQuota,
  isNewBillingCycle,
  PRO_MONTHLY_SOFT_CAP,
  type ProfileBilling,
} from "./quota";

const NOW = new Date("2026-04-26T12:00:00Z");

function profile(overrides: Partial<ProfileBilling> = {}): ProfileBilling {
  return {
    subscription_status: "none",
    preps_used_this_month: 0,
    preps_reset_at: "2026-04-01T00:00:00Z",
    prep_credits: 0,
    preps_this_billing_cycle: 0,
    billing_cycle_started_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

describe("checkQuota", () => {
  it("pro active is allowed below the soft cap", () => {
    const res = checkQuota(profile({ subscription_status: "active", preps_used_this_month: 999 }), NOW);
    expect(res).toEqual({ allowed: true, mode: "pro" });
  });

  it("pro active hits soft cap exactly at PRO_MONTHLY_SOFT_CAP", () => {
    const res = checkQuota(
      profile({
        subscription_status: "active",
        preps_this_billing_cycle: PRO_MONTHLY_SOFT_CAP,
      }),
      NOW,
    );
    expect(res).toEqual({ allowed: false, mode: "pro_soft_cap" });
  });

  it("pro overdue ALSO subject to soft cap (no free pass during dunning)", () => {
    const res = checkQuota(
      profile({
        subscription_status: "overdue",
        preps_this_billing_cycle: PRO_MONTHLY_SOFT_CAP + 5,
      }),
      NOW,
    );
    expect(res).toEqual({ allowed: false, mode: "pro_soft_cap" });
  });

  it("pro overdue still allowed (dunning grace)", () => {
    const res = checkQuota(profile({ subscription_status: "overdue" }), NOW);
    expect(res).toEqual({ allowed: true, mode: "pro" });
  });

  it("free with 0 used is allowed", () => {
    const res = checkQuota(profile({ preps_used_this_month: 0 }), NOW);
    expect(res).toEqual({ allowed: true, mode: "free" });
  });

  it("free with 1 used and no credits is blocked (no monthly reset)", () => {
    const res = checkQuota(profile({ preps_used_this_month: 1 }), NOW);
    expect(res).toEqual({ allowed: false, mode: "block" });
  });

  it("free with credits is allowed via credit", () => {
    const res = checkQuota(profile({ preps_used_this_month: 1, prep_credits: 2 }), NOW);
    expect(res).toEqual({ allowed: true, mode: "credit" });
  });

  it("preps_reset_at is ignored (lifetime quota, not 30-day cycle)", () => {
    const res = checkQuota(
      profile({ preps_used_this_month: 5, preps_reset_at: "2025-01-01T00:00:00Z" }),
      NOW,
    );
    expect(res).toEqual({ allowed: false, mode: "block" });
  });

  it("canceled status with usage is blocked", () => {
    const res = checkQuota(
      profile({ subscription_status: "canceled", preps_used_this_month: 1 }),
      NOW,
    );
    expect(res).toEqual({ allowed: false, mode: "block" });
  });

  it("expired status with usage is blocked", () => {
    const res = checkQuota(
      profile({ subscription_status: "expired", preps_used_this_month: 1 }),
      NOW,
    );
    expect(res).toEqual({ allowed: false, mode: "block" });
  });
});

describe("isNewBillingCycle", () => {
  it("same calendar month -> false", () => {
    expect(
      isNewBillingCycle(
        new Date("2026-04-01T00:00:00Z"),
        new Date("2026-04-30T23:59:59Z"),
      ),
    ).toBe(false);
  });

  it("crossed calendar month -> true", () => {
    expect(
      isNewBillingCycle(
        new Date("2026-04-30T23:59:59Z"),
        new Date("2026-05-01T00:00:01Z"),
      ),
    ).toBe(true);
  });

  it("crossed year boundary -> true", () => {
    expect(
      isNewBillingCycle(
        new Date("2026-12-31T23:59:59Z"),
        new Date("2027-01-01T00:00:01Z"),
      ),
    ).toBe(true);
  });

  it("same month different year -> true", () => {
    expect(
      isNewBillingCycle(
        new Date("2025-04-15T00:00:00Z"),
        new Date("2026-04-15T00:00:00Z"),
      ),
    ).toBe(true);
  });
});
