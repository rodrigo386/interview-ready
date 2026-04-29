"use client";

import { useRef, useState, useTransition } from "react";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

type Kind = "pro_subscription" | "prep_purchase";

async function postCheckout(body: { kind: Kind; cpfCnpj?: string }): Promise<Response> {
  return fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Encapsulates the checkout flow:
 *  1. POST /api/billing/checkout
 *  2. If 422 cpf_required, opens an inline modal asking for CPF/CNPJ,
 *     then retries with the entered value.
 *  3. On success, redirects the browser to Asaas checkout URL.
 *  4. On error, exposes a string in `error` for the caller to render
 *     near the trigger button (no `window.alert`).
 *
 * Returns `{ start, pending, error, dialog }` — render `dialog` once
 * somewhere in the tree (it portals to fixed positioning).
 */
export function useCheckoutFlow() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cpfOpen, setCpfOpen] = useState(false);
  const [cpfValue, setCpfValue] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);

  const cpfResolverRef = useRef<((cpf: string | null) => void) | null>(null);

  const dialogRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeCpf = () => {
    if (pending) return;
    setCpfOpen(false);
    setCpfValue("");
    setCpfError(null);
    cpfResolverRef.current?.(null);
    cpfResolverRef.current = null;
  };
  useDialogFocus(cpfOpen, dialogRef, closeCpf, inputRef);

  function askCpf(): Promise<string | null> {
    return new Promise((resolve) => {
      cpfResolverRef.current = resolve;
      setCpfValue("");
      setCpfError(null);
      setCpfOpen(true);
    });
  }

  function submitCpf(e: React.FormEvent) {
    e.preventDefault();
    const digits = cpfValue.replace(/[^0-9]/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      setCpfError("Use 11 dígitos (CPF) ou 14 (CNPJ).");
      return;
    }
    setCpfOpen(false);
    setCpfError(null);
    setCpfValue("");
    cpfResolverRef.current?.(digits);
    cpfResolverRef.current = null;
  }

  function start(kind: Kind) {
    setError(null);
    startTransition(async () => {
      try {
        let res = await postCheckout({ kind });

        if (res.status === 422) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (data.error === "cpf_required") {
            const cpfCnpj = await askCpf();
            if (!cpfCnpj) return; // user canceled
            res = await postCheckout({ kind, cpfCnpj });
          }
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? `Checkout falhou (HTTP ${res.status})`);
          return;
        }

        const { checkoutUrl } = (await res.json()) as { checkoutUrl?: string };
        if (!checkoutUrl) {
          setError("Asaas não retornou link de checkout. Tente novamente.");
          return;
        }
        window.location.href = checkoutUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado.");
      }
    });
  }

  const dialog = cpfOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cpf-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={closeCpf}
    >
      <form
        ref={dialogRef}
        onSubmit={submitCpf}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-lg bg-bg p-5 shadow-prep"
      >
        <h3 id="cpf-dialog-title" className="text-base font-semibold text-text-primary">
          Confirme seu CPF (ou CNPJ)
        </h3>
        <p className="text-sm text-text-secondary">
          O Asaas exige CPF/CNPJ pra emitir a cobrança. Informe só os números.
        </p>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={cpfValue}
          onChange={(e) => setCpfValue(e.target.value)}
          placeholder="000.000.000-00"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        />
        {cpfError && <p className="text-sm text-red-500">{cpfError}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={closeCpf}
            className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Continuar
          </button>
        </div>
      </form>
    </div>
  ) : null;

  return { start, pending, error, dialog };
}
