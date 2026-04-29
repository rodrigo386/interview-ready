// src/lib/billing/webhook.ts
import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { AsaasWebhookEvent } from "./types";
import { parseExternalReference } from "./ids";

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
  return { handled: true, userId };
}
