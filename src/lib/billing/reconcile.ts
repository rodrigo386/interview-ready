import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { AsaasPayment, AsaasSubscription } from "./types";
import { parseExternalReference } from "./ids";

type ProfileRow = {
  id: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  subscription_status: "active" | "overdue" | "canceled" | "expired" | "none" | null;
  tier: "free" | "pro" | "team";
};

export type ReconcileScope = "subscription" | "full";

export type ReconcileResult = {
  reconciled: boolean;
  reason?: string;
  changes: { tier?: string; subscriptionStatus?: string; creditsAdded?: number };
};

export async function reconcileBillingFromAsaas(
  userId: string,
  supabase: SupabaseClient,
  scope: ReconcileScope = "subscription",
): Promise<ReconcileResult> {
  if (!env.ASAAS_API_KEY) {
    return { reconciled: false, reason: "no_api_key", changes: {} };
  }

  const { data: profileRaw, error: profileErr } = await supabase
    .from("profiles")
    .select("id, asaas_customer_id, asaas_subscription_id, subscription_status, tier")
    .eq("id", userId)
    .single();
  if (profileErr || !profileRaw) {
    return { reconciled: false, reason: "no_profile", changes: {} };
  }
  const profile = profileRaw as ProfileRow;

  const changes: ReconcileResult["changes"] = {};

  // 1. Subscription state.
  if (profile.asaas_subscription_id) {
    try {
      const sub = await fetchAsaas<AsaasSubscription>(
        `/subscriptions/${profile.asaas_subscription_id}`,
      );
      const subPayments = await fetchAsaas<{ data: AsaasPayment[] }>(
        `/subscriptions/${profile.asaas_subscription_id}/payments?limit=20&offset=0`,
      );
      const paid = (subPayments.data ?? []).filter((p) =>
        p.status === "RECEIVED" || p.status === "CONFIRMED",
      );

      // Idempotently insert each paid invoice into payments.
      for (const p of paid) {
        await upsertProSubscriptionPayment(supabase, userId, p);
      }

      const isActive =
        paid.length > 0 &&
        (sub.status === "ACTIVE" || sub.status === "active" || sub.status === undefined);
      const isInactive = sub.status === "INACTIVE" || sub.status === "EXPIRED";

      if (isActive) {
        const update: Record<string, unknown> = {
          tier: "pro",
          subscription_status: "active",
        };
        if (sub.nextDueDate) update.subscription_renews_at = sub.nextDueDate;
        await supabase.from("profiles").update(update).eq("id", userId);
        if (profile.tier !== "pro") changes.tier = "pro";
        if (profile.subscription_status !== "active") changes.subscriptionStatus = "active";
      } else if (isInactive && profile.subscription_status !== "expired") {
        await supabase
          .from("profiles")
          .update({ tier: "free", subscription_status: "expired" })
          .eq("id", userId);
        changes.subscriptionStatus = "expired";
      }
    } catch (err) {
      console.warn("[reconcile] subscription fetch failed:", err);
    }
  }

  // 2. One-off prep_purchase payments (only when scope=full to avoid hitting
  // Asaas on every page load).
  if (scope === "full" && profile.asaas_customer_id) {
    try {
      const customerPayments = await fetchAsaas<{ data: AsaasPayment[] }>(
        `/payments?customer=${encodeURIComponent(profile.asaas_customer_id)}&limit=20&offset=0`,
      );
      const oneOffs = (customerPayments.data ?? []).filter((p) => {
        if (p.status !== "RECEIVED" && p.status !== "CONFIRMED") return false;
        const ref = parseExternalReference(p.externalReference);
        return ref?.kind === "prep_purchase" && ref.userId === userId;
      });
      let added = 0;
      for (const p of oneOffs) {
        const credited = await insertOneOffIfNew(supabase, userId, p);
        if (credited) added += 1;
      }
      if (added > 0) changes.creditsAdded = added;
    } catch (err) {
      console.warn("[reconcile] customer payments fetch failed:", err);
    }
  }

  return {
    reconciled: Object.keys(changes).length > 0,
    changes,
  };
}

async function upsertProSubscriptionPayment(
  supabase: SupabaseClient,
  userId: string,
  p: AsaasPayment,
) {
  await supabase.from("payments").upsert(
    {
      user_id: userId,
      asaas_payment_id: p.id,
      kind: "pro_subscription",
      amount_cents: Math.round(p.value * 100),
      status: p.status === "CONFIRMED" ? "confirmed" : "received",
      billing_method: p.billingType,
      paid_at: p.paymentDate ?? new Date().toISOString(),
      raw_payload: p as unknown,
    },
    { onConflict: "asaas_payment_id" },
  );
}

async function insertOneOffIfNew(
  supabase: SupabaseClient,
  userId: string,
  p: AsaasPayment,
): Promise<boolean> {
  const insertRes = await supabase.from("payments").insert({
    user_id: userId,
    asaas_payment_id: p.id,
    kind: "prep_purchase",
    amount_cents: Math.round(p.value * 100),
    status: p.status === "CONFIRMED" ? "confirmed" : "received",
    billing_method: p.billingType,
    paid_at: p.paymentDate ?? new Date().toISOString(),
    raw_payload: p as unknown,
  });
  if (insertRes.error) {
    // 23505 = unique violation on asaas_payment_id → already credited.
    return false;
  }
  const { data: prof } = await supabase
    .from("profiles")
    .select("prep_credits")
    .eq("id", userId)
    .single();
  const credits = ((prof as { prep_credits?: number } | null)?.prep_credits ?? 0) + 1;
  await supabase.from("profiles").update({ prep_credits: credits }).eq("id", userId);
  return true;
}

async function fetchAsaas<T>(path: string): Promise<T> {
  const res = await fetch(`${env.ASAAS_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "PrepaVAGA/1.0",
      access_token: env.ASAAS_API_KEY!,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Asaas ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
