export function HeroMockup() {
  return (
    <div
      aria-hidden
      className="relative mx-auto mt-16 w-full max-w-3xl"
    >
      <div className="absolute -inset-x-6 -top-2 -bottom-2 rounded-3xl bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-zinc-900 dark:to-zinc-950" />
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-bg shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)] dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-bg px-5 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
              B
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                Bayer S.A.
              </p>
              <p className="truncate text-xs text-text-tertiary">
                Procurement Manager · Pleno → Sênior
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-soft bg-green-soft px-2.5 py-1 text-xs font-semibold text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            Concluído
          </span>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 px-6 py-5 dark:border-zinc-800">
            <Gauge value={91} />
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
              ATS Score
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              <span className="text-text-tertiary line-through">72</span>{" "}
              <span className="font-semibold text-green-700 dark:text-green-300">→ 91</span>
            </p>
          </div>

          <ul className="flex flex-col gap-2 text-sm">
            {[
              "Por que sair de compras pra estratégia agora?",
              "Como você lidaria com um fornecedor estratégico que falhou?",
              "Conte uma negociação que economizou >R$10M.",
              "Como mede sucesso de um time de procurement?",
              "O que sabe sobre o pipeline de Crop Science da Bayer?",
            ].map((q, i) => (
              <li
                key={q}
                className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-bg px-3 py-2 dark:border-zinc-800"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 dark:bg-brand-900/30">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate text-text-primary">{q}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/60 px-5 py-3 text-xs text-text-tertiary dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <span>5 etapas</span>
            <span aria-hidden>·</span>
            <span>18 min de leitura</span>
          </div>
          <span className="font-medium text-text-secondary">prepavaga.com.br</span>
        </div>
      </div>
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-neutral-200 dark:stroke-zinc-800"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-green-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold text-text-primary">
        {value}
      </span>
    </div>
  );
}
