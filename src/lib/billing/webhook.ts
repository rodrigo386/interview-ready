// src/lib/billing/webhook.ts
import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { AsaasWebhookEvent } from "./types";
import { parseExternalReference } from "./ids";
import { recordCommission, recordClawback } from "@/lib/affiliate/commission";
import { trackServer } from "@/lib/analytics/server";

export function verifyToken(provided: string | null | undefined): boolean {
  if (!provided) return false;
  if (!env.ASAAS_WEBHOOK_TOKEN) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(env.ASAAS_WEBHOOK_TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type DispatchResult =
  | { handled: true; userId: string }
  | { handled: false; reason: "duplicate" | "no_user" | "unhandled" | "error"; detail?: string };

export async function dispatchEvent(
  evt: AsaasWebhookEvent,
  asaasEventId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  // 1. Resolve user. The `externalReference` (which we set ourselves at
  // checkout time) is the primary signal. If a forged event passes the
  // token check (e.g. token leaked), an attacker could set
  // externalReference="pro:<victim-uid>" and grant themselves Pro on a
  // victim's account. To mitigate: when we have BOTH externalReference
  // userId AND a customer id on the event, require they agree — i.e.
  // the customer id must match the resolved user's profile.asaas_customer_id.
  const ref = parseExternalReference(evt.payment?.externalReference);
  let userId: string | null = ref?.userId ?? null;
  const customerId = evt.payment?.customer ?? null;

  if (userId && customerId) {
    const { data } = await supabase
      .from("profiles")
      .select("asaas_customer_id")
      .eq("id", userId)
      .single();
    const profileCustomer = (data as { asaas_customer_id: string | null } | null)
      ?.asaas_customer_id ?? null;
    if (profileCustomer && profileCustomer !== customerId) {
      console.warn(
        `[webhook] customer mismatch for user ${userId}: profile=${profileCustomer} event=${customerId}`,
      );
      return { handled: false, reason: "error", detail: "customer mismatch" };
    }
  }

  if (!userId && customerId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("asaas_customer_id", customerId)
      .single();
    userId = (data as { id: string } | null)?.id ?? null;
  }

  // 2. Insert into subscription_events for idempotency.
  const eventRow = {
    user_id: userId,
    asaas_event_id: asaasEventId,
    event_type: evt.event,
    asaas_subscription_id: evt.subscription?.id ?? evt.payment?.subscription ?? null,
    asaas_payment_id: evt.payment?.id ?? null,
    raw_payload: evt as unknown,
  };
  const insertRes = await supabase
    .from("subscription_events")
    .insert(eventRow)
    .select()
    .single();
  if (insertRes.error) {
    if (insertRes.error.code === "23505") {
      return { handled: false, reason: "duplicate" };
    }
    return { handled: false, reason: "error", detail: insertRes.error.message };
  }

  // 3. Dispatch by event. Check unhandled events first so we don't flag
  // unknown event types as 'no_user' when no user could be resolved.
  switch (evt.event) {
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED":
      if (!userId) return { handled: false, reason: "no_user" };
      return handlePaymentReceived(evt, userId, supabase);
    case "PAYMENT_OVERDUE":
      if (!userId) return { handled: false, reason: "no_user" };
      return handlePaymentOverdue(evt, userId, supabase);
    case "PAYMENT_REFUNDED":
      if (!userId) return { handled: false, reason: "no_user" };
      return handlePaymentRefunded(evt, userId, supabase);
    case "SUBSCRIPTION_DELETED":
      if (!userId) return { handled: false, reason: "no_user" };
      return handleSubscriptionDeleted(evt, userId, supabase);
    case "PAYMENT_CREATED":
    case "SUBSCRIPTION_CREATED":
    case "SUBSCRIPTION_UPDATED":
      if (!userId) return { handled: false, reason: "no_user" };
      return { handled: true, userId };
    case "TRANSFER_DONE":
    case "TRANSFER_FAILED":
    case "TRANSFER_CANCELLED":
    case "TRANSFER_PENDING":
    case "TRANSFER_BANK_PROCESSING":
      // Transfers are payouts to affiliate partners. No user_id involved.
      return handleTransferUpdate(evt, supabase);
    default:
      return { handled: false, reason: "unhandled" };
  }
}

// All four handlers below dispatch to SECURITY DEFINER stored procedures
// (see migration 0013) that wrap each payment/profile pair in a single
// transaction. Atomicity prevents the historical "user paid but tier
// stayed free" failure mode where the connection died between two writes.
//
// They also use atomic UPDATE expressions for prep_credits
// (`prep_credits + 1` instead of read-modify-write), eliminating a race
// between concurrent webhooks that idempotency-by-event-id alone doesn't
// fully cover.

async function handlePaymentReceived(
  evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  const p = evt.payment!;
  const ref = parseExternalReference(p.externalReference);
  const kind = ref?.kind ?? "pro_subscription";
  const cents = Math.round(p.value * 100);

  const { error } = await supabase.rpc("handle_payment_received", {
    p_user_id: userId,
    p_payment_id: p.id,
    p_kind: kind,
    p_amount_cents: cents,
    p_billing_method: p.billingType,
    p_paid_at: p.paymentDate ?? new Date().toISOString(),
    p_raw_payload: p as unknown,
    p_next_due_date: kind === "pro_subscription" ? p.nextDueDate ?? null : null,
  });
  if (error) return { handled: false, reason: "error", detail: error.message };

  // Affiliate commission side-effect (Stage 3). Idempotent via UNIQUE(payment_id).
  // Failures are tolerated — webhook still acks. Reconciliation is handled
  // separately if a commission row goes missing.
  try {
    const { data: paymentRow } = await supabase
      .from("payments")
      .select("id")
      .eq("asaas_payment_id", p.id)
      .maybeSingle();
    if (paymentRow?.id) {
      await recordCommission(paymentRow.id, supabase);
    }
  } catch (err) {
    console.warn("[affiliate] recordCommission failed:", err);
  }

  // Funnel analytics: checkout_completed always fires; subscription_started
  // only on the first PAYMENT_CONFIRMED/RECEIVED for a pro_subscription. We
  // look at profile.subscription_renews_at — set to null before this RPC
  // ran on a brand-new sub — to decide. (PAYMENT_CONFIRMED on renewals
  // already has it set, so we won't double-count.)
  try {
    await trackServer(userId, "checkout_completed", {
      kind,
      amount_cents: cents,
      billing_method: p.billingType,
    });
    if (kind === "pro_subscription") {
      const plan: "pro_promo_30" | "pro_full_50" | "other" =
        cents === 3000 ? "pro_promo_30" : cents === 5000 ? "pro_full_50" : "other";
      // `is_first_pro_payment`: read renews_at AFTER the RPC ran. Renewals
      // arrive with renews_at already set from the prior cycle. First
      // payment writes it during the RPC, so we check the prior state by
      // looking at how many payments rows exist for this kind for this user.
      const { count } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kind", "pro_subscription")
        .in("status", ["confirmed", "received"]);
      if ((count ?? 0) <= 1) {
        await trackServer(userId, "subscription_started", {
          plan,
          amount_cents: cents,
          billing_method: p.billingType,
        });
      }
    }
  } catch (err) {
    console.warn("[analytics] webhook capture failed:", err);
  }

  return { handled: true, userId };
}

async function handlePaymentOverdue(
  evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  const p = evt.payment!;
  const kind = parseExternalReference(p.externalReference)?.kind ?? "pro_subscription";
  const { error } = await supabase.rpc("handle_payment_overdue", {
    p_user_id: userId,
    p_payment_id: p.id,
    p_kind: kind,
    p_amount_cents: Math.round(p.value * 100),
    p_billing_method: p.billingType,
    p_raw_payload: p as unknown,
  });
  if (error) return { handled: false, reason: "error", detail: error.message };
  return { handled: true, userId };
}

async function handlePaymentRefunded(
  evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  const p = evt.payment!;
  const kind = parseExternalReference(p.externalReference)?.kind ?? null;
  const { error } = await supabase.rpc("handle_payment_refunded", {
    p_user_id: userId,
    p_payment_id: p.id,
    p_kind: kind,
  });
  if (error) return { handled: false, reason: "error", detail: error.message };

  // Affiliate clawback side-effect (Stage 3). Tolerates missing commission row
  // (refund of payment that never had a commission, e.g. user not referred).
  try {
    const { data: paymentRow } = await supabase
      .from("payments")
      .select("id")
      .eq("asaas_payment_id", p.id)
      .maybeSingle();
    if (paymentRow?.id) {
      await recordClawback(paymentRow.id, supabase);
    }
  } catch (err) {
    console.warn("[affiliate] recordClawback failed:", err);
  }

  return { handled: true, userId };
}

async function handleSubscriptionDeleted(
  _evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  const { error } = await supabase.rpc("handle_subscription_deleted", {
    p_user_id: userId,
  });
  if (error) return { handled: false, reason: "error", detail: error.message };

  // Affiliate clawback side-effect: if this user was referred by a partner,
  // any commission already paid for their subscription would be a loss
  // (subscription was cancelled, partner shouldn't keep credit). Mark all
  // their pending/confirmed commissions as clawback so they don't pay out.
  // Already-paid commissions stay paid (no money clawback on Asaas side).
  try {
    const { data: payments } = await supabase
      .from("payments")
      .select("id")
      .eq("user_id", userId);
    const paymentIds = (payments ?? []).map(
      (p) => (p as { id: string }).id,
    );
    if (paymentIds.length > 0) {
      await supabase
        .from("affiliate_commissions")
        .update({ status: "clawback" })
        .in("payment_id", paymentIds)
        .in("status", ["pending", "confirmed"]);
    }
  } catch (err) {
    console.warn("[affiliate] subscription cancel clawback failed:", err);
  }

  return { handled: true, userId };
}

/**
 * Asaas TRANSFER_* events: status updates on Pix payouts we created via
 * /transfers (affiliate payouts). Maps Asaas event → affiliate_payouts.status.
 *
 * No user_id is involved — this matches our affiliate_payouts row by the
 * transfer id stored in asaas_transfer_id. Partner is identified via the
 * payout row's partner_id FK.
 */
async function handleTransferUpdate(
  evt: AsaasWebhookEvent,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  const t = evt.transfer;
  if (!t?.id) return { handled: false, reason: "error", detail: "transfer payload missing" };

  const status = mapTransferEventStatus(evt.event, t.status);
  const completedAt =
    status === "done" || status === "failed" || status === "cancelled"
      ? new Date().toISOString()
      : null;

  const { data: payout, error: updErr } = await supabase
    .from("affiliate_payouts")
    .update({
      status,
      asaas_response: t as unknown as Record<string, unknown>,
      error_message: t.failReason ?? null,
      completed_at: completedAt,
    })
    .eq("asaas_transfer_id", t.id)
    .select("id, partner_id, status")
    .maybeSingle();

  if (updErr) {
    return { handled: false, reason: "error", detail: updErr.message };
  }
  if (!payout) {
    // Transfer not in our table — probably from another integration or
    // manual dashboard transfer. Acknowledge and move on.
    return { handled: false, reason: "unhandled", detail: "transfer not tracked" };
  }

  // If the transfer failed AFTER we already marked commissions as paid,
  // we should revert them so admin can retry. paid_via tag lets us find
  // the exact rows tied to this transfer.
  if (status === "failed" || status === "cancelled") {
    await supabase
      .from("affiliate_commissions")
      .update({ status: "confirmed", paid_at: null, paid_via: null })
      .eq("paid_via", `asaas_transfer:${t.id}`);
  }

  return {
    handled: true,
    userId: (payout as { partner_id: string }).partner_id,
  };
}

function mapTransferEventStatus(
  event: string,
  asaasStatus: string,
): "pending" | "processing" | "done" | "failed" | "cancelled" {
  switch (event) {
    case "TRANSFER_DONE":
      return "done";
    case "TRANSFER_FAILED":
      return "failed";
    case "TRANSFER_CANCELLED":
      return "cancelled";
    case "TRANSFER_BANK_PROCESSING":
      return "processing";
    case "TRANSFER_PENDING":
      return "pending";
    default:
      // Fallback to the status field on the transfer payload
      switch (asaasStatus) {
        case "DONE":
          return "done";
        case "FAILED":
          return "failed";
        case "CANCELLED":
          return "cancelled";
        case "BANK_PROCESSING":
          return "processing";
        default:
          return "pending";
      }
  }
}
