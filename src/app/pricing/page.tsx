import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { createClient } from "@/lib/supabase/server";
import { PREP_SKUS, brlLabel } from "@/lib/billing/prices";

export const metadata: Metadata = {
  title: { absolute: "Planos e preços — preparação para entrevista com IA · PrepaVaga" },
  description:
    "Análise ATS grátis, na hora. Preparação completa a partir de R$10, sem mensalidade.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Planos e preços · PrepaVaga",
    description:
      "Análise ATS grátis, na hora. Preparação completa a partir de R$10, sem mensalidade.",
    url: "/pricing",
  },
};

const SITE = "https://prepavaga.com.br";

// Service (BRL) para elegibilidade a rich snippet de preço no SERP.
// De propósito SEM Product/aggregateRating/review — exigiria nota falsa,
// já que não temos reviews reais ainda. Ver CLAUDE.md §6 "SEO JSON-LD".
const PRICING_SERVICE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Preparação para entrevista de emprego com IA",
  provider: { "@type": "Organization", name: "PrepaVaga", url: SITE },
  description:
    "Análise ATS + pesquisa da empresa + roteiro de perguntas com IA. Análise ATS é gratuita; a preparação completa é paga por crédito avulso.",
  offers: {
    "@type": "Offer",
    price: "10",
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
    url: `${SITE}/pricing`,
  },
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PRICING_SERVICE_JSONLD) }}
      />
      <LandingNavbar />
      <main className="bg-bg">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <header className="mb-10 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Planos PrepaVaga
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
              Escolha como entrar mais preparado nas entrevistas
            </h1>
            <p className="mt-3 text-sm text-ink-2">
              Sem assinatura. Pague só pela preparação que for usar.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <article className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-prep">
              <header>
                <h2 className="text-xl font-extrabold text-ink">Análise ATS</h2>
                <p className="mt-1 text-sm text-ink-2">
                  Veja como seu CV se sai contra a vaga antes de pagar qualquer coisa.
                </p>
              </header>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-green-700">Grátis</span>
              </div>
              <p className="mt-1 text-xs text-ink-3">
                Sem cartão. Sem cadastro obrigatório pra ver a nota.
              </p>

              <ul className="mt-6 space-y-2.5 text-sm text-ink-2">
                <li className="flex gap-2">
                  <span aria-hidden className="text-green-700">✓</span>
                  <span>Nota ATS do seu CV contra a descrição da vaga</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className="text-green-700">✓</span>
                  <span>Principais pontos de atenção identificados</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className="text-green-700">✓</span>
                  <span>Leva menos de 1 minuto</span>
                </li>
              </ul>

              <div className="mt-7">
                <Link
                  href="/analise-ats-gratis"
                  className="inline-block rounded-pill bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Analisar meu CV grátis →
                </Link>
              </div>
            </article>

            <article className="relative flex flex-col rounded-2xl border-2 border-orange-500 bg-white p-6 shadow-prep">
              <span className="absolute -top-3 left-6 rounded-pill bg-orange-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-prep">
                Preparação completa
              </span>
              <header>
                <h2 className="text-xl font-extrabold text-ink">Preparação por crédito</h2>
                <p className="mt-1 text-sm text-ink-2">
                  Cada crédito libera 1 preparação completa: as 5 etapas, do zero ao dia da
                  entrevista.
                </p>
              </header>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-orange-700">
                  {brlLabel(PREP_SKUS[0].cents)}
                </span>
                <span className="text-sm text-ink-2">/ prep avulso</span>
              </div>
              <p className="mt-1 text-xs text-ink-3">
                Ou compre em pacote e economize por prep. Créditos não expiram.
              </p>

              <ul className="mt-6 space-y-2.5 text-sm text-ink-2">
                <li className="flex gap-2">
                  <span aria-hidden className="text-green-700">✓</span>
                  <span>
                    <strong>1 prep completo por crédito</strong>: todas as 5 etapas
                  </span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className="text-green-700">✓</span>
                  <span>Pesquisa da empresa com notícias recentes</span>
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
                  <span>Sem mensalidade, sem renovação automática</span>
                </li>
              </ul>

              <div className="mt-7 flex flex-col gap-2">
                {isAuthed ? (
                  PREP_SKUS.map((sku) => (
                    <CheckoutButton
                      key={sku.qty}
                      qty={sku.qty}
                      variant={sku.qty === 1 ? "primary" : "ghost"}
                    >
                      {sku.qty === 1
                        ? `Comprar 1 prep · ${brlLabel(sku.cents)}`
                        : `${sku.qty} preps por ${brlLabel(sku.cents)}`}
                    </CheckoutButton>
                  ))
                ) : (
                  <Link
                    href="/signup?plan=prep"
                    className="inline-block rounded-pill bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                  >
                    Criar conta para comprar →
                  </Link>
                )}
              </div>
              <p className="mt-2 text-[11px] text-ink-3">
                Pagamento via Asaas (Pix, cartão ou boleto). Crédito é creditado após
                confirmação.
              </p>
            </article>
          </div>

          <p className="mt-8 text-center text-sm text-ink-3">
            A análise ATS é sempre gratuita.{" "}
            {isAuthed ? (
              <Link href="/dashboard" className="text-orange-700 underline">
                Voltar pro dashboard
              </Link>
            ) : (
              <Link href="/analise-ats-gratis" className="text-orange-700 underline">
                Testar agora →
              </Link>
            )}
          </p>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
