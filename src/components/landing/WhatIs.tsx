export function WhatIs() {
  return (
    <section
      id="o-que-e"
      aria-labelledby="o-que-e-titulo"
      className="border-t border-neutral-200 bg-bg py-16 scroll-mt-20 md:py-20 dark:border-zinc-800"
    >
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-sm font-semibold text-brand-600">O que é</p>
        <h2
          id="o-que-e-titulo"
          className="mt-2 text-2xl font-semibold tracking-tight text-text-primary md:text-3xl"
        >
          PrepaVaga é uma plataforma de preparação para entrevista de emprego com IA.
        </h2>
        <p className="mt-4 text-base leading-[1.65] text-text-secondary md:text-lg">
          Você cola o link da vaga e seu currículo. Em 1 a 3 minutos, a PrepaVaga entrega
          um dossiê personalizado: <strong className="text-text-primary">análise ATS</strong> do CV
          contra a vaga, <strong className="text-text-primary">pesquisa da empresa</strong> com
          notícias dos últimos 6 meses, <strong className="text-text-primary">currículo reescrito</strong>{" "}
          pra ATS, e <strong className="text-text-primary">15 perguntas</strong> com estrutura STAR
          (prováveis, de aprofundamento e estratégicas pra fazer ao recrutador).
        </p>
        <p className="mt-4 text-sm leading-[1.65] text-text-tertiary">
          Funciona em qualquer área (TI, marketing, finanças, saúde, jurídico, comercial) e em
          vagas em PT-BR ou inglês. Conteúdo gerado em português brasileiro. Em conformidade com a
          LGPD. A primeira preparação é grátis — sem cartão.
        </p>
      </div>
    </section>
  );
}
