import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { createClient } from "@/lib/supabase/server";
import { PRO_MONTHLY_SOFT_CAP } from "@/lib/billing/quota";

export const metadata: Metadata = {
  title: "Planos · PrepaVAGA",
  description: `Free 1 prep grátis · Pro R$30/mês com uso ilimitado (fair use ~${PRO_MONTHLY_SOFT_CAP}/mês) · Per-use R$10. Cancele quando quiser.`,
};

export default async function PricingPage() {
  let isAuthed = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    isAuthed = !!data.user;
  } catch {
    isAuthed = false;
  }

  return (
    <>
      <LandingNavbar />
      <main className="bg-bg">
        <div className="mx-auto max-w-4xl px-6 py-14">
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
                <p className="mt-1 text-sm text-ink-2">
                  Uso ilimitado para sua preparação — sem limite por hora ou por dia.
                </p>
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
                    <strong>Uso ilimitado</strong>: quantas vagas você quiser, sem cobrança extra
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
                {isAuthed ? (
                  <CheckoutButton kind="pro_subscription">
                    Assinar Pro · R$ 30/mês
                  </CheckoutButton>
                ) : (
                  <Link
                    href="/signup?plan=pro"
                    className="inline-block rounded-pill bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                  >
                    Começar grátis e assinar Pro →
                  </Link>
                )}
              </div>
              <p className="mt-2 text-[11px] text-ink-3">
                Pagamento via Asaas (Pix, cartão ou boleto).
              </p>
              <p className="mt-3 rounded-md border border-line bg-bg px-3 py-2 text-[11px] leading-relaxed text-ink-3">
                <strong className="text-ink-2">Fair use</strong>: o plano cobre uso intensivo
                (~{PRO_MONTHLY_SOFT_CAP} preps/mês). Quem precisa de mais é caso raro — basta
                falar com a gente em{" "}
                <a
                  href="mailto:rodrigo@proaicircle.com?subject=PrepaVAGA%20%E2%80%94%20liberar%20uso%20al%C3%A9m%20do%20fair%20use"
                  className="font-medium text-orange-700 underline"
                >
                  rodrigo@proaicircle.com
                </a>{" "}
                que liberamos.
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
                {isAuthed ? (
                  <CheckoutButton kind="prep_purchase" variant="ghost">
                    Comprar 1 prep · R$ 10
                  </CheckoutButton>
                ) : (
                  <Link
                    href="/signup?plan=prep"
                    className="inline-block rounded-pill border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-bg"
                  >
                    Criar conta para comprar →
                  </Link>
                )}
              </div>
              <p className="mt-2 text-[11px] text-ink-3">
                Pagamento único. Crédito é creditado após confirmação.
              </p>
            </article>
          </div>

          <p className="mt-8 text-center text-sm text-ink-3">
            Plano Free permite 1 prep grátis vitalícia.{" "}
            {isAuthed ? (
              <Link href="/dashboard" className="text-orange-700 underline">
                Voltar pro dashboard
              </Link>
            ) : (
              <Link href="/signup" className="text-orange-700 underline">
                Criar conta grátis →
              </Link>
            )}
          </p>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
