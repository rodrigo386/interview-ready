"use client";

import { useActionState, useState } from "react";
import {
  saveBillingAddress,
  type SaveAddressState,
} from "@/app/(app)/dashboard/address-actions";

/**
 * Pede o endereço fiscal DEPOIS do pagamento, sem bloquear nada.
 *
 * Substitui o diálogo obrigatório que ficava dentro do checkout. A regra que
 * este componente encarna: cobrar dado que serve pra emitir nota — coisa que
 * acontece depois — não pode ficar entre a pessoa e o pagamento.
 *
 * Por isso é dispensável (botão "Agora não"): quem acabou de pagar não pode
 * ser travado numa tela. O aviso reaparece na próxima visita enquanto o
 * endereço faltar, porque a obrigação fiscal não some — só não é urgente ao
 * ponto de custar a venda.
 */
export function NfseAddressPrompt() {
  const [aberto, setAberto] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const [state, action, pending] = useActionState<SaveAddressState, FormData>(
    saveBillingAddress,
    {},
  );

  if (dispensado || state.ok) return null;

  return (
    <section className="rounded-xl border border-neutral-200 bg-bg p-4 dark:border-zinc-800">
      <p className="text-sm font-semibold text-text-primary">
        Falta seu endereço para a nota fiscal
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        Leva 30 segundos e não afeta nada do que você já comprou — seus
        créditos estão liberados.
      </p>

      {!aberto ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Informar endereço
          </button>
          <button
            type="button"
            onClick={() => setDispensado(true)}
            className="rounded-md px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            Agora não
          </button>
        </div>
      ) : (
        <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Campo nome="postalCode" rotulo="CEP" placeholder="01310-100" />
          <Campo nome="addressStreet" rotulo="Rua" />
          <Campo nome="addressNumber" rotulo="Número" />
          <Campo nome="addressComplement" rotulo="Complemento (opcional)" opcional />
          <Campo nome="addressDistrict" rotulo="Bairro" />
          <Campo nome="addressCity" rotulo="Cidade" />
          <Campo nome="addressState" rotulo="UF" placeholder="SP" />
          <div className="sm:col-span-2">
            {state.error && (
              <p role="alert" className="mb-2 text-sm text-red-600">
                {state.error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "Salvando…" : "Salvar endereço"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Campo({
  nome,
  rotulo,
  placeholder,
  opcional,
}: {
  nome: string;
  rotulo: string;
  placeholder?: string;
  opcional?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
      {rotulo}
      <input
        name={nome}
        required={!opcional}
        placeholder={placeholder}
        className="rounded-md border border-neutral-200 bg-bg px-3 py-2 text-sm text-text-primary dark:border-zinc-800"
      />
    </label>
  );
}
