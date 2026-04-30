export type ProfileBilling = {
  subscription_status: "active" | "overdue" | "canceled" | "expired" | "none" | null;
  preps_used_this_month: number;
  preps_reset_at: string;
  prep_credits: number;
  /** Pro soft cap counter: incremented per prep generated under "pro" mode. */
  preps_this_billing_cycle: number;
  /** ISO timestamp of the start of the current cycle (calendar month). */
  billing_cycle_started_at: string;
};

export type QuotaCheck =
  | { allowed: true; mode: "pro" | "free" | "credit" }
  | { allowed: false; mode: "block" | "pro_soft_cap" };

/**
 * Soft monthly cap on Pro accounts. Hourly rate limit (createPrep 3/h)
 * stops acute spikes; this stops sustained abuse over a billing cycle.
 * Pro power users do 5–15 preps/month, so 50 covers 99% and still bounds
 * a malicious or runaway subscription before it burns more than R$30 in
 * Gemini tokens.
 */
export const PRO_MONTHLY_SOFT_CAP = 50;

/**
 * True when `started` and `now` are NOT in the same calendar month
 * (server-local time). Lazy reset trigger — first prep of a new month
 * zeroes `preps_this_billing_cycle` before the cap check.
 */
export function isNewBillingCycle(started: Date, now: Date): boolean {
  return (
    started.getUTCFullYear() !== now.getUTCFullYear() ||
    started.getUTCMonth() !== now.getUTCMonth()
  );
}

/**
 * Quota rule (post-2026-04-30):
 * - Pro / overdue: unlimited within billing cycle, capped at PRO_MONTHLY_SOFT_CAP.
 * - Free tier: 1 lifetime prep tied to the account (no monthly reset).
 * - Per-use credits: spend before falling through to block.
 *
 * `preps_used_this_month` is kept as the column name for compat, but it now
 * represents lifetime free preps consumed (0 or 1).
 * `preps_reset_at` is no longer consulted; left in place for historical data.
 *
 * Cycle reset is handled lazily by the caller: if `isNewBillingCycle` is
 * true, the caller should reset `preps_this_billing_cycle` to 0 BEFORE
 * calling this function. Passing a fresh `0` here when a reset is due
 * lets `checkQuota` stay pure.
 */
export function checkQuota(p: ProfileBilling, _now: Date): QuotaCheck {
  if (p.subscription_status === "active" || p.subscription_status === "overdue") {
    if (p.preps_this_billing_cycle >= PRO_MONTHLY_SOFT_CAP) {
      return { allowed: false, mode: "pro_soft_cap" };
    }
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
