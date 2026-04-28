import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pagamentos · Admin · PrepaVAGA",
  robots: { index: false, follow: false },
};

const STATUS_BADGE: Record<string, string> = {
  received: "bg-green-soft text-green-700 dark:bg-green-950/40 dark:text-green-300",
  confirmed: "bg-green-soft text-green-700 dark:bg-green-950/40 dark:text-green-300",
  pending: "bg-yellow-soft text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  overdue: "bg-yellow-soft text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  refunded: "bg-neutral-100 text-text-secondary dark:bg-zinc-800",
  failed: "bg-red-soft text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export default async function PaymentsAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; kind?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const status = params.status ?? "";
  const kind = params.kind ?? "";

  const sb = createAdminClient();
  let q = sb
    .from("payments")
    .select("id, user_id, asaas_payment_id, kind, amount_cents, status, billing_method, paid_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  if (kind) q = q.eq("kind", kind);
  const { data: payments } = await q;

  const list = (payments as Array<{
    id: string;
    user_id: string;
    asaas_payment_id: string;
    kind: string;
    amount_cents: number;
    status: string;
    billing_method: string | null;
    paid_at: string | null;
    created_at: string;
  }> | null) ?? [];

  const userIds = [...new Set(list.map((p) => p.user_id))];
  const profiles = userIds.length
    ? await sb.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };
  const emailById = new Map(
    ((profiles.data as { id: string; email: string }[] | null) ?? []).map((p) => [p.id, p.email]),
  );

  const totalCents = list
    .filter((p) => p.status === "received" || p.status === "confirmed")
    .reduce((acc, p) => acc + p.amount_cents, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Pagamentos
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {list.length} transações nesta página · Receita confirmada: R${" "}
          {(totalCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3" action="/admin/payments">
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          Status
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-neutral-200 bg-bg px-3 py-2 text-sm dark:border-zinc-800"
          >
            <option value="">Todos</option>
            <option value="received">received</option>
            <option value="confirmed">confirmed</option>
            <option value="pending">pending</option>
            <option value="overdue">overdue</option>
            <option value="refunded">refunded</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          Tipo
          <select
            name="kind"
            defaultValue={kind}
            className="rounded-md border border-neutral-200 bg-bg px-3 py-2 text-sm dark:border-zinc-800"
          >
            <option value="">Todos</option>
            <option value="pro_subscription">Pro</option>
            <option value="prep_purchase">Avulso</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-text-tertiary dark:bg-zinc-900/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Usuário</th>
                <th className="px-4 py-2.5 text-left font-semibold">Tipo</th>
                <th className="px-4 py-2.5 text-left font-semibold">Valor</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold">Método</th>
                <th className="px-4 py-2.5 text-left font-semibold">Pago em</th>
                <th className="px-4 py-2.5 text-left font-semibold">Asaas ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-zinc-800">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-text-tertiary">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              ) : (
                list.map((p) => (
                  <tr key={p.id} className="bg-bg hover:bg-neutral-50/60 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 text-text-primary">
                      {emailById.get(p.user_id) ?? p.user_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {p.kind === "pro_subscription" ? "Pro" : "Avulso"}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-primary">
                      R$ {(p.amount_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                          (STATUS_BADGE[p.status] ?? "bg-neutral-100 text-text-secondary dark:bg-zinc-800")
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-tertiary">{p.billing_method ?? "-"}</td>
                    <td className="px-4 py-3 text-text-tertiary">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-text-tertiary">
                      {p.asaas_payment_id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
