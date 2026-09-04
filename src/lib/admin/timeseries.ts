import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { toBrazilDay, ultimosDiasBrasil } from "@/lib/analytics/brazil-day";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Buckets pelo dia BRASILEIRO, não pelo UTC.
 *
 * O `created_at` volta em UTC e o recorte anterior (`.slice(0, 10)`) usava a
 * data UTC direto — o que empurrava toda a atividade brasileira entre 21h e
 * meia-noite pra barra do dia seguinte. Ver `@/lib/analytics/brazil-day`.
 */
function dayBuckets(days: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of ultimosDiasBrasil(days)) m.set(d, 0);
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
    const day = toBrazilDay(r.created_at);
    if (signups.has(day)) signups.set(day, (signups.get(day) ?? 0) + 1);
  }

  // `preps` conta TODA sessão criada — e desde que a análise ATS virou
  // grátis, a maioria nunca vira preparação paga. Sozinha, a série sobe com
  // o topo de funil e dá a impressão de que o produto pago cresceu junto.
  // `prepsDelivered` isola o que consumiu crédito: `generation_status` só
  // chega a 'complete' quando o pipeline pago roda inteiro. As duas juntas
  // são o gráfico honesto — volume grátis e conversão paga na mesma escala.
  const preps = dayBuckets(days);
  const prepsDelivered = dayBuckets(days);
  const prepsFailed = dayBuckets(days);
  for (const r of (prepsRes.data ?? []) as {
    created_at: string;
    generation_status: string;
  }[]) {
    const day = toBrazilDay(r.created_at);
    if (preps.has(day)) preps.set(day, (preps.get(day) ?? 0) + 1);
    if (r.generation_status === "complete" && prepsDelivered.has(day)) {
      prepsDelivered.set(day, (prepsDelivered.get(day) ?? 0) + 1);
    }
    if (r.generation_status === "failed" && prepsFailed.has(day)) {
      prepsFailed.set(day, (prepsFailed.get(day) ?? 0) + 1);
    }
  }

  const revenue = dayBuckets(days);
  for (const r of (paymentsRes.data ?? []) as {
    created_at: string;
    amount_cents: number;
  }[]) {
    const day = toBrazilDay(r.created_at);
    if (revenue.has(day))
      revenue.set(day, (revenue.get(day) ?? 0) + (r.amount_cents ?? 0));
  }

  const toPoints = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([date, value]) => ({ date, value }));

  return {
    signups: toPoints(signups),
    preps: toPoints(preps),
    prepsDelivered: toPoints(prepsDelivered),
    prepsFailed: toPoints(prepsFailed),
    revenueCents: toPoints(revenue),
  };
}
