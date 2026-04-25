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
  // 1. Resolve user.
  const ref = parseExternalReference(evt.payment?.externalReference);
  let userId: string | null = ref?.userId ?? null;
  if (!userId && evt.payment?.customer) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("asaas_customer_id", evt.payment.customer)
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

async function handlePaymentReceived(
  evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  const p = evt.payment!;
  const ref = parseExternalReference(p.externalReference);
  const kind = ref?.kind ?? "pro_subscription";
  const cents = Math.round(p.value * 100);

  await supabase.from("payments").upsert(
    {
      user_id: userId,
      asaas_payment_id: p.id,
      kind,
      amount_cents: cents,
      status: "received",
      billing_method: p.billingType,
      paid_at: p.paymentDate ?? new Date().toISOString(),
      raw_payload: p as unknown,
    },
    { onConflict: "asaas_payment_id" },
  );

  if (kind === "pro_subscription") {
    await supabase
      .from("profiles")
      .update({
        tier: "pro",
        subscription_status: "active",
        subscription_renews_at: p.nextDueDate ?? null,
      })
      .eq("id", userId);
  } else {
    const { data: prof } = await supabase
      .from("profiles")
      .select("prep_credits")
      .eq("id", userId)
      .single();
    const credits = ((prof as { prep_credits?: number } | null)?.prep_credits ?? 0) + 1;
    await supabase
      .from("profiles")
      .update({ prep_credits: credits })
      .eq("id", userId);
  }
  return { handled: true, userId };
}

async function handlePaymentOverdue(
  evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  await supabase
    .from("payments")
    .upsert(
      {
        user_id: userId,
        asaas_payment_id: evt.payment!.id,
        kind: parseExternalReference(evt.payment!.externalReference)?.kind ?? "pro_subscription",
        amount_cents: Math.round(evt.payment!.value * 100),
        status: "overdue",
        billing_method: evt.payment!.billingType,
        raw_payload: evt.payment as unknown,
      },
      { onConflict: "asaas_payment_id" },
    );
  await supabase
    .from("profiles")
    .update({ subscription_status: "overdue" })
    .eq("id", userId);
  return { handled: true, userId };
}

async function handlePaymentRefunded(
  evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  const ref = parseExternalReference(evt.payment!.externalReference);
  await supabase
    .from("payments")
    .update({ status: "refunded" })
    .eq("asaas_payment_id", evt.payment!.id);
  if (ref?.kind === "pro_subscription") {
    await supabase
      .from("profiles")
      .update({ tier: "free", subscription_status: "expired" })
      .eq("id", userId);
  } else if (ref?.kind === "prep_purchase") {
    const { data: prof } = await supabase
      .from("profiles")
      .select("prep_credits")
      .eq("id", userId)
      .single();
    const credits = Math.max(0, ((prof as { prep_credits?: number } | null)?.prep_credits ?? 0) - 1);
    await supabase
      .from("profiles")
      .update({ prep_credits: credits })
      .eq("id", userId);
  }
  return { handled: true, userId };
}

async function handleSubscriptionDeleted(
  _evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  await supabase
    .from("profiles")
    .update({ subscription_status: "canceled", tier: "free" })
    .eq("id", userId);
  return { handled: true, userId };
}
