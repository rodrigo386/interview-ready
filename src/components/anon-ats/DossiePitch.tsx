import Link from "next/link";
import { DOSSIE_INCLUI, precoCurto } from "@/lib/billing/dossie";

/**
 * O que os R$10 destravam, na página onde a pessoa acabou de ver o score.
 *
 * Este bloco nasceu de uma análise de funil real: em 18/08/2026 as duas únicas
 * pessoas que rodaram a análise grátis criaram conta em ~52 segundos e pararam
 * no paywall sem comprar. O motivo estrutural é que a única página que
 * explicava o produto pago era a home, e uma delas nunca carregou a home — foi
 * direto pra ferramenta. O pitch precisa morar aqui, no ponto de maior
 * intenção, não só na landing.
 *
 * O CTA continua sendo o cadastro, não o checkout: cobrar de quem não tem
 * conta exigiria coletar CPF e criar cliente no Asaas antes de existir um
 * usuário. O que muda é que a pessoa passa a saber o preço e o que ele compra
 * ANTES de se cadastrar, em vez de descobrir depois, por tropeço.
 */
export function DossiePitch() {
  return (
    <section className="rounded-lg border-2 border-orange-500 bg-orange-soft/40 p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-bold text-ink">
          O score é grátis. A preparação para a entrevista custa {precoCurto()}.
        </h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-ink-2">
        Você já viu onde seu currículo trava. A preparação completa resolve a
        entrevista inteira, reaproveitando o mesmo currículo e a mesma vaga que
        você acabou de enviar.
      </p>

      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {DOSSIE_INCLUI.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm text-ink">
            <span
              aria-hidden
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white"
            >
              ✓
            </span>
            <span className="leading-[1.5]">{item}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/signup"
        data-analytics-cta="anon_resultado_dossie"
        data-analytics-location="anon_ats_resultado"
        className="mt-5 inline-flex rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
      >
        Criar conta e preparar esta entrevista →
      </Link>
      <p className="mt-3 text-xs text-ink-3">
        A conta é grátis e sua análise já fica salva nela. O pagamento só
        aparece quando você mandar gerar a preparação. Sem assinatura, o crédito
        não expira, e você tem 7 dias para pedir o dinheiro de volta.
      </p>
    </section>
  );
}
