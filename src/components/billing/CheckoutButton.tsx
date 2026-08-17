"use client";

import { useCheckoutFlow } from "./useCheckoutFlow";
import { track } from "@/lib/analytics/client";
import { findSku } from "@/lib/billing/prices";

/**
 * Sempre compra preparação avulsa (`prep_purchase`) — não existe mais
 * assinatura pra vender. `qty` decide o SKU e viaja no POST.
 */
export function CheckoutButton({
  qty,
  children,
  variant,
}: {
  qty: number;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const { start, pending, error, dialog } = useCheckoutFlow();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          // Emitido aqui (no clique), não dentro do useCheckoutFlow, porque
          // é o único ponto que representa UMA intenção de compra — o
          // useCheckoutFlow pode reenviar o POST até 2x por causa dos 422s
          // de cpf_required/address_required, e o evento não pode repetir
          // por tentativa (Task 9).
          track("checkout_iniciado", { qty, cents: findSku(qty)?.cents ?? 0 });
          start("prep_purchase", qty);
        }}
        className={
          variant === "ghost"
            ? "rounded-pill border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-bg disabled:opacity-60"
            : "rounded-pill bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        }
      >
        {pending ? "Abrindo…" : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-500">
          {error}
        </p>
      )}
      {dialog}
    </>
  );
}
