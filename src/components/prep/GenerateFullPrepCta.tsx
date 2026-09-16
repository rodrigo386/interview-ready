"use client";

import { useActionState } from "react";
import {
  generateFullPrep,
  type GenerateFullPrepState,
} from "@/app/prep/[id]/full-prep-actions";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { useCheckoutFlow } from "@/components/billing/useCheckoutFlow";
import { usePrepShellOptional } from "./PrepShellProvider";
import { precoCurto } from "@/lib/billing/dossie";
import { PendingButton } from "./PendingButton";
import { PagamentoSeguro } from "@/components/billing/PagamentoSeguro";

/**
 * Única saída de uma prep que veio da ferramenta ATS anônima: ela chega com a
 * etapa 2 pronta e as etapas 1, 3, 4 e 5 vazias, e nada dispara o pipeline
 * automaticamente (gerar consome 1 crédito, então tem que ser escolha da
 * pessoa).
 *
 * Trata `quota_exceeded` do mesmo jeito que o `NewPrepForm` do /prep/new,
 * porque é a mesma cota sendo cobrada.
 *
 * O preço aparece no botão quando o saldo é zero. Antes o rótulo dizia apenas
 * "usa 1 preparação da sua conta" — uma frase sobre um recurso que a pessoa
 * não tinha — e o custo só era descoberto ao clicar e receber o paywall. Com
 * saldo zero o clique também vai direto pro checkout, em vez de disparar uma
 * action que já se sabe que vai falhar com `quota_exceeded`.
 */
