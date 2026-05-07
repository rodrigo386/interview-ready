import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmCommissions } from "@/lib/affiliate/commission";
import { ApprovalDialog } from "@/components/affiliate/ApprovalDialog";
import { PayoutButton } from "@/components/affiliate/PayoutButton";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { tab = "applications" } = await searchParams;
  const sb = createAdminClient();

  // Lazy bump pending → confirmed for old commissions
  await confirmCommissions(sb);

  const { data: pending } = await sb
    .from("affiliate_partners")
    .select("id, code, display_name, bio, notes, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: active } = await sb
    .from("affiliate_partners")
    .select("id, code, display_name, status, commission_rate_pct, approved_at")
    .eq("status", "active")
    .order("approved_at", { ascending: false });

  const { data: suspended } = await sb
    .from("affiliate_partners")
    .select("id, code, display_name, approved_at")
    .eq("status", "suspended");

  // Payable per partner
  const { data: payableAgg } = await sb
    .from("affiliate_commissions")
    .select("partner_id, amount_cents")
    .eq("status", "confirmed")
    .is("paid_at", null);
  const payableByPartner = new Map<string, number>();
  for (const row of (payableAgg ?? []) as Array<{ partner_id: string; amount_cents: number }>) {
    payableByPartner.set(
      row.partner_id,
      (payableByPartner.get(row.partner_id) ?? 0) + row.amount_cents,
    );
  }

  // Total paid all-time
  const { data: paidAgg } = await sb
    .from("affiliate_commissions")
    .select("amount_cents")
    .eq("status", "paid");
  const paidAllTime =
    (paidAgg as Array<{ amount_cents: number }> | null)?.reduce(
      (acc, r) => acc + r.amount_cents,
      0,
    ) ?? 0;

  // Active referrals to compute MRR committed (approximate)
  const { data: activeRefs } = await sb
    .from("affiliate_referrals")
    .select("profile_id, partner_id");
  const refsByPartner = new Map<string, string[]>();
  for (const r of (activeRefs ?? []) as Array<{ profile_id: string; partner_id: string }>) {
    const arr = refsByPartner.get(r.partner_id) ?? [];
    arr.push(r.profile_id);
    refsByPartner.set(r.partner_id, arr);
  }
  const allRefProfileIds = (activeRefs ?? []).map((r: { profile_id: string }) => r.profile_id);
  let mrrCommitted = 0;
  if (allRefProfileIds.length > 0) {
    const { data: payingProfiles } = await sb
      .from("profiles")
      .select("id")
      .in("id", allRefProfileIds)
      .eq("tier", "pro")
      .eq("subscription_status", "active");
    mrrCommitted = ((payingProfiles?.length ?? 0) as number) * 900;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Affiliates</h1>
        <div className="mt-4 flex gap-4 text-sm">
          <Link
            href="/admin/affiliates?tab=applications"
            className={tab === "applications" ? "font-semibold text-orange-700" : "text-ink-2"}
          >
            Aplicações ({pending?.length ?? 0})
          </Link>
          <Link
            href="/admin/affiliates?tab=active"
            className={tab === "active" ? "font-semibold text-orange-700" : "text-ink-2"}
          >
            Ativos ({active?.length ?? 0})
          </Link>
          <Link
            href="/admin/affiliates?tab=suspended"
            className={tab === "suspended" ? "font-semibold text-orange-700" : "text-ink-2"}
          >
            Suspensos ({suspended?.length ?? 0})
          </Link>
          <Link
            href="/admin/affiliates?tab=metrics"
            className={tab === "metrics" ? "font-semibold text-orange-700" : "text-ink-2"}
          >
            Métricas
          </Link>
        </div>
      </header>

      {tab === "applications" && (
        <section>
          {(pending ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">Sem aplicações pendentes.</p>
          ) : (
            <div className="space-y-4">
              {pending!.map((p) => (
                <article key={p.id} className="rounded-xl border border-line bg-white p-5 shadow-prep">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-ink">{p.display_name}</h2>
                      <p className="mt-1 text-xs text-ink-3">
                        Código: <code className="font-mono">{p.code}</code> · Aplicou em{" "}
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      {p.bio && <p className="mt-3 text-sm text-ink-2">{p.bio}</p>}
                      {p.notes && (
                        <p className="mt-2 whitespace-pre-line text-xs italic text-ink-3">
                          {p.notes}
                        </p>
                      )}
                    </div>
                    <ApprovalDialog partnerId={p.id} displayName={p.display_name} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "active" && (
        <section>
          {(active ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">Nenhum parceiro ativo.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-ink-3">
                <tr>
                  <th className="py-2">Nome</th>
                  <th>Código</th>
                  <th>Comissão</th>
                  <th>A pagar</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {active!.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-3 font-medium text-ink">{p.display_name}</td>
                    <td><code className="font-mono text-ink-2">{p.code}</code></td>
                    <td className="text-ink-2">{p.commission_rate_pct}%</td>
                    <td className="text-ink-2">
                      R$ {((payableByPartner.get(p.id) ?? 0) / 100).toFixed(2)}
                    </td>
                    <td>
                      <PayoutButton
                        partnerId={p.id}
                        payableCents={payableByPartner.get(p.id) ?? 0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "suspended" && (
        <section>
          {(suspended ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">Nenhum suspenso.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {suspended!.map((p) => (
                <li key={p.id} className="rounded border border-line p-3 text-ink-2">
                  {p.display_name} (<code className="font-mono">{p.code}</code>)
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "metrics" && (
        <section className="grid gap-4 md:grid-cols-3">
          <KPI label="Total pago all-time" value={`R$ ${(paidAllTime / 100).toFixed(2)}`} />
          <KPI label="MRR comprometido" value={`R$ ${(mrrCommitted / 100).toFixed(2)}/mês`} />
          <KPI
            label="A pagar agora"
            value={`R$ ${(
              Array.from(payableByPartner.values()).reduce((a, b) => a + b, 0) / 100
            ).toFixed(2)}`}
          />
        </section>
      )}
    </main>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-prep">
      <p className="text-xs uppercase text-ink-3">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
