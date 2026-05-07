import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartnerEarnings } from "./types";

export type RecordCommissionResult =
  | { recorded: true; amountCents: number; partnerId: string }
  | {
      recorded: false;
      reason: "no_payment" | "no_referral" | "partner_inactive" | "already_recorded" | "error";
      detail?: string;
    };

export type RecordClawbackResult =
  | { clawed: true }
  | { clawed: false; reason: "no_commission" | "error" };

const CONFIRM_WINDOW_DAYS = 7;

export async function recordCommission(
  paymentId: string,
  supabase: SupabaseClient,
): Promise<RecordCommissionResult> {
  const { data: payment, error: pErr } = await supabase
    .from("payments")
    .select("id, user_id, amount_cents")
    .eq("id", paymentId)
    .maybeSingle();
  if (pErr) return { recorded: false, reason: "error", detail: pErr.message };
  if (!payment) return { recorded: false, reason: "no_payment" };

  const { data: referral } = await supabase
    .from("affiliate_referrals")
    .select("partner_id")
    .eq("profile_id", payment.user_id)
    .maybeSingle();
  if (!referral) return { recorded: false, reason: "no_referral" };

  const { data: partner } = await supabase
    .from("affiliate_partners")
    .select("id, status, commission_rate_pct")
    .eq("id", referral.partner_id)
    .maybeSingle();
  if (!partner) return { recorded: false, reason: "no_referral" };
  if (partner.status !== "active") {
    return { recorded: false, reason: "partner_inactive" };
  }

  const amountCents = Math.floor(
    (payment.amount_cents * partner.commission_rate_pct) / 100,
  );

  const { error: insErr } = await supabase.from("affiliate_commissions").insert({
    partner_id: partner.id,
    payment_id: payment.id,
    amount_cents: amountCents,
    status: "pending",
  });
  if (insErr) {
    if ((insErr as { code?: string }).code === "23505") {
      return { recorded: false, reason: "already_recorded" };
    }
    return { recorded: false, reason: "error", detail: insErr.message };
  }

  return { recorded: true, amountCents, partnerId: partner.id };
}

export async function recordClawback(
  paymentId: string,
  supabase: SupabaseClient,
): Promise<RecordClawbackResult> {
  const { data, error } = await supabase
    .from("affiliate_commissions")
    .update({ status: "clawback" })
    .eq("payment_id", paymentId)
    .select("id");
  if (error) return { clawed: false, reason: "error" };
  if (!data || data.length === 0) return { clawed: false, reason: "no_commission" };
  return { clawed: true };
}

export async function confirmCommissions(
  supabase: SupabaseClient,
): Promise<{ confirmed: number }> {
  const cutoff = new Date(
    Date.now() - CONFIRM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase
    .from("affiliate_commissions")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  if (error) return { confirmed: 0 };
  return { confirmed: data?.length ?? 0 };
}

export async function getPartnerEarnings(
  partnerId: string,
  supabase: SupabaseClient,
): Promise<PartnerEarnings> {
  const { count: signupsTotal } = await supabase
    .from("affiliate_referrals")
    .select("profile_id", { count: "exact", head: true })
    .eq("partner_id", partnerId);

  const { data: referrals } = await supabase
    .from("affiliate_referrals")
    .select("profile_id")
    .eq("partner_id", partnerId);
  const profileIds = (referrals ?? []).map((r) => r.profile_id);
  let activePayingCount = 0;
  let mrrCents = 0;
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, tier, subscription_status")
      .in("id", profileIds)
      .eq("tier", "pro")
      .eq("subscription_status", "active");
    activePayingCount = profiles?.length ?? 0;
    mrrCents = activePayingCount * 900;
  }

  const { data: commissions } = await supabase
    .from("affiliate_commissions")
    .select("amount_cents, status, paid_at")
    .eq("partner_id", partnerId);

  let totalEarned = 0;
  let pending = 0;
  let payable = 0;
  let paidAllTime = 0;
  for (const c of commissions ?? []) {
    if (c.status === "clawback") continue;
    totalEarned += c.amount_cents;
    if (c.status === "pending") pending += c.amount_cents;
    if (c.status === "confirmed" && !c.paid_at) payable += c.amount_cents;
    if (c.status === "paid" || c.paid_at) paidAllTime += c.amount_cents;
  }

  return {
    signups_total: signupsTotal ?? 0,
    signups_active_paying: activePayingCount,
    mrr_generated_cents: mrrCents,
    total_earned_cents: totalEarned,
    pending_cents: pending,
    payable_cents: payable,
    paid_all_time_cents: paidAllTime,
  };
}
