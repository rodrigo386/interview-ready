const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

export type ProfileBilling = {
  subscription_status: "active" | "overdue" | "canceled" | "expired" | "none" | null;
  preps_used_this_month: number;
  preps_reset_at: string;
  prep_credits: number;
};

export type QuotaCheck =
  | { allowed: true; mode: "pro" | "free" | "credit" | "reset" }
  | { allowed: false; mode: "block" };

export function checkQuota(p: ProfileBilling, now: Date): QuotaCheck {
  if (p.subscription_status === "active" || p.subscription_status === "overdue") {
    return { allowed: true, mode: "pro" };
  }
  const elapsed = now.getTime() - new Date(p.preps_reset_at).getTime();
  if (elapsed > MS_30_DAYS) {
    return { allowed: true, mode: "reset" };
  }
  if (p.preps_used_this_month < 1) {
    return { allowed: true, mode: "free" };
  }
  if (p.prep_credits > 0) {
    return { allowed: true, mode: "credit" };
  }
  return { allowed: false, mode: "block" };
}
