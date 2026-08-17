"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  deleteFailedPrep,
  retryPrep,
  type RetryPrepState,
} from "@/app/prep/new/actions";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { useCheckoutFlow } from "@/components/billing/useCheckoutFlow";
import { PendingButton } from "./PendingButton";
import { ErrorDetails } from "./ErrorDetails";

/**
 * `retryPrep` passou a consumir 1 crédito (decisão do dono do produto: sem
 * isso, devolver o crédito na falha + regenerar de graça no retry pagava
 * duas vezes o mesmo erro). Por isso este componente virou client + usa
 * `useActionState`, igual `NewPrepForm`/`GenerateFullPrepCta` — precisa de
 * um jeito de mostrar "sem crédito" quando o retry também esbarra na cota.
 */
export function PrepFailed({
  id,
  errorMessage,
}: {
  id: string;
  errorMessage: string | null;
}) {
  const boundRetry = retryPrep.bind(null, id);
  const [state, retryAction, pending] = useActionState<RetryPrepState, FormData>(
    boundRetry,
    {},
  );
  const deleteAction = deleteFailedPrep.bind(null, id);
  const checkout = useCheckoutFlow();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-lg border border-red-900 bg-red-950/30 p-6">
        <h1 className="text-xl font-semibold text-red-200">
          Não conseguimos gerar sua preparação.
        </h1>
        <p className="mt-2 text-sm text-red-300">
          Algo deu errado ao chamar a IA. O botão Tentar novamente reaproveita o
          mesmo CV e a mesma descrição da vaga. Não precisa colar de novo.
        </p>
        {errorMessage && <ErrorDetails raw={errorMessage} />}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <form action={retryAction}>
          <PendingButton
            idleLabel="Tentar novamente"
            pendingLabel="Tentando… cerca de 30 segundos"
            variant="primary"
          />
        </form>
        <form action={deleteAction}>
          <PendingButton
            idleLabel="Excluir e começar de novo"
            pendingLabel="Excluindo…"
            variant="secondary"
          />
        </form>
        <Link href="/dashboard">
          <Button variant="ghost">Voltar ao dashboard</Button>
        </Link>
      </div>

      {state.error && !pending && state.error !== "quota_exceeded" ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/40 bg-red-soft px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <UpgradeModal
        open={state.error === "quota_exceeded" && !pending}
        onClose={() => {
          window.location.reload();
        }}
        onCheckout={(kind) => checkout.start(kind)}
      />
      {checkout.error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500 bg-red-soft px-3 py-2 text-sm text-red-700"
        >
          {checkout.error}
        </p>
      ) : null}
      {checkout.dialog}
    </main>
  );
}
