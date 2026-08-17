import Link from "next/link";

type FaqItem = { q: string; a: React.ReactNode; aPlain: string };

const ITEMS: FaqItem[] = [
  {
    q: "O PrepaVaga é grátis?",
    aPlain:
      "A análise ATS é sempre gratuita, com ou sem cadastro. A preparação completa (pesquisa da empresa, currículo reescrito e roteiros de pergunta) custa R$10 por vaga, ou em pacote: 3 por R$25 ou 5 por R$40. Sem mensalidade.",
    a: (
      <>
        A <strong>análise ATS é sempre gratuita</strong>, com ou sem cadastro. A preparação
        completa (pesquisa da empresa, currículo reescrito e roteiros de pergunta) custa{" "}
        <strong>R$ 10</strong> por vaga, ou em pacote: 3 por R$ 25 ou 5 por R$ 40. Sem
        mensalidade, e o crédito comprado não expira.
      </>
    ),
  },
  {
    q: "Como funciona a preparação para entrevista com IA?",
    aPlain:
      "Você cola o link da vaga (ou o texto) e seu currículo. Em alguns minutos a IA analisa o ATS do seu CV contra a vaga, pesquisa a empresa em tempo real (notícias dos últimos meses) e gera um roteiro com perguntas prováveis, perguntas de aprofundamento e perguntas estratégicas pra você fazer ao recrutador.",
    a: (
      <>
        Você cola o link da vaga (ou o texto) e seu currículo. Em alguns minutos a IA{" "}
        <strong>analisa o ATS</strong> do seu CV contra a vaga, <strong>pesquisa a empresa</strong>{" "}
        em tempo real (notícias dos últimos meses) e gera um <strong>roteiro</strong> com perguntas
        prováveis, perguntas de aprofundamento e perguntas estratégicas pra você fazer ao
        recrutador.
      </>
    ),
  },
  {
    q: "A análise ATS funciona pra qualquer área?",
    aPlain:
      "Sim. A análise compara seu CV contra a descrição específica da vaga (palavras-chave, requisitos, experiência), independente da área: TI, marketing, finanças, saúde, jurídico, comercial. Funciona pra vagas em PT-BR e em inglês.",
    a: (
      <>
        Sim. A análise compara seu CV contra a descrição específica da vaga (palavras-chave,
        requisitos, experiência), independente da área: TI, marketing, finanças, saúde, jurídico,
        comercial. Funciona pra vagas em PT-BR e em inglês.
      </>
    ),
  },
  {
    q: "Funciona pra entrevista em inglês?",
    aPlain:
      "Sim. Você pode colar a vaga e o CV em inglês. A análise ATS roda igualmente bem. O conteúdo final é gerado em português brasileiro por padrão; se você precisar de tudo em inglês, fala com a gente que ajustamos.",
    a: (
      <>
        Sim. Você pode colar a vaga e o CV em inglês. A análise ATS roda igualmente bem. O
        conteúdo final é gerado em <strong>português brasileiro</strong> por padrão; se você
        precisar de tudo em inglês, fala com a gente que ajustamos.
      </>
    ),
  },
  {
    q: "Quanto tempo leva pra gerar a preparação?",
    aPlain:
      "Cerca de 1 a 3 minutos. A geração roda em segundo plano enquanto você espera. Você pode até fechar a aba e voltar depois pelo dashboard.",
    a: (
      <>
        Cerca de <strong>1 a 3 minutos</strong>. A geração roda em segundo plano enquanto você
        espera. Você pode até fechar a aba e voltar depois pelo dashboard.
      </>
    ),
  },
  {
    q: "Meu currículo e meus dados ficam seguros?",
    aPlain:
      "Sim. Operamos em conformidade com a LGPD (Lei 13.709/2018). Seus dados ficam em servidores no Brasil/EUA, criptografados em trânsito e em repouso, e você pode pedir exportação ou exclusão a qualquer momento pela página de Direitos LGPD.",
    a: (
      <>
        Sim. Operamos em conformidade com a <strong>LGPD</strong> (Lei 13.709/2018). Seus dados
        ficam criptografados em trânsito e em repouso, e você pode pedir exportação ou exclusão a
        qualquer momento pela página de{" "}
        <Link href="/lgpd" className="text-brand-600 underline-offset-4 hover:underline">
          Direitos LGPD
        </Link>
        .
      </>
    ),
  },
  {
    q: "O crédito de preparação expira?",
    aPlain:
      "Não. O crédito que você compra fica na sua conta até você usar, sem mensalidade, sem renovação automática. A garantia de 7 dias permite reembolso total se você não ficar satisfeito.",
    a: (
      <>
        Não. O crédito que você compra fica na sua conta até você usar,{" "}
        <strong>sem mensalidade, sem renovação automática</strong>. A{" "}
        <strong>garantia de 7 dias</strong> permite reembolso total se você não ficar satisfeito.
      </>
    ),
  },
  {
    q: "Análise ATS e preparação completa são a mesma coisa?",
    aPlain:
      "Não. A análise ATS (grátis) mostra sua nota de compatibilidade com a vaga e os principais ajustes de vocabulário. A preparação completa (R$10, ou em pacote) acrescenta pesquisa da empresa, faixa salarial estimada, currículo reescrito e roteiros de pergunta.",
    a: (
      <>
        Não. A <strong>análise ATS</strong> (grátis) mostra sua nota de compatibilidade com a
        vaga e os principais ajustes de vocabulário. A <strong>preparação completa</strong> (R$
        10, ou em pacote) acrescenta pesquisa da empresa, faixa salarial estimada, currículo
        reescrito e roteiros de pergunta. Veja os pacotes na{" "}
        <Link href="/pricing" className="text-brand-600 underline-offset-4 hover:underline">
          página de preços
        </Link>
        .
      </>
    ),
  },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ITEMS.map((it) => ({
    "@type": "Question",
    name: it.q,
    acceptedAnswer: { "@type": "Answer", text: it.aPlain },
  })),
};

export function Faq() {
  return (
    <section
      id="faq"
      className="border-t border-neutral-200 bg-bg py-20 scroll-mt-20 md:py-24 dark:border-zinc-800"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-brand-600">Perguntas frequentes</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
            Tudo que você precisa saber antes de começar
          </h2>
          <p className="mt-3 text-base leading-[1.6] text-text-secondary">
            Não achou sua resposta?{" "}
            <a
              href="mailto:prepavaga@prepavaga.com.br"
              className="text-brand-600 underline-offset-4 hover:underline"
            >
              prepavaga@prepavaga.com.br
            </a>
            .
          </p>
        </div>

        <div className="mt-10 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-bg dark:divide-zinc-800 dark:border-zinc-800">
          {ITEMS.map((it, i) => (
            <details key={i} className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 text-left transition hover:bg-neutral-50 dark:hover:bg-zinc-900/40">
                <h3 className="text-base font-semibold text-text-primary">{it.q}</h3>
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 text-xl leading-none text-text-tertiary transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 pt-0 text-base leading-[1.65] text-text-secondary">
                {it.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
