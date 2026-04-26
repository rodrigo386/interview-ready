import { describe, expect, it } from "vitest";
import { checkQuota, type ProfileBilling } from "./quota";

const NOW = new Date("2026-04-26T12:00:00Z");

function profile(overrides: Partial<ProfileBilling> = {}): ProfileBilling {
  return {
    subscription_status: "none",
    preps_used_this_month: 0,
    preps_reset_at: "2026-04-01T00:00:00Z",
    prep_credits: 0,
    ...overrides,
  };
}

describe("checkQuota", () => {
  it("pro active is always allowed", () => {
    const res = checkQuota(profile({ subscription_status: "active", preps_used_this_month: 999 }), NOW);
    expect(res).toEqual({ allowed: true, mode: "pro" });
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
