export type ProfileBilling = {
  subscription_status: "active" | "overdue" | "canceled" | "expired" | "none" | null;
  preps_used_this_month: number;
  preps_reset_at: string;
  prep_credits: number;
};

export type QuotaCheck =
  | { allowed: true; mode: "pro" | "free" | "credit" }
  | { allowed: false; mode: "block" };

/**
 * Quota rule (post-2026-04-26):
 * - Pro / overdue: unlimited.
 * - Free tier: 1 lifetime prep tied to the account (no monthly reset).
 * - Per-use credits: spend before falling through to block.
 *
 * `preps_used_this_month` is kept as the column name for compat, but it now
 * represents lifetime free preps consumed (0 or 1).
 * `preps_reset_at` is no longer consulted; left in place for historical data.
 */
export function checkQuota(p: ProfileBilling, _now: Date): QuotaCheck {
  if (p.subscription_status === "active" || p.subscription_status === "overdue") {
    return { allowed: true, mode: "pro" };
  }
  if (p.preps_used_this_month < 1) {
    return { allowed: true, mode: "free" };
  }
  if (p.prep_credits > 0) {
    return { allowed: true, mode: "credit" };
  }
  return { allowed: false, mode: "block" };
}
