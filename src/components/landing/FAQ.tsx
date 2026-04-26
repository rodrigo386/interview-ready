const ITEMS = [
  {
    q: "É melhor que ChatGPT?",
    a: "ChatGPT improvisa em cima do que você pede. PrepaVAGA pesquisa a empresa em tempo real, lê seu CV em PDF, cruza com a vaga real e devolve um dossiê estruturado em 20 minutos. Você não mantém prompts, não esquece de colar o CV, não revisa manualmente.",
  },
  {
    q: "Substitui Gupy, Sólides ou outros simuladores?",
    a: "Aquelas ferramentas são do lado da empresa — testes pra ranquear candidato. PrepaVAGA é do seu lado: prepara você pra qualquer entrevista, em qualquer plataforma. Funciona inclusive contra entrevista da própria Gupy.",
  },
  {
    q: "Em quanto tempo fica pronto?",
    a: "Entre 15 e 25 minutos depois que você submete CV + link da vaga. Notificamos no painel quando termina. PDF e dossiê ficam disponíveis por 30 dias.",
  },
  {
    q: "E se eu não gostar?",
    a: "A primeira prep é grátis (1 a cada 30 dias). Pra preps adicionais pagas (R$10) ou Pro (R$30/mês), garantia de 7 dias — feedback de 10 minutos por voz e devolução integral.",
  },
  {
    q: "Posso preparar várias vagas?",
    a: "Pode. No Free, 1 prep a cada 30 dias. No Pro (R$30/mês), preps ilimitados. Avulso, R$10 por prep extra. Cada prep fica disponível por 30 dias no painel.",
  },
  {
    q: "Funciona pra vaga em inglês?",
    a: "Sim. Briefing e roteiros saem em PT-BR (a língua que você pensa) com prática mental em inglês onde a vaga exige. Sem traduzir respostas aos trancos no meio da entrevista.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Seu CV e a descrição da vaga são processados pra gerar o dossiê e ficam criptografados na sua conta. Você deleta a qualquer momento. Não compartilhamos com terceiros nem treinamos modelo com seus dados. Conforme LGPD.",
  },
  {
    q: "Tem app mobile?",
    a: "Por enquanto, web responsiva — o painel funciona bem no celular. App nativo está no roadmap pra 2026.",
  },
];

export function FAQ() {
  return (
    <section
      id="faq"
      className="border-t border-neutral-200 bg-bg py-20 scroll-mt-20 md:py-24 dark:border-zinc-800"
    >
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-brand-600">FAQ</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
            Perguntas honestas, respostas diretas.
          </h2>
        </div>

        <div className="mt-12 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-zinc-800 dark:border-zinc-800">
          {ITEMS.map((item, i) => (
            <details key={i} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-text-primary">
                {item.q}
                <span
                  aria-hidden
                  className="text-2xl font-light text-brand-600 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-[1.6] text-text-secondary">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
