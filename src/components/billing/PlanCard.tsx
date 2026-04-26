"use client";

import { useProfileShell } from "@/components/profile/ProfileShellProvider";
import { CheckoutButton } from "./CheckoutButton";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PlanCard() {
  const data = useProfileShell();
  const status = data.subscriptionStatus;

  if (status === "active") {
    return (
      <div className="rounded-md border border-border p-4">
        <p className="text-sm text-text-primary">
          Plano <strong>Pro</strong>. Renova em {formatDate(data.subscriptionRenewsAt)}.
        </p>
        {data.prepCredits > 0 && (
          <p className="mt-1 text-xs text-text-tertiary">
            +{data.prepCredits} {data.prepCredits === 1 ? "crédito avulso" : "créditos avulsos"}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <CancelSubscriptionDialog />
        </div>
      </div>
    );
  }

  if (status === "overdue") {
    return (
      <div className="rounded-md border border-yellow-500 bg-yellow-soft p-4">
        <p className="text-sm text-text-primary">
          ⚠️ Pagamento em atraso. Atualize seu cartão pra manter o Pro.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CheckoutButton kind="pro_subscription">Atualizar pagamento</CheckoutButton>
          <CancelSubscriptionDialog />
        </div>
      </div>
    );
  }

  if (status === "canceled") {
    return (
      <div className="rounded-md border border-border p-4">
        <p className="text-sm text-text-primary">
          Cancelado. Acesso Pro até {formatDate(data.subscriptionRenewsAt)}.
        </p>
        <div className="mt-3">
          <CheckoutButton kind="pro_subscription">Reativar Pro</CheckoutButton>
        </div>
      </div>
    );
  }

  // none / expired
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-sm text-text-primary">
        Plano <strong>Free</strong>: 1 prep grátis no cadastro.
      </p>
      {data.prepCredits > 0 && (
        <p className="mt-1 text-xs text-text-tertiary">
          Você tem {data.prepCredits}{" "}
          {data.prepCredits === 1 ? "crédito avulso" : "créditos avulsos"}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <CheckoutButton kind="pro_subscription">Assinar Pro · R$ 30/mês</CheckoutButton>
        <CheckoutButton kind="prep_purchase" variant="ghost">Comprar 1 prep · R$ 10</CheckoutButton>
      </div>
    </div>
  );
}
