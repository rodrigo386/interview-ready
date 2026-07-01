import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";

export const metadata: Metadata = {
  title: "Sobre a PrepaVaga",
  description:
    "PrepaVaga é uma plataforma brasileira de preparação para entrevista com IA. Quem somos, o que entregamos, como nasceu o projeto.",
  alternates: { canonical: "/sobre" },
  openGraph: {
    title: "Sobre · PrepaVaga",
    description:
      "Conheça a PrepaVaga: preparação para entrevista de emprego com IA, feita pra quem fala português.",
    url: "/sobre",
  },
};

const ABOUT_JSONLD = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  url: `${SITE_URL}/sobre`,
  inLanguage: "pt-BR",
  mainEntity: {
    "@type": "Organization",
    name: "PrepaVaga",
    url: SITE_URL,
    description:
      "Plataforma brasileira de preparação para entrevista de emprego com IA.",
    parentOrganization: {
      "@type": "Organization",
      name: "PROAICIRCLE CONSULTORIA EMPRESARIAL LTDA",
      taxID: "62.805.016/0001-29",
    },
  },
};

export default function SobrePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ABOUT_JSONLD) }}
      />
      <LandingNavbar />
      <main className="bg-bg">
        <article className="mx-auto max-w-3xl px-6 py-14">
          <nav aria-label="Breadcrumb" className="text-xs text-text-tertiary">
            <Link href="/" className="hover:text-text-primary hover:underline">
              Início
            </Link>
            <span aria-hidden className="mx-2">›</span>
            <span aria-current="page" className="text-text-primary">Sobre</span>
          </nav>

          <header className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Sobre a PrepaVaga
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
              Preparação pra entrevista que respeita o seu tempo
            </h1>
            <p className="mt-4 text-base leading-[1.6] text-ink-2 md:text-lg">
              A PrepaVaga é uma plataforma brasileira que transforma uma vaga e
              seu currículo em um dossiê pronto pra entrevista — em cerca de 60
              segundos, em português.
            </p>
          </header>

          <section className="prose prose-neutral mt-10 max-w-none prose-headings:tracking-tight prose-headings:text-ink prose-h2:mt-12 prose-h2:text-2xl prose-h2:font-extrabold prose-p:text-ink-2 prose-p:leading-[1.7] prose-strong:text-ink prose-a:text-orange-700 prose-a:underline-offset-4 hover:prose-a:underline">
            <h2>Por que a PrepaVaga existe</h2>
            <p>
              Preparar entrevista é trabalhoso. Você precisa pesquisar a empresa,
              entender a vaga, ajustar o CV pra ATS, antecipar perguntas, ter
              perguntas próprias. Quem faz isso direito leva 4-6 horas por
              processo. Quem não faz, vai improvisar e perder a vaga.
            </p>
            <p>
              A PrepaVaga compacta esse trabalho num fluxo de 60 segundos: você
              cola o link da vaga (ou o texto) e seu CV. A gente devolve cinco
              telas — visão geral da empresa, análise ATS, perguntas prováveis,
              perguntas de aprofundamento e perguntas estratégicas pra você
              fazer ao recrutador.
            </p>

            <h2>Como funciona, em uma frase</h2>
            <p>
              Modelos de linguagem (Google Gemini) cruzam vaga + CV + pesquisa
              em tempo real (notícias dos últimos 6 meses sobre a empresa) e
              geram conteúdo personalizado em PT-BR. Não é template genérico —
              cada prep é construído pra <em>aquela</em> entrevista.
            </p>

            <h2>Quem está por trás</h2>
            <p>
              PrepaVaga é mantida pela <strong>PROAICIRCLE CONSULTORIA
              EMPRESARIAL LTDA</strong> (CNPJ 62.805.016/0001-29), com sede em
              São Paulo, SP. Operação 100% brasileira, com pagamentos em BRL via
              Pix, cartão ou boleto pelo Asaas.
            </p>

            <h2>Modelo de preço</h2>
            <p>
              Toda nova conta ganha 1 prep grátis vitalícia. Quem quer mais
              escolhe entre <strong>Pro a R$ 30/mês</strong> com uso ilimitado
              (promo de lançamento, valor cheio R$ 50) ou{" "}
              <strong>R$ 10 por prep avulso</strong>. Sem fidelidade, cancele
              quando quiser. Detalhes em{" "}
              <Link href="/pricing">/pricing</Link>.
            </p>

            <h2>Privacidade e dados</h2>
            <p>
              Tratamos os dados com base na LGPD. Seu currículo fica no seu
              perfil pra você reusar em próximas entrevistas, e não é
              compartilhado com terceiros. Detalhes em{" "}
              <Link href="/privacidade">Política de Privacidade</Link> e{" "}
              <Link href="/lgpd">/lgpd</Link>.
            </p>

            <h2>Contato</h2>
            <p>
              <strong>Suporte e parcerias:</strong>{" "}
              <a href="mailto:prepavaga@prepavaga.com.br">
                prepavaga@prepavaga.com.br
              </a>
              <br />
              <strong>Artigos sobre entrevista e carreira:</strong>{" "}
              <Link href="/artigos">/artigos</Link>
            </p>
          </section>

          <footer className="mt-14 rounded-xl border border-line bg-white p-6 shadow-prep">
            <h2 className="text-lg font-bold text-ink">
              Pronto pra entrar mais preparado na próxima entrevista?
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              A primeira preparação é grátis. Sem cartão, sem fidelidade.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-block rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Criar conta grátis →
            </Link>
          </footer>
        </article>
      </main>
      <LandingFooter />
    </>
  );
}
