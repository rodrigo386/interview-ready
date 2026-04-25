"use client";

import { useTransition } from "react";

export async function startCheckout(kind: "pro_subscription" | "prep_purchase"): Promise<void> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Checkout falhou (HTTP ${res.status})`);
  }
  const { checkoutUrl } = (await res.json()) as { checkoutUrl?: string };
  if (!checkoutUrl) throw new Error("Asaas não retornou link de checkout");
  window.location.href = checkoutUrl;
}

export function CheckoutButton({
  kind,
  children,
  variant,
}: {
  kind: "pro_subscription" | "prep_purchase";
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await startCheckout(kind);
          } catch (err) {
            alert(err instanceof Error ? err.message : "Erro");
          }
        })
      }
      className={
        variant === "ghost"
          ? "rounded-pill border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-bg disabled:opacity-60"
          : "rounded-pill bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      }
    >
      {pending ? "Abrindo…" : children}
    </button>
  );
}
