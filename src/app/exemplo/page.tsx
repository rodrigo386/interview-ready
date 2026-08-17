import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "Veja um exemplo de preparação pronta",
  description:
    "Um exemplo real do que a PrepaVaga entrega: análise ATS com score, pesquisa da empresa, faixa salarial e perguntas prováveis com roteiro de resposta. Antes de criar sua conta, veja o que você recebe.",
  alternates: { canonical: "/exemplo" },
};

/**
 * Public, static "see it before you sign up" page. Shows a condensed but
 * faithful sample of a generated prep so visitors can judge the product
 * before the signup leap. Company/candidate are fictitious (labeled as such)
 * — never expose a real user's prep here.
 */
export default function ExemploPage() {
  return (
    <>
      <LandingNavbar />
      <main className="bg-bg">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-6">
          {/* Header */}
          <header className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Exemplo de preparação
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
              Isso é o que você recebe em minutos
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-[1.6] text-ink-2">
              Abaixo, uma versão condensada de uma preparação gerada pela
              plataforma. A sua é feita pra <strong>vaga real</strong> que você
              colar e pro <strong>seu CV</strong>.
            </p>
            <p className="mt-3 text-xs text-ink-3">
              Vaga e empresa deste exemplo são ilustrativas.
            </p>
          </header>

          {/* Context card */}
          <section className="mt-10 rounded-2xl border border-line bg-white p-6 shadow-prep">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
              A vaga do exemplo
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink">
              Analista de Marketing Pleno
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Maré — e-commerce de moda · São Paulo (híbrido)
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-orange-soft/40 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
                  Pesquisa da empresa
                </p>
                <p className="mt-1.5 text-sm leading-[1.6] text-ink-2">
                  Cresceu 3× no último ano e acabou de abrir operação de
                  marketplace. O desafio público do time de growth: CAC
                  subindo com a concorrência de mídia paga — a vaga
                  provavelmente existe pra diversificar canais.
                </p>
              </div>
              <div className="rounded-xl bg-green-soft/50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-green-700">
                  Faixa salarial estimada
                </p>
                <p className="mt-1.5 text-2xl font-extrabold text-ink">
                  R$ 4.800 – 6.900
                </p>
                <p className="text-sm text-ink-2">
                  mediana R$ 5.700 · pleno · região de SP
                </p>
              </div>
            </div>
          </section>

          {/* ATS section */}
          <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-prep">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
                  Etapa 2 · Análise ATS
                </p>
                <h2 className="mt-1 text-xl font-bold text-ink">
                  Seu currículo vs. esta vaga
                </h2>
              </div>
              <div className="flex items-baseline gap-1 rounded-xl bg-yellow-soft px-4 py-2">
                <span className="text-3xl font-extrabold text-yellow-700">68</span>
                <span className="text-sm font-semibold text-yellow-700">/100</span>
              </div>
            </div>

            <ul className="mt-5 space-y-3">
              <li className="rounded-xl border border-red-soft bg-red-soft/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                  Crítico
                </p>
                <p className="mt-1 text-sm leading-[1.6] text-ink-2">
                  A vaga pede <strong>Google Analytics 4</strong> e{" "}
                  <strong>CRM</strong> — nenhum dos dois aparece no CV, embora
                  a experiência descrita sugira que você usou ambos.
                </p>
              </li>
              <li className="rounded-xl border border-yellow-soft bg-yellow-soft/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-yellow-700">
                  Alto
                </p>
                <p className="mt-1 text-sm leading-[1.6] text-ink-2">
                  Experiências sem números. &ldquo;Gerenciei campanhas de mídia
                  paga&rdquo; → &ldquo;Gerenciei R$ 40 mil/mês em Meta e Google
                  Ads, reduzindo o CAC em 18%&rdquo;.
                </p>
              </li>
              <li className="rounded-xl border border-line bg-bg p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-3">
                  Médio
                </p>
                <p className="mt-1 text-sm leading-[1.6] text-ink-2">
                  Título do CV genérico (&ldquo;Profissional de
                  Marketing&rdquo;) — o ATS busca o cargo da vaga. Troque por
                  &ldquo;Analista de Marketing Pleno&rdquo;.
                </p>
              </li>
            </ul>
            <p className="mt-4 text-xs text-ink-3">
              Na plataforma, você ainda recebe o CV reescrito com essas
              correções, pronto pra baixar em DOCX.
            </p>
          </section>

          {/* Questions section */}
          <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-prep">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
              Etapas 3–5 · Perguntas com roteiro
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink">
              3 das ~15 perguntas da preparação completa
            </h2>

            <div className="mt-5 space-y-4">
              <article className="rounded-xl border-l-4 border-orange-500 bg-bg p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                  Provável · básica
                </p>
                <h3 className="mt-1 text-base font-bold text-ink">
                  &ldquo;Por que você quer trabalhar na Maré?&rdquo;
                </h3>
                <p className="mt-2 text-sm leading-[1.7] text-ink-2">
                  <strong>Roteiro:</strong> conecte a expansão pro marketplace
                  (da pesquisa acima) com sua experiência: &ldquo;Vi que vocês
                  abriram marketplace este ano — já operei aquisição num
                  momento parecido e sei o que muda no funil quando o
                  sortimento explode. É exatamente o problema que quero
                  resolver.&rdquo;
                </p>
              </article>

              <article className="rounded-xl border-l-4 border-yellow-500 bg-bg p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-yellow-700">
                  Aprofundamento
                </p>
                <h3 className="mt-1 text-base font-bold text-ink">
                  &ldquo;Conte uma campanha que não deu certo. O que você
                  faria diferente?&rdquo;
                </h3>
                <p className="mt-2 text-sm leading-[1.7] text-ink-2">
                  <strong>Roteiro:</strong> estrutura em 3 passos — contexto e
                  hipótese, o que os dados mostraram, a mudança que você
                  aplicou depois. O erro fatal aqui é culpar orçamento ou
                  terceiros; a banca quer ver dono do problema.
                </p>
              </article>

              <article className="rounded-xl border-l-4 border-green-500 bg-bg p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                  Você pergunta
                </p>
                <h3 className="mt-1 text-base font-bold text-ink">
                  &ldquo;Como o time mede sucesso dessa posição nos primeiros
                  90 dias?&rdquo;
                </h3>
                <p className="mt-2 text-sm leading-[1.7] text-ink-2">
                  <strong>Por que funciona:</strong> mostra que você pensa em
                  resultado antes mesmo de entrar — e a resposta te diz se a
                  expectativa da empresa é realista.
                </p>
              </article>
            </div>
          </section>

          {/* CTA */}
          <section className="mt-10 rounded-2xl border-2 border-orange-500 bg-orange-soft/40 p-6 text-center shadow-prep sm:p-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">
              Agora imagine isso pra vaga que você quer
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-[1.6] text-ink-2">
              Cole o link da vaga + seu CV e comece pela análise ATS —{" "}
              <strong>grátis, sem cartão</strong>. A preparação completa (5
              etapas, ~15 perguntas com roteiro e CV reescrito) custa R$10.
            </p>
            <div className="mt-5 flex justify-center">
              <Link
                href="/signup"
                data-analytics-cta="exemplo_primary"
                data-analytics-location="exemplo"
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(234,88,12,0.45)] transition hover:bg-brand-700"
              >
                Analisar meu currículo grátis
                <span aria-hidden>→</span>
              </Link>
            </div>
          </section>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
