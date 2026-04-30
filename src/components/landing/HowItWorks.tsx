const STEPS = [
  {
    number: "01",
    title: "Você manda CV + link da vaga",
    body: "Upload do PDF, ou cole o texto. Link de Gupy, LinkedIn, Catho: extraímos a descrição completa.",
  },
  {
    number: "02",
    title: "A IA faz o trabalho de pesquisa e estrutura",
    body: "Lemos seu CV, pesquisamos a empresa em tempo real, cruzamos requisitos e geramos roteiros usando sua história.",
  },
  {
    number: "03",
    title: "Dossiê pronto em minutos",
    body: "5 telas no painel ou PDF pra ler offline. Volte quantas vezes quiser por 30 dias.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="border-t border-neutral-200 bg-bg py-20 scroll-mt-20 md:py-24 dark:border-zinc-800"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-brand-600">Como funciona</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
            Como funciona a preparação para entrevista
          </h2>
          <p className="mt-3 text-base leading-[1.6] text-text-secondary">
            Três passos, você no controle.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.number}
              className="rounded-xl border border-neutral-200 bg-bg p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-zinc-800"
            >
              <div className="text-3xl font-semibold text-brand-600">{s.number}</div>
              <h3 className="mt-4 text-lg font-semibold text-text-primary">{s.title}</h3>
              <p className="mt-2 text-sm leading-[1.55] text-text-secondary">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
