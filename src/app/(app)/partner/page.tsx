import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  confirmCommissions,
  getPartnerEarnings,
} from "@/lib/affiliate/commission";
import { CodeBox } from "@/components/affiliate/CodeBox";
import { EarningsCard } from "@/components/affiliate/EarningsCard";

export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage() {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login?next=/partner");

  const { data: partner } = await sb
    .from("affiliate_partners")
    .select("id, code, display_name, status, commission_rate_pct, created_at, approved_at")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!partner) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="text-3xl font-bold text-ink">Você ainda não é parceiro</h1>
        <p className="mt-3 text-sm text-ink-2">
          Aplique pelo programa de parceiros pra começar a ganhar 30% recorrente
          vitalício.
        </p>
        <Link
          href="/parceiros"
          className="mt-6 inline-block rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Aplicar →
        </Link>
      </main>
    );
  }

  const p = partner as {
    id: string;
    code: string;
    display_name: string;
    status: "pending" | "active" | "suspended";
    commission_rate_pct: number;
    created_at: string;
    approved_at: string | null;
  };

  if (p.status === "pending") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="text-2xl font-bold text-ink">Aplicação em análise</h1>
        <p className="mt-3 text-sm text-ink-2">
          Recebemos sua aplicação ({p.display_name}). Respondemos em até 7 dias
          úteis no e-mail da sua conta.
        </p>
      </main>
    );
  }

  if (p.status === "suspended") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="text-2xl font-bold text-ink">
          Sua conta de parceiro foi suspensa
        </h1>
        <p className="mt-3 text-sm text-ink-2">
          Entre em contato:{" "}
          <a
            href="mailto:prepavaga@prepavaga.com.br"
            className="text-orange-700 underline"
          >
            prepavaga@prepavaga.com.br
          </a>
        </p>
      </main>
    );
  }

  // Active partner
  const admin = createAdminClient();
  await confirmCommissions(admin); // lazy bump pending → confirmed for old rows

  const earnings = await getPartnerEarnings(p.id, admin);

  const { data: commissions } = await admin
    .from("affiliate_commissions")
    .select("id, payment_id, amount_cents, status, created_at, paid_at")
    .eq("partner_id", p.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          Dashboard do parceiro
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          {p.display_name} · código <code className="font-mono">{p.code}</code> ·
          comissão {p.commission_rate_pct}%
        </p>
      </header>

      <CodeBox code={p.code} />

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EarningsCard label="Indicações totais" value={String(earnings.signups_total)} />
        <EarningsCard
          label="Pagantes ativos"
          value={String(earnings.signups_active_paying)}
          hint="Clientes Pro com assinatura ativa"
        />
        <EarningsCard
          label="MRR gerado"
          value={`R$ ${(earnings.mrr_generated_cents / 100).toFixed(2)}/mês`}
        />
        <EarningsCard
          label="A receber"
          value={`R$ ${(earnings.payable_cents / 100).toFixed(2)}`}
          hint="Confirmado e aguardando pagamento"
          accent
        />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <EarningsCard
          label="Total ganho all-time"
          value={`R$ ${(earnings.total_earned_cents / 100).toFixed(2)}`}
        />
        <EarningsCard
          label="Aguardando confirmação"
          value={`R$ ${(earnings.pending_cents / 100).toFixed(2)}`}
          hint="Janela de 7 dias após pagamento"
        />
        <EarningsCard
          label="Já recebido"
          value={`R$ ${(earnings.paid_all_time_cents / 100).toFixed(2)}`}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-ink">Histórico</h2>
        {(commissions ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-ink-3">
            Nenhuma comissão ainda. Compartilhe seu link!
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-ink-3">
                <tr>
                  <th className="py-2">Data</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Pago em</th>
                </tr>
              </thead>
              <tbody>
                {(commissions as Array<{
                  id: string;
                  amount_cents: number;
                  status: string;
                  created_at: string;
                  paid_at: string | null;
                }>).map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-3 text-ink-2">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="text-ink-2">
                      R$ {(c.amount_cents / 100).toFixed(2)}
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="text-ink-2">
                      {c.paid_at
                        ? new Date(c.paid_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "bg-yellow-soft text-yellow-700" },
    confirmed: { label: "Confirmado", cls: "bg-orange-soft text-orange-700" },
    paid: { label: "Pago", cls: "bg-green-soft text-green-700" },
    clawback: { label: "Estornado", cls: "bg-red-soft text-red-500" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-bg text-ink-3" };
  return (
    <span
      className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}
