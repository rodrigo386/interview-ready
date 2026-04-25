import { createClient } from "@/lib/supabase/server";
import { brlLabel } from "@/lib/billing/prices";

type Row = {
  id: string;
  asaas_payment_id: string;
  kind: "pro_subscription" | "prep_purchase";
  amount_cents: number;
  status: string;
  paid_at: string | null;
  created_at: string;
};

const KIND_LABEL: Record<Row["kind"], string> = {
  pro_subscription: "Assinatura Pro",
  prep_purchase: "Prep avulso",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  received: "Pago",
  refunded: "Reembolsado",
  overdue: "Em atraso",
  failed: "Falhou",
};

export async function BillingHistoryList() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("payments")
    .select("id, asaas_payment_id, kind, amount_cents, status, paid_at, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as Row[];

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-text-tertiary">
        Nenhum pagamento registrado.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg p-3 text-sm"
        >
          <div>
            <p className="font-semibold text-text-primary">{KIND_LABEL[r.kind]}</p>
            <p className="text-xs text-text-tertiary">
              {new Date(r.paid_at ?? r.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-text-primary">{brlLabel(r.amount_cents)}</p>
            <p className="text-xs text-text-tertiary">{STATUS_LABEL[r.status] ?? r.status}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
