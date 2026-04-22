const ROWS: Array<{
  label: string;
  free: string;
  chatgpt: string;
  prepavaga: string;
}> = [
  {
    label: "Simula entrevista",
    free: "Sim",
    chatgpt: "Sim (prompt)",
    prepavaga: "Sim",
  },
  {
    label: "Pesquisa empresa em tempo real",
    free: "Não",
    chatgpt: "Parcial",
    prepavaga: "Sim (web + Glassdoor)",
  },
  {
    label: "CV reescrito para a vaga",
    free: "Não",
    chatgpt: "Se pedir",
    prepavaga: "Automático",
  },
  {
    label: "Dossiê PDF entregue",
    free: "Não",
    chatgpt: "Não",
    prepavaga: "Sim (12–18 páginas)",
  },
  {
    label: "Lado do candidato",
    free: "Vende pra RH",
    chatgpt: "Neutro",
    prepavaga: "100%",
  },
  {
    label: "Funciona em qualquer vaga",
    free: "Só do ATS deles",
    chatgpt: "Sim",
    prepavaga: "Sim",
  },
  {
    label: "Preço",
    free: "Grátis",
    chatgpt: "R$ 100/mês",
    prepavaga: "R$ 49/vaga",
  },
];

export function Comparison() {
  return (
    <section id="precos" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
      <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
        Já existe simulador grátis.
        <br className="sm:hidden" />
        <span className="sm:ml-2">Por que pagar?</span>
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-base text-text-secondary">
        Aqui está o que o PrepaVaga entrega que as alternativas não entregam.
      </p>

      <div className="mt-12 overflow-x-auto rounded-lg border border-border">
        <table
          role="table"
          className="w-full border-collapse text-left text-sm"
        >
          <thead>
            <tr className="border-b border-border bg-surface text-text-secondary">
              <th
                scope="col"
                className="px-4 py-4 font-medium md:px-6"
              >
                <span className="sr-only">Critério</span>
              </th>
              <th
                scope="col"
                className="px-4 py-4 font-medium md:px-6"
              >
                Simulador grátis
                <span className="block text-xs font-normal text-text-tertiary">
                  Gupy, Sólides
                </span>
              </th>
              <th
                scope="col"
                className="px-4 py-4 font-medium md:px-6"
              >
                ChatGPT
              </th>
              <th
                scope="col"
                className="relative px-4 py-4 font-semibold text-brand-700 md:px-6 dark:text-brand-400"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-brand-600" />
                PrepaVaga
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr
                key={r.label}
                className={
                  i % 2 === 0
                    ? "border-b border-border"
                    : "border-b border-border bg-surface/50"
                }
              >
                <th
                  scope="row"
                  className="px-4 py-3 text-left font-medium text-text-primary md:px-6"
                >
                  {r.label}
                </th>
                <td className="px-4 py-3 text-text-secondary md:px-6">
                  {r.free}
                </td>
                <td className="px-4 py-3 text-text-secondary md:px-6">
                  {r.chatgpt}
                </td>
                <td className="bg-brand-50 px-4 py-3 font-medium text-text-primary md:px-6 dark:bg-brand-900/20">
                  {r.prepavaga}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
