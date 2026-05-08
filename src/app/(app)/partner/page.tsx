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
import { PixKeyCard } from "@/components/affiliate/PixKeyCard";
import { MIN_PAYOUT_CENTS } from "@/lib/affiliate/payout";

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
    const appliedAt = new Date(p.created_at).toLocaleDateString("pt-BR");
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">
            Programa de parceiros
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            Olá, {p.display_name}.
          </p>
        </header>

        <StatusBanner
          tone="yellow"
          title="Aplicação em análise"
          body={`Enviada em ${appliedAt}. Respondemos em até 7 dias úteis no e-mail da sua conta.`}
        />

        <section className="mt-8">
          <h2 className="text-base font-semibold text-ink">
            Seu link (já funciona pra atribuição)
          </h2>
          <p className="mb-3 mt-1 text-xs text-ink-3">
            Pode compartilhar desde já — toda visita pelo seu link fica gravada.
            Comissões só passam a ser pagas após a aprovação.
          </p>
          <CodeBox code={p.code} />
        </section>

        <section className="mt-10 rounded-xl border border-line bg-bg p-5">
          <h3 className="text-sm font-semibold text-ink">Próximos passos</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">
            <li>Aguardar aprovação (até 7 dias úteis)</li>
            <li>Enquanto isso, divulgue seu link — visitas ficam atribuídas</li>
            <li>
              Após aprovação, comissões de 30% começam a contar e você
              acompanha tudo aqui
            </li>
          </ol>
        </section>
      </main>
    );
  }

  if (p.status === "suspended") {
    const wasApproved = !!p.approved_at;
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">
            Programa de parceiros
          </h1>
          <p className="mt-2 text-sm text-ink-2">{p.display_name}</p>
        </header>

        <StatusBanner
          tone="red"
          title={
            wasApproved
              ? "Conta de parceiro suspensa"
              : "Aplicação não aprovada"
          }
          body={
            wasApproved
              ? "Sua conta foi suspensa. Se acha que houve engano, entre em contato."
              : "Não conseguimos aprovar sua aplicação dessa vez. Se quiser entender o motivo ou tentar de novo, fala com a gente."
          }
        />

        <p className="mt-6 text-sm text-ink-2">
          Contato:{" "}
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

  const { data: profile } = await sb
    .from("profiles")
    .select("pix_key")
    .eq("id", data.user.id)
    .single();
  const pixKey = (profile as { pix_key: string | null } | null)?.pix_key ?? null;

  const { data: commissions } = await admin
    .from("affiliate_commissions")
    .select("id, payment_id, amount_cents, status, created_at, paid_at")
    .eq("partner_id", p.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">
            Programa de parceiros
          </h1>
          <span className="rounded-pill bg-green-soft px-2.5 py-0.5 text-xs font-semibold text-green-700">
            Aprovado
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-2">
          {p.display_name} · código <code className="font-mono">{p.code}</code> ·
          comissão {p.commission_rate_pct}%
          {p.approved_at && (
            <>
              {" · aprovado em "}
              {new Date(p.approved_at).toLocaleDateString("pt-BR")}
            </>
          )}
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

      <section className="mt-8">
        <PayoutThresholdCard payableCents={earnings.payable_cents} />
      </section>

      <section className="mt-6">
        <PixKeyCard initialPixKey={pixKey} />
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

function PayoutThresholdCard({ payableCents }: { payableCents: number }) {
  const min = MIN_PAYOUT_CENTS;
  const pct = Math.min(100, Math.round((payableCents / min) * 100));
  const reached = payableCents >= min;
  const remaining = Math.max(0, min - payableCents);

  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-prep">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          Pagamento automático via Pix
        </p>
        {reached ? (
          <span className="rounded-pill bg-green-soft px-2 py-0.5 text-xs font-semibold text-green-700">
            Próximo pagamento programado
          </span>
        ) : (
          <span className="rounded-pill bg-yellow-soft px-2 py-0.5 text-xs font-semibold text-yellow-700">
            Falta R$ {(remaining / 100).toFixed(2)}
          </span>
        )}
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className={
            reached
              ? "h-full bg-green-500 transition-all"
              : "h-full bg-orange-500 transition-all"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
        <span>R$ {(payableCents / 100).toFixed(2)} disponível</span>
        <span>Mínimo R$ {(min / 100).toFixed(2)}</span>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Quando seu saldo a receber atinge R$ {(min / 100).toFixed(0)}, o Pix é
        disparado automaticamente na chave cadastrada abaixo. Abaixo desse
        valor, o saldo acumula pro próximo ciclo.
      </p>
    </div>
  );
}

function StatusBanner({
  tone,
  title,
  body,
}: {
  tone: "yellow" | "red" | "green";
  title: string;
  body: string;
}) {
  const map = {
    yellow: "border-yellow-500/40 bg-yellow-soft text-yellow-700",
    red: "border-red-500/40 bg-red-soft text-red-500",
    green: "border-green-500/40 bg-green-soft text-green-700",
  } as const;
  return (
    <div className={`rounded-xl border p-5 ${map[tone]}`}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-sm text-ink-2">{body}</p>
    </div>
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
