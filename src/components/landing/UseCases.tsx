type UseCase = {
  title: string;
  body: string;
};

const ITEMS: UseCase[] = [
  {
    title: "Próxima entrevista marcada",
    body: "Você tem dias, não semanas. Caia pronto na sala — empresa lida, CV revisado, perguntas roteirizadas.",
  },
  {
    title: "Mudança de área",
    body: "De compras pra produto, de finanças pra dados. Aprenda a falar a língua nova com a sua história de carreira.",
  },
  {
    title: "Promoção interna",
    body: "De pleno pra sênior, de sênior pra gestão. Os roteiros mostram liderança em respostas, não em adjetivos.",
  },
  {
    title: "Volta ao mercado",
    body: "Depois de uma pausa — maternidade, sabbatical, transição — recupere a fluência de entrevista em uma sessão.",
  },
  {
    title: "Primeiro emprego de impacto",
    body: "Sem 10 anos de experiência? Os roteiros tiram valor da sua história real, não inventam tempo de mercado.",
  },
  {
    title: "Vaga internacional / em inglês",
    body: "Briefing em PT-BR, prática mental em inglês. Sem traduzir respostas aos trancos no meio da entrevista.",
  },
];

export function UseCases() {
  return (
    <section
      id="para-quem"
      className="border-t border-neutral-200 bg-bg py-20 scroll-mt-20 md:py-24 dark:border-zinc-800"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-brand-600">Para quem</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
            Pra cada momento de carreira que precisa de uma resposta afiada.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((it) => (
            <article
              key={it.title}
              className="rounded-xl border border-neutral-200 bg-bg p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-zinc-800"
            >
              <h3 className="text-base font-semibold text-text-primary">{it.title}</h3>
              <p className="mt-2 text-sm leading-[1.55] text-text-secondary">{it.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
