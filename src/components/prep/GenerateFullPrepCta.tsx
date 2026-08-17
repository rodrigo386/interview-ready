"use client";

import { useActionState } from "react";
import {
  generateFullPrep,
  type GenerateFullPrepState,
} from "@/app/prep/[id]/full-prep-actions";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { useCheckoutFlow } from "@/components/billing/useCheckoutFlow";
import { PendingButton } from "./PendingButton";

/**
 * Única saída de uma prep que veio da ferramenta ATS anônima: ela chega com a
 * etapa 2 pronta e as etapas 1, 3, 4 e 5 vazias, e nada dispara o pipeline
 * automaticamente (gerar consome 1 crédito, então tem que ser escolha da
 * pessoa).
 *
 * Trata `quota_exceeded` do mesmo jeito que o `NewPrepForm` do /prep/new,
 * porque é a mesma cota sendo cobrada.
 */
export function GenerateFullPrepCta({
  sessionId,
  variant = "full",
}: {
  sessionId: string;
  /** "compact" para quando o painel ao redor já explicou o contexto. */
  variant?: "full" | "compact";
}) {
  const bound = generateFullPrep.bind(null, sessionId);
  const [state, action, pending] = useActionState<GenerateFullPrepState, FormData>(
    bound,
    {},
  );
  const checkout = useCheckoutFlow();

  return (
    <section className="rounded-xl border border-orange-500 bg-orange-soft/40 p-5 shadow-prep">
      {variant === "full" ? (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700">
            Continue de onde parou
          </p>
          <h2 className="mt-1 text-lg font-bold text-ink">
            Gerar a preparação completa desta vaga
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-2">
            Sua análise de currículo já está aqui. A preparação completa
            acrescenta pesquisa recente da empresa, faixa salarial estimada,
            perguntas prováveis com roteiro de resposta e as perguntas que você
            faz no fim. Reaproveita o mesmo currículo e a mesma vaga — você não
            precisa colar nada de novo.
          </p>
          <p className="mt-2 text-xs text-ink-3">
            Leva cerca de 60 segundos e usa 1 preparação da sua conta.
          </p>
        </>
      ) : null}

      <form action={action} className={variant === "full" ? "mt-4" : undefined}>
        <PendingButton
          idleLabel="Gerar preparação completa →"
          pendingLabel="Gerando… cerca de 60 segundos"
          variant="primary"
        />
      </form>

      {state.error && !pending && state.error !== "quota_exceeded" ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-500/40 bg-red-soft px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <UpgradeModal
        open={state.error === "quota_exceeded" && !pending}
        onClose={() => {
          window.location.reload();
        }}
        onCheckout={(kind, qty) => checkout.start(kind, qty)}
      />
      {checkout.error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-500 bg-red-soft px-3 py-2 text-sm text-red-700"
        >
          {checkout.error}
        </p>
      ) : null}
      {checkout.dialog}
    </section>
  );
}
