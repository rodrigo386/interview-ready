const ITEMS = [
  {
    q: "Qual a diferença para o simulador grátis da Gupy?",
    a: "A Gupy vende o ATS para o RH e não vai te preparar contra o filtro automático dela mesma. Nós somos 100% do lado do candidato, pesquisamos a empresa, revisamos o CV e entregamos dossiê com roteiros usando sua história.",
  },
  {
    q: "Qual a diferença para o ChatGPT?",
    a: "ChatGPT não lê a vaga real no link, não pesquisa a empresa em tempo real, não gera PDF formatado. Você pode fazer parte do que o PrepaVaga faz no ChatGPT, se passar 2–3 horas montando prompts. Os R$ 49 compram as 2 horas.",
  },
  {
    q: "Em quanto tempo fica pronto?",
    a: "Entre 15 e 25 minutos após o pagamento. PDF chega por e-mail e fica no seu painel por 30 dias.",
  },
  {
    q: "E se eu não gostar?",
    a: "Garantia de 7 dias. Se o dossiê não te ajudar, pedimos feedback por voz de 10 minutos e devolvemos o valor integral.",
  },
  {
    q: "Posso usar para várias vagas?",
    a: "R$ 49 é uma vaga (30 dias de acesso). Para múltiplas vagas em paralelo, o plano Busca Ativa (R$ 149/mês) faz conta melhor a partir de 4 vagas.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Seu CV e vaga são processados para gerar o dossiê e depois mantidos criptografados. Você pode deletar a qualquer momento. Não compartilhamos com terceiros nem treinamos modelo com seus dados. LGPD compliance.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 py-20">
      <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
        Perguntas frequentes
      </h2>
      <div className="mt-12 space-y-3">
        {ITEMS.map((item, i) => (
          <details
            key={i}
            className="group rounded-lg border border-border bg-bg px-5 py-4 open:border-brand-400"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-medium text-text-primary">
              {item.q}
              <span
                aria-hidden
                className="text-xl text-brand-600 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
