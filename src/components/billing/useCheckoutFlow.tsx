"use client";

import { useRef, useState, useTransition } from "react";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import {
  AddressDialog,
  type AddressDialogValue,
} from "./AddressDialog";

type Kind = "pro_subscription" | "prep_purchase";

type CheckoutBody = {
  kind: Kind;
  cpfCnpj?: string;
  address?: AddressDialogValue;
};

async function postCheckout(body: CheckoutBody): Promise<Response> {
  return fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Orquestra o fluxo de checkout:
 *  1. POST /api/billing/checkout
 *  2. Se 422 cpf_required → modal CPF/CNPJ → re-tenta
 *  3. Se 422 address_required → modal endereço (com CEP autocomplete) → re-tenta
 *  4. Sucesso: redireciona pro Asaas. Erro: expõe `error` pro caller.
 *
 * Retorna `{ start, pending, error, dialog }` — render `dialog` uma vez na árvore.
 */
export function useCheckoutFlow() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // CPF dialog state
  const [cpfOpen, setCpfOpen] = useState(false);
  const [cpfValue, setCpfValue] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const cpfResolverRef = useRef<((cpf: string | null) => void) | null>(null);
  const cpfFormRef = useRef<HTMLFormElement>(null);
  const cpfInputRef = useRef<HTMLInputElement>(null);

  // Address dialog state
  const [addressOpen, setAddressOpen] = useState(false);
  const addressResolverRef = useRef<
    ((value: AddressDialogValue | null) => void) | null
  >(null);

  const closeCpf = () => {
    if (pending) return;
    setCpfOpen(false);
    setCpfValue("");
    setCpfError(null);
    cpfResolverRef.current?.(null);
    cpfResolverRef.current = null;
  };
  useDialogFocus(cpfOpen, cpfFormRef, closeCpf, cpfInputRef);

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

  function askAddress(): Promise<AddressDialogValue | null> {
    return new Promise((resolve) => {
      addressResolverRef.current = resolve;
      setAddressOpen(true);
    });
  }

  function onAddressSubmit(value: AddressDialogValue) {
    setAddressOpen(false);
    addressResolverRef.current?.(value);
    addressResolverRef.current = null;
  }

  function onAddressCancel() {
    setAddressOpen(false);
    addressResolverRef.current?.(null);
    addressResolverRef.current = null;
  }

  function start(kind: Kind) {
    setError(null);
    startTransition(async () => {
      try {
        let body: CheckoutBody = { kind };
        let res = await postCheckout(body);

        // 2 possíveis 422s: cpf_required, address_required. Pode disparar
        // ambos em sequência se user veio do OAuth Google sem nada.
        for (let i = 0; i < 3; i++) {
          if (res.status !== 422) break;
          const data = (await res.clone().json().catch(() => ({}))) as {
            error?: string;
          };
          if (data.error === "cpf_required") {
            const cpfCnpj = await askCpf();
            if (!cpfCnpj) return;
            body = { ...body, cpfCnpj };
            res = await postCheckout(body);
            continue;
          }
          if (data.error === "address_required") {
            const address = await askAddress();
            if (!address) return;
            body = { ...body, address };
            res = await postCheckout(body);
            continue;
          }
          break;
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

  const cpfDialog = cpfOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cpf-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={closeCpf}
    >
      <form
        ref={cpfFormRef}
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
          ref={cpfInputRef}
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

  const dialog = (
    <>
      {cpfDialog}
      <AddressDialog
        open={addressOpen}
        onCancel={onAddressCancel}
        onSubmit={onAddressSubmit}
        pending={pending}
      />
    </>
  );

  return { start, pending, error, dialog };
}
