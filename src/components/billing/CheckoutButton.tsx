"use client";

import { useTransition } from "react";

async function postCheckout(body: {
  kind: "pro_subscription" | "prep_purchase";
  cpfCnpj?: string;
}): Promise<Response> {
  return fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function promptCpf(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.prompt(
    "Pra emitir a cobrança, o Asaas exige seu CPF (ou CNPJ). Digite só os números:",
  );
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 11 && digits.length !== 14) {
    window.alert("CPF/CNPJ inválido. Use 11 dígitos (CPF) ou 14 (CNPJ).");
    return null;
  }
  return digits;
}

export async function startCheckout(kind: "pro_subscription" | "prep_purchase"): Promise<void> {
  let res = await postCheckout({ kind });

  // First attempt may return 422 cpf_required when the user has never paid
  // before. Prompt for CPF and retry once.
  if (res.status === 422) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (data.error === "cpf_required") {
      const cpfCnpj = promptCpf();
      if (!cpfCnpj) return; // user canceled
      res = await postCheckout({ kind, cpfCnpj });
    }
  }

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
