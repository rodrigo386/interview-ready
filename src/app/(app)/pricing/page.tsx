import Link from "next/link";
import { CheckoutButton } from "@/components/billing/CheckoutButton";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl py-6">
      <header className="mb-10 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
          Planos PrepaVAGA
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
          Escolha como entrar mais preparado nas entrevistas
        </h1>
        <p className="mt-3 text-sm text-ink-2">
          Cancele quando quiser. Sem letras miúdas.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <article className="relative flex flex-col rounded-2xl border-2 border-orange-500 bg-white p-6 shadow-prep">
          <span className="absolute -top-3 left-6 rounded-pill bg-orange-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-prep">
            Promoção de lançamento
          </span>
          <header>
            <h2 className="text-xl font-extrabold text-ink">Plano Pro</h2>
            <p className="mt-1 text-sm text-ink-2">Preps ilimitados, todo mês.</p>
          </header>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-ink-3 line-through">
              R$ 50
            </span>
            <span className="text-4xl font-extrabold text-orange-700">
              R$ 30
            </span>
            <span className="text-sm text-ink-2">/mês</span>
          </div>
          <p className="mt-1 text-xs text-orange-700">
            Preço promocional de lançamento.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm text-ink-2">
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>
                <strong>Preps ilimitados</strong>: quantas vagas você quiser por mês
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>Análise ATS completa do seu CV vs. cada vaga</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>Pesquisa da empresa com notícias dos últimos 6 meses</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>CV reescrito otimizado por vaga (download DOCX)</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>Perguntas básicas, aprofundamento e perguntas estratégicas</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>Exportar resumo em PDF</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>Cancele a qualquer momento</span>
            </li>
          </ul>

          <div className="mt-7">
            <CheckoutButton kind="pro_subscription">
              Assinar Pro · R$ 30/mês
            </CheckoutButton>
          </div>
          <p className="mt-2 text-[11px] text-ink-3">
            Pagamento via Asaas (Pix, cartão ou boleto).
          </p>
        </article>

        <article className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-prep">
          <header>
            <h2 className="text-xl font-extrabold text-ink">Avulso</h2>
            <p className="mt-1 text-sm text-ink-2">
              Vai pagar só esta entrevista? Compre 1 prep.
            </p>
          </header>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-ink">R$ 10</span>
            <span className="text-sm text-ink-2">/ prep</span>
          </div>
          <p className="mt-1 text-xs text-ink-3">
            Crédito não expira. Use quando quiser.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm text-ink-2">
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>
                <strong>1 prep completo</strong>: todas as 5 etapas
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>Análise ATS, pesquisa da empresa, CV reescrito</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>Sem mensalidade, sem renovação automática</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-green-700">✓</span>
              <span>Pode comprar mais quando precisar</span>
            </li>
          </ul>

          <div className="mt-7">
            <CheckoutButton kind="prep_purchase" variant="ghost">
              Comprar 1 prep · R$ 10
            </CheckoutButton>
          </div>
          <p className="mt-2 text-[11px] text-ink-3">
            Pagamento único. Crédito é creditado após confirmação.
          </p>
        </article>
      </div>

      <p className="mt-8 text-center text-sm text-ink-3">
        Plano Free permite 1 prep a cada 30 dias.{" "}
        <Link href="/dashboard" className="text-orange-700 underline">
          Voltar pro dashboard
        </Link>
      </p>
    </div>
  );
}
