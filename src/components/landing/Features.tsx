import type { ReactNode } from "react";

type FeatureBlock = {
  eyebrow: string;
  title: string;
  body: string;
  quote: string;
  attribution: string;
  visual: ReactNode;
};

const BLOCKS: FeatureBlock[] = [
  {
    eyebrow: "01 · Inteligência sobre a empresa",
    title: "Pesquisa em tempo real, não no que o modelo lembra de 2023.",
    body: "Notícias dos últimos 6 meses, contexto estratégico, perguntas inteligentes pra você levantar — geradas com Google Search grounding em cima da realidade atual da empresa.",
    quote: "Me poupou 3 horas de Glassdoor + Google News.",
    attribution: "Rodrigo, fundador",
    visual: <CompanyIntelMock />,
  },
  {
    eyebrow: "02 · ATS + CV reescrito",
    title: "Score determinístico contra a vaga, e a versão otimizada pronta.",
    body: "Análise rubric-based (mesmo CV + mesma vaga = mesmo score) com detecção de keywords críticas, headings ATS, e issues por severidade. Reescrita opcional gera a próxima versão pronta pra colar.",
    quote: "Score 72 → 91 em uma rodada.",
    attribution: "Caso real do beta",
    visual: <AtsMock />,
  },
  {
    eyebrow: "03 · Roteiros STAR personalizados",
    title: "15 perguntas — prováveis, difíceis, e o que o gestor vai cobrar.",
    body: "Cada pergunta vem com estrutura STAR (Situação → Tarefa → Ação → Resultado) usando casos reais do seu CV. Não é resposta pronta — é o esqueleto pra você adaptar com naturalidade.",
    quote: "É o coach que eu queria ter tido nas minhas próprias transições.",
    attribution: "Rodrigo, fundador",
    visual: <QuestionsMock />,
  },
  {
    eyebrow: "04 · Você pergunta",
    title: "As perguntas que mostram que você fez lição de casa.",
    body: "Calibradas pelo seu nível, pelas notícias da empresa e pelo padrão da vaga. O tipo de pergunta que muda a entrevista de teste para conversa entre pares.",
    quote: "Mostra que pesquisou sem soar decorado.",
    attribution: "Beta tester",
    visual: <AskMock />,
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="border-t border-neutral-200 bg-bg py-20 scroll-mt-20 md:py-24 dark:border-zinc-800"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-brand-600">O que está no dossiê</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
            Quatro entregas. Uma sessão. Pronto pra entrevista.
          </h2>
        </div>

        <div className="mt-16 flex flex-col gap-20 md:gap-24">
          {BLOCKS.map((b, i) => {
            const reverse = i % 2 === 1;
            return (
              <article
                key={b.title}
                className="grid items-center gap-10 md:grid-cols-2 md:gap-14"
              >
                <div className={reverse ? "md:order-2" : ""}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {b.eyebrow}
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
                    {b.title}
                  </h3>
                  <p className="mt-4 text-base leading-[1.6] text-text-secondary">{b.body}</p>
                  <figure className="mt-6 border-l-2 border-brand-600 pl-4">
                    <blockquote className="text-base italic text-text-primary">
                      &ldquo;{b.quote}&rdquo;
                    </blockquote>
                    <figcaption className="mt-2 text-xs text-text-tertiary">
                      — {b.attribution}
                    </figcaption>
                  </figure>
                </div>
                <div className={reverse ? "md:order-1" : ""}>{b.visual}</div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MockShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-bg p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-zinc-800">
      {children}
    </div>
  );
}

function CompanyIntelMock() {
  return (
    <MockShell>
      <div className="flex items-center gap-2.5 border-b border-neutral-200 pb-3 dark:border-zinc-800">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
          B
        </span>
        <p className="text-sm font-semibold text-text-primary">Bayer S.A.</p>
        <span className="ml-auto rounded-full border border-neutral-200 bg-bg px-2 py-0.5 text-[10px] text-text-tertiary dark:border-zinc-800">
          últimos 6 meses
        </span>
      </div>
      <ul className="mt-3 space-y-2.5 text-xs">
        {[
          "Fechou aquisição em Crop Science (mar/2026)",
          "Reestruturação no time de Procurement LATAM",
          "Investimento em digital agriculture: R$200M anunciados",
        ].map((n) => (
          <li key={n} className="flex items-start gap-2">
            <span aria-hidden className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-text-tertiary" />
            <span className="text-text-secondary">{n}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["#sustentabilidade", "#data-driven", "#regulatório"].map((t) => (
          <span
            key={t}
            className="rounded-full border border-neutral-200 bg-bg px-2 py-0.5 text-[10px] text-text-tertiary dark:border-zinc-800"
          >
            {t}
          </span>
        ))}
      </div>
    </MockShell>
  );
}

function AtsMock() {
  return (
    <MockShell>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
            ATS Score
          </p>
          <p className="mt-1 text-3xl font-semibold text-text-primary">91 / 100</p>
        </div>
        <span className="rounded-full bg-green-soft px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300">
          +19 pts
        </span>
      </div>
      <div className="mt-4 space-y-2 text-xs">
        {[
          { tag: "Crítico", body: "Adicionar 'category management' como heading", tone: "red" },
          { tag: "Alto", body: "Quantificar resultado em R$ no projeto Bayer", tone: "yellow" },
          { tag: "Médio", body: "Trocar 'responsável por' por 'liderou'", tone: "neutral" },
        ].map((iss) => (
          <div
            key={iss.body}
            className="flex items-start gap-3 rounded-lg border border-neutral-200 px-3 py-2 dark:border-zinc-800"
          >
            <span
              className={
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                (iss.tone === "red"
                  ? "bg-red-soft text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : iss.tone === "yellow"
                    ? "bg-yellow-soft text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300"
                    : "bg-neutral-100 text-text-secondary dark:bg-zinc-900")
              }
            >
              {iss.tag}
            </span>
            <span className="text-text-secondary">{iss.body}</span>
          </div>
        ))}
      </div>
    </MockShell>
  );
}

function QuestionsMock() {
  return (
    <MockShell>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
          Pergunta 04 / 15
        </p>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={
                "h-1 w-6 rounded-full " +
                (i < 4 ? "bg-brand-600" : "bg-neutral-200 dark:bg-zinc-800")
              }
            />
          ))}
        </div>
      </div>
      <p className="text-sm font-semibold text-text-primary">
        Conte uma negociação com fornecedor estratégico que economizou mais de R$10M.
      </p>
      <div className="mt-4 space-y-2">
        {[
          { label: "S", body: "Contrato global com Cargill expirando, 18% acima do mercado." },
          { label: "T", body: "Renegociar sem trocar fornecedor (lock-in regulatório)." },
          { label: "A", body: "Benchmark com 4 outros, leverage volume 3-anos, MOQ flex." },
          { label: "R", body: "Save de R$14.2M no ano 1, NPS supplier mantido em 8.4." },
        ].map((step) => (
          <div key={step.label} className="flex gap-3 text-xs">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-600 font-bold text-white">
              {step.label}
            </span>
            <span className="pt-1 text-text-secondary">{step.body}</span>
          </div>
        ))}
      </div>
    </MockShell>
  );
}

function AskMock() {
  return (
    <MockShell>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          🎤
        </span>
        <p className="text-sm font-semibold text-text-primary">Você pergunta</p>
      </div>
      <ul className="space-y-2.5 text-xs">
        {[
          "Como o time de Procurement se conecta com a estratégia digital de Crop Science?",
          "Quem foi a última pessoa a sair desse cargo? Por quê?",
          "Quais 3 KPIs eu seria cobrado nos primeiros 90 dias?",
          "Como a reestruturação anunciada afeta esse role no curto prazo?",
        ].map((q, i) => (
          <li key={q} className="flex gap-3 rounded-lg border border-neutral-200 px-3 py-2 dark:border-zinc-800">
            <span className="font-semibold text-brand-600">{String(i + 1).padStart(2, "0")}.</span>
            <span className="text-text-primary">{q}</span>
          </li>
        ))}
      </ul>
    </MockShell>
  );
}
