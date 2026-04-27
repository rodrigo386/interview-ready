import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoSince(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export type Kpi = {
  label: string;
  value: string;
  hint?: string;
};

export type AdminOverview = {
  kpis: Kpi[];
  latestSignups: Array<{
    id: string;
    email: string;
    full_name: string | null;
    tier: string;
    subscription_status: string | null;
    created_at: string;
    is_admin: boolean;
  }>;
  latestPreps: Array<{
    id: string;
    user_id: string;
    user_email: string | null;
    company_name: string;
    job_title: string;
    generation_status: string;
    ats_status: string | null;
    created_at: string;
  }>;
  latestPayments: Array<{
    id: string;
    user_id: string;
    user_email: string | null;
    kind: string;
    amount_cents: number;
    status: string;
    paid_at: string | null;
    created_at: string;
  }>;
  failedPreps: Array<{
    id: string;
    user_email: string | null;
    company_name: string;
    error_message: string | null;
    created_at: string;
  }>;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const admin = createAdminClient();

  const today = isoSince(1);
  const last7d = isoSince(7);
  const last30d = isoSince(30);

  const [
    totalUsersRes,
    signups24hRes,
    signups7dRes,
    signups30dRes,
    proActiveRes,
    overdueRes,
    totalPrepsRes,
    preps24hRes,
    preps7dRes,
    preps30dRes,
    activeUsers7dRes,
    activeUsers30dRes,
    failedPreps7dRes,
    successPreps30dRes,
    revenue30dRes,
    pendingPaymentsRes,
    creditsTotalRes,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", today),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", last7d),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", last30d),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("subscription_status", "active").eq("tier", "pro"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("subscription_status", "overdue"),
    admin.from("prep_sessions").select("id", { count: "exact", head: true }),
    admin.from("prep_sessions").select("id", { count: "exact", head: true }).gte("created_at", today),
    admin.from("prep_sessions").select("id", { count: "exact", head: true }).gte("created_at", last7d),
    admin.from("prep_sessions").select("id", { count: "exact", head: true }).gte("created_at", last30d),
    admin.from("prep_sessions").select("user_id").gte("created_at", last7d),
    admin.from("prep_sessions").select("user_id").gte("created_at", last30d),
    admin.from("prep_sessions").select("id", { count: "exact", head: true }).eq("generation_status", "failed").gte("created_at", last7d),
    admin.from("prep_sessions").select("id", { count: "exact", head: true }).eq("generation_status", "complete").gte("created_at", last30d),
    admin.from("payments").select("amount_cents").in("status", ["received", "confirmed"]).gte("paid_at", last30d),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("profiles").select("prep_credits"),
  ]);

  const totalUsers = totalUsersRes.count ?? 0;
  const signups24h = signups24hRes.count ?? 0;
  const signups7d = signups7dRes.count ?? 0;
  const signups30d = signups30dRes.count ?? 0;
  const proActive = proActiveRes.count ?? 0;
  const overdue = overdueRes.count ?? 0;
  const totalPreps = totalPrepsRes.count ?? 0;
  const preps24h = preps24hRes.count ?? 0;
  const preps7d = preps7dRes.count ?? 0;
  const preps30d = preps30dRes.count ?? 0;
  const failedPreps7d = failedPreps7dRes.count ?? 0;
  const successPreps30d = successPreps30dRes.count ?? 0;
  const pendingPayments = pendingPaymentsRes.count ?? 0;

  const activeUsers7d = new Set(
    (activeUsers7dRes.data as { user_id: string }[] | null)?.map((r) => r.user_id) ?? [],
  ).size;
  const activeUsers30d = new Set(
    (activeUsers30dRes.data as { user_id: string }[] | null)?.map((r) => r.user_id) ?? [],
  ).size;

  const revenueCents30d = (revenue30dRes.data as { amount_cents: number }[] | null)?.reduce(
    (acc, p) => acc + (p.amount_cents ?? 0),
    0,
  ) ?? 0;

  const totalCredits = (creditsTotalRes.data as { prep_credits: number }[] | null)?.reduce(
    (acc, p) => acc + (p.prep_credits ?? 0),
    0,
  ) ?? 0;

  // Estimated MRR: active Pro subs × R$ 30 (promo). Overdue counted at half weight.
  const mrrCents = proActive * 3000 + overdue * 1500;

  // Conversion funnel: signups in last 30d that have at least 1 prep.
  const recentSignupsWithPrep = await admin
    .from("profiles")
    .select("id, prep_sessions!inner(id)")
    .gte("created_at", last30d);
  const activatedFromRecent = new Set(
    (recentSignupsWithPrep.data as { id: string }[] | null)?.map((r) => r.id) ?? [],
  ).size;
  const activationRate = signups30d === 0 ? 0 : Math.round((activatedFromRecent / signups30d) * 100);

  const kpis: Kpi[] = [
    { label: "Total de usuários", value: totalUsers.toLocaleString("pt-BR") },
    { label: "Assinantes Pro ativos", value: proActive.toLocaleString("pt-BR"), hint: overdue ? `+${overdue} em atraso` : undefined },
    { label: "MRR estimado (R$)", value: brl(mrrCents), hint: "Pro × R$30 + 50% dos overdue" },
    { label: "Receita últimos 30d (R$)", value: brl(revenueCents30d) },
    { label: "Cadastros 24h", value: signups24h.toLocaleString("pt-BR"), hint: `${signups7d} em 7d · ${signups30d} em 30d` },
    { label: "Preps geradas 24h", value: preps24h.toLocaleString("pt-BR"), hint: `${preps7d} em 7d · ${preps30d} em 30d` },
    { label: "Usuários ativos 7d", value: activeUsers7d.toLocaleString("pt-BR"), hint: `${activeUsers30d} em 30d` },
    { label: "Ativação 30d", value: `${activationRate}%`, hint: `${activatedFromRecent} de ${signups30d} cadastros` },
    { label: "Total de preps", value: totalPreps.toLocaleString("pt-BR"), hint: `${successPreps30d} sucesso em 30d` },
    { label: "Preps falhadas 7d", value: failedPreps7d.toLocaleString("pt-BR"), hint: failedPreps7d > 0 ? "Investigar abaixo" : undefined },
    { label: "Pagamentos pendentes", value: pendingPayments.toLocaleString("pt-BR") },
    { label: "Créditos avulsos no sistema", value: totalCredits.toLocaleString("pt-BR") },
  ];

  // Recent activity tables.
  const [latestSignupsRes, latestPrepsRes, latestPaymentsRes, failedPrepsRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, tier, subscription_status, created_at, is_admin")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("prep_sessions")
      .select("id, user_id, company_name, job_title, generation_status, ats_status, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("payments")
      .select("id, user_id, kind, amount_cents, status, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("prep_sessions")
      .select("id, user_id, company_name, error_message, created_at")
      .eq("generation_status", "failed")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Hydrate user_email on prep + payment + failed rows by joining profiles in JS
  // (Supabase JS doesn't easily project FK into a flat field).
  const userIds = new Set<string>();
  ((latestPrepsRes.data as { user_id: string }[]) ?? []).forEach((r) => userIds.add(r.user_id));
  ((latestPaymentsRes.data as { user_id: string }[]) ?? []).forEach((r) => userIds.add(r.user_id));
  ((failedPrepsRes.data as { user_id: string }[]) ?? []).forEach((r) => userIds.add(r.user_id));
  const profilesByIdRes = userIds.size
    ? await admin.from("profiles").select("id, email").in("id", Array.from(userIds))
    : { data: [] as { id: string; email: string }[] };
  const emailById = new Map(
    ((profilesByIdRes.data as { id: string; email: string }[] | null) ?? []).map((p) => [p.id, p.email] as const),
  );

  return {
    kpis,
    latestSignups: ((latestSignupsRes.data as AdminOverview["latestSignups"] | null) ?? []),
    latestPreps: ((latestPrepsRes.data as Omit<AdminOverview["latestPreps"][number], "user_email">[] | null) ?? []).map(
      (p) => ({ ...p, user_email: emailById.get(p.user_id) ?? null }),
    ),
    latestPayments: ((latestPaymentsRes.data as Omit<AdminOverview["latestPayments"][number], "user_email">[] | null) ?? []).map(
      (p) => ({ ...p, user_email: emailById.get(p.user_id) ?? null }),
    ),
    failedPreps: ((failedPrepsRes.data as { id: string; user_id: string; company_name: string; error_message: string | null; created_at: string }[] | null) ?? []).map(
      (p) => ({
        id: p.id,
        user_email: emailById.get(p.user_id) ?? null,
        company_name: p.company_name,
        error_message: p.error_message,
        created_at: p.created_at,
      }),
    ),
  };
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
