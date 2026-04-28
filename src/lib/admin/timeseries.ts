import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayBuckets(days: number): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    m.set(d, 0);
  }
  return m;
}

export async function getHistoricalSeries(days = 30) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - days * DAY_MS).toISOString();

  const [signupsRes, prepsRes, paymentsRes] = await Promise.all([
    admin.from("profiles").select("created_at").gte("created_at", since),
    admin.from("prep_sessions").select("created_at, generation_status").gte("created_at", since),
    admin
      .from("payments")
      .select("created_at, amount_cents, status")
      .gte("created_at", since)
      .in("status", ["received", "confirmed"]),
  ]);

  const signups = dayBuckets(days);
  for (const r of (signupsRes.data ?? []) as { created_at: string }[]) {
    const day = r.created_at.slice(0, 10);
    if (signups.has(day)) signups.set(day, (signups.get(day) ?? 0) + 1);
  }

  const preps = dayBuckets(days);
  const prepsFailed = dayBuckets(days);
  for (const r of (prepsRes.data ?? []) as {
    created_at: string;
    generation_status: string;
  }[]) {
    const day = r.created_at.slice(0, 10);
    if (preps.has(day)) preps.set(day, (preps.get(day) ?? 0) + 1);
    if (r.generation_status === "failed" && prepsFailed.has(day)) {
      prepsFailed.set(day, (prepsFailed.get(day) ?? 0) + 1);
    }
  }

  const revenue = dayBuckets(days);
  for (const r of (paymentsRes.data ?? []) as {
    created_at: string;
    amount_cents: number;
  }[]) {
    const day = r.created_at.slice(0, 10);
    if (revenue.has(day))
      revenue.set(day, (revenue.get(day) ?? 0) + (r.amount_cents ?? 0));
  }

  const toPoints = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([date, value]) => ({ date, value }));

  return {
    signups: toPoints(signups),
    preps: toPoints(preps),
    prepsFailed: toPoints(prepsFailed),
    revenueCents: toPoints(revenue),
  };
}
