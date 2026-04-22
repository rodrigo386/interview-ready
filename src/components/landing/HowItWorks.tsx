const STEPS = [
  {
    number: "01",
    title: "Você manda CV + link da vaga",
    body: "Upload do PDF e cole o link. Gupy, LinkedIn, Catho, Infojobs — qualquer lugar.",
  },
  {
    number: "02",
    title: "Nossa IA faz o trabalho de um coach",
    body: "Lemos seu CV linha por linha, pesquisamos a empresa, cruzamos com os requisitos da vaga e geramos os roteiros com sua história.",
  },
  {
    number: "03",
    title: "Você recebe seu dossiê em 20 minutos",
    body: "PDF pronto para ler no celular ou imprimir. Volte ao painel quantas vezes quiser por 30 dias.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="bg-surface py-20 scroll-mt-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Como funciona
        </h2>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.number}>
              <div className="text-5xl font-bold text-brand-600">{s.number}</div>
              <h3 className="mt-4 text-xl font-semibold text-text-primary">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