export function GenerateFullPrepCta({
  sessionId,
  variant = "full",
  needsCompany = false,
  needsRole = false,
  score,
  projected,
  faltando = [],
}: {
  sessionId: string;
  /** "compact" para quando o painel ao redor já explicou o contexto. */
  variant?: "full" | "compact";
  /**
   * A vaga não disse qual é a empresa. Mostra o campo ANTES do clique em vez
   * de recusar depois: a pessoa já decidiu pagar, e devolver um erro nesse
   * ponto gastaria a intenção pra pedir uma informação que dava pra ter
   * pedido junto. O servidor valida de novo — isto aqui é conveniência, não
   * é o gate.
   */
  needsCompany?: boolean;
  /**
   * A vaga não disse qual é o cargo. Custo diferente do `needsCompany`: sem
   * cargo a geração continua boa, mas o relatório sai intitulado "esta vaga".
   */
  needsRole?: boolean;
  /** Nota atual e teto projetado — só a tela /ats tem a análise pra passar. */
  score?: number;
  projected?: number;
  /** Palavras críticas/importantes que o CV não tem. */
  faltando?: string[];
}) {
  const bound = generateFullPrep.bind(null, sessionId);
  const [state, action, pending] = useActionState<GenerateFullPrepState, FormData>(
    bound,
    {},
  );
  const checkout = useCheckoutFlow();
  // null fora do shell (testes de componente): saldo desconhecido cai no
  // caminho neutro, que é submeter e deixar a action decidir.
  const shell = usePrepShellOptional();
  const credits = shell?.prepCredits ?? null;
  const semSaldo = credits === 0;

  return (
    <section className="rounded-xl border border-orange-500 bg-orange-soft/40 p-5 shadow-prep">
      {variant === "full" ? (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700">
            Continue de onde parou
          </p>
          {/* Lidera com o currículo, não com "preparação completa": quem acabou
              de ver a própria nota quer resolver o currículo primeiro, e é a
              parte que Gupy e SENAI — que dão perguntas de graça — não fazem.
              Ver DossiePitch, que tem a mesma decisão pro visitante anônimo. */}
          <h2 className="mt-1 text-lg font-bold text-ink">
            Seu currículo reescrito para esta vaga
          </h2>
          {typeof score === "number" &&
          typeof projected === "number" &&
          projected > score ? (
            <p className="mt-2 text-sm leading-6 text-ink">
              Hoje ele tira <strong>{score}</strong>. Incorporando o que falta, pode
              chegar a <strong className="text-orange-700">até {projected}</strong>.
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-ink-2">
            {faltando.length > 0 ? (
              <>
                Reescrevemos incluindo{" "}
                {faltando.map((t, i) => (
                  <span key={t}>
                    {i > 0 && (i === faltando.length - 1 ? " e " : ", ")}
                    <strong>{t}</strong>
                  </span>
                ))}
                . E junto vêm a pesquisa recente da empresa, a faixa salarial
                estimada e as perguntas prováveis com roteiro.
              </>
            ) : (
              <>
                Pronto para colar. E junto vêm a pesquisa recente da empresa, a
                faixa salarial estimada e as perguntas prováveis com roteiro —
                reaproveitando o mesmo currículo e a mesma vaga.
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-ink-3">
            Leva cerca de 60 segundos.{" "}
            {semSaldo
              ? `Custa ${precoCurto()}, pagamento avulso: sem assinatura, o crédito não expira e você tem 7 dias para pedir reembolso.`
              : credits !== null
                ? `Usa 1 das suas ${credits} preparações disponíveis.`
                : "Usa 1 preparação da sua conta."}
          </p>
        </>
      ) : null}

      {semSaldo ? (
        <button
          type="button"
          onClick={() => checkout.start("prep_purchase", 1)}
          disabled={checkout.pending}
          data-analytics-cta="full_prep_checkout"
          className={
            "inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70 " +
            (variant === "full" ? "mt-4" : "")
          }
        >
          {checkout.pending
            ? "Abrindo pagamento…"
            : `Reescrever meu currículo · ${precoCurto()} →`}
        </button>
      ) : null}
      {semSaldo ? <PagamentoSeguro className="mt-2" /> : null}
      {semSaldo ? null : (
        <form action={action} className={variant === "full" ? "mt-4" : undefined}>
          {(needsCompany || needsRole) && (
            <p className="mb-3 text-xs text-ink-3">
              O texto que você colou não trazia{" "}
              {needsCompany && needsRole
                ? "o cargo nem a empresa"
                : needsCompany
                  ? "o nome da empresa"
                  : "o nome do cargo"}
              . Complete abaixo para o dossiê sair com os dados certos.
            </p>
          )}

          {needsRole && (
            <div className="mb-3">
              <label
                htmlFor="jobTitle"
                className="block text-sm font-semibold text-ink"
              >
                Qual é o cargo da vaga?
              </label>
              <input
                id="jobTitle"
                name="jobTitle"
                required
                maxLength={120}
                placeholder="Ex.: Desenvolvedor Full Stack Pleno"
                className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
              />
            </div>
          )}

          {needsCompany && (
            <div className="mb-3">
              <label
                htmlFor="companyName"
                className="block text-sm font-semibold text-ink"
              >
                Qual é a empresa dessa vaga?
              </label>
              <p className="mt-0.5 text-xs text-ink-3">
                Sem isso não dá pra pesquisar a empresa — que é parte do que
                você está comprando.
              </p>
              <input
                id="companyName"
                name="companyName"
                required
                maxLength={120}
                placeholder="Ex.: Nubank"
                className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
              />
            </div>
          )}
          <PendingButton
            idleLabel="Gerar preparação completa →"
            pendingLabel="Gerando… cerca de 60 segundos"
            variant="primary"
          />
        </form>
      )}

      {(state.error === "company_required" || state.error === "role_required") &&
      !pending ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-soft px-4 py-3 text-sm text-yellow-700"
        >
          Preencha os campos acima antes de gerar — nenhum crédito foi usado.
        </p>
      ) : null}

      {state.error &&
      !pending &&
      state.error !== "quota_exceeded" &&
      state.error !== "company_required" &&
      state.error !== "role_required" ? (
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
