"use client";

import { useProfileShell } from "@/components/profile/ProfileShellProvider";
import { CheckoutButton } from "./CheckoutButton";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { PREP_SKUS, brlLabel } from "@/lib/billing/prices";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Não existe mais assinatura pra vender — o produto pago é crédito avulso
 * de preparação completa (PREP_SKUS). `subscriptionStatus` ainda pode
 * trazer um estado legado (assinante de antes da migração pra crédito);
 * quando isso acontece, mostramos um aviso + o botão de cancelar, sem
 * oferecer reativação — não há mais o que reativar.
 */
export function PlanCard() {
  const data = useProfileShell();
  const status = data.subscriptionStatus;
  const legacySubscription = status === "active" || status === "overdue";

  return (
    <div className="rounded-md border border-border p-4">
      {legacySubscription && (
        <div className="mb-4 rounded-md border border-yellow-500 bg-yellow-soft p-3">
          <p className="text-sm text-text-primary">
            {status === "overdue"
              ? "⚠️ Pagamento em atraso na sua assinatura anterior."
              : `Assinatura anterior ativa até ${formatDate(data.subscriptionRenewsAt)}.`}{" "}
            A assinatura Pro saiu de linha — agora é só crédito avulso.
          </p>
          <div className="mt-2">
            <CancelSubscriptionDialog />
          </div>
        </div>
      )}

      <p className="text-sm text-text-primary">
        Você tem{" "}
        <strong>
          {data.prepCredits} {data.prepCredits === 1 ? "crédito" : "créditos"}
        </strong>{" "}
        de preparação completa.
      </p>
      <p className="mt-1 text-xs text-text-tertiary">
        A análise ATS é sempre gratuita. Cada crédito libera 1 preparação completa.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PREP_SKUS.map((sku) => (
          <CheckoutButton
            key={sku.qty}
            qty={sku.qty}
            variant={sku.qty === 1 ? "primary" : "ghost"}
          >
            {sku.qty === 1
              ? `Comprar 1 · ${brlLabel(sku.cents)}`
              : `${sku.qty} por ${brlLabel(sku.cents)}`}
          </CheckoutButton>
        ))}
      </div>
    </div>
  );
}
