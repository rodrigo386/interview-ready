const CARDS = [
  {
    title: "Inteligência sobre a empresa",
    body: "Notícias recentes, cultura, sinais do Glassdoor, red flags — tudo que dá pra saber antes de entrar na sala.",
  },
  {
    title: "Seu CV vs. a vaga",
    body: "Score ATS, keywords faltando, versão reescrita mirando o vocabulário exato da vaga.",
  },
  {
    title: "15 perguntas com roteiros STAR",
    body: "Perguntas prováveis + perguntas difíceis, com roteiros de resposta usando sua própria história do CV.",
  },
  {
    title: "Perguntas que você deve fazer",
    body: "Calibradas pelo nível do cargo e pela cultura da empresa. Mostre que pesquisou.",
  },
];

export function WhatYouGet() {
  return (
    <section
      id="o-que-voce-recebe"
      className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20"
    >
      <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
        O que você recebe
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-base text-text-secondary">
        Um dossiê de 12–18 páginas, dividido em quatro partes que cobrem
        tudo que um coach de carreira prepararia em uma sessão paga.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {CARDS.map((c) => (
          <div
            key={c.title}
            className="rounded-lg border border-border bg-bg p-6 transition-colors hover:border-brand-400"
          >
            <h3 className="text-lg font-semibold text-text-primary">
              {c.title}
            </h3>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
