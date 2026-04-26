const QUESTIONS = [
  "Como você lideraria um time de 8 pessoas em SLA crítico?",
  "Conte uma decisão difícil que tomou com dados incompletos.",
  "Por que sair da sua área atual agora?",
  "Como mediria sucesso nos primeiros 90 dias?",
  "O que sabe sobre nossa expansão para LATAM?",
];

export function HeroMockup() {
  return (
    <div aria-hidden className="relative mx-auto mt-14 w-full max-w-3xl">
      <div className="absolute -inset-x-6 -top-3 -bottom-3 rounded-3xl bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-zinc-900 dark:to-zinc-950" />

      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-bg shadow-[0_30px_80px_-20px_rgba(0,0,0,0.18)] dark:border-zinc-800">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50/60 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-zinc-700" />
          <span className="ml-3 truncate text-xs text-text-tertiary">
            prepavaga.com.br/prep/exemplo
          </span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1.05fr_1fr]">
          <div className="border-b border-neutral-200 p-5 md:border-b-0 md:border-r dark:border-zinc-800">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              O que você manda
            </p>

            <div className="mt-3 rounded-lg border border-neutral-200 bg-bg p-3 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 text-[10px] font-bold text-text-secondary dark:bg-zinc-800 dark:text-zinc-300">
                  PDF
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-text-primary">
                    seu-curriculo.pdf
                  </p>
                  <p className="text-[10px] text-text-tertiary">2 páginas · 184 KB</p>
                </div>
                <span className="text-[10px] text-text-tertiary">✓</span>
              </div>
            </div>

            <div className="mt-2.5 rounded-lg border border-neutral-200 bg-bg p-3 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="text-text-tertiary">🔗</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-text-primary">
                    techcorp.com/careers/123
                  </p>
                  <p className="text-[10px] text-text-tertiary">
                    Gerente de Operações Sênior · Pleno → Sênior
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 text-[10px] text-text-tertiary">
              <span className="text-brand-600 motion-safe:animate-[pulseDot_1.6s_ease-in-out_infinite]">●</span>
              <span>Lendo CV · Pesquisando empresa · Cruzando requisitos…</span>
            </div>

            <div className="mt-5 grid gap-2">
              {[
                { label: "CV lido", delay: "0s" },
                { label: "Notícias dos últimos 6 meses", delay: "1.2s" },
                { label: "ATS · 91 / 100", delay: "2.4s" },
                { label: "15 perguntas com roteiros", delay: "3.6s" },
                { label: "Você pergunta · 8 ideias", delay: "4.8s" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-2 motion-safe:opacity-0 motion-safe:animate-[stepIn_6s_ease-out_infinite]"
                  style={{ animationDelay: s.delay }}
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[8px] font-bold text-white">
                    ✓
                  </span>
                  <span className="text-[11px] text-text-secondary">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                O que você recebe
              </p>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-500">
                Pronto em 18 min
              </span>
            </div>

            <div className="mt-3 rounded-lg border border-neutral-200 bg-bg p-3 dark:border-zinc-800">
              <p className="text-xs font-semibold text-text-primary">
                TechCorp · Gerente de Operações Sênior
              </p>
              <p className="mt-0.5 text-[10px] text-text-tertiary">
                Dossiê de preparação · 5 etapas · 18 min de leitura
              </p>

              <div className="mt-3 flex items-center gap-3">
                <Gauge value={91} />
                <div className="text-[11px]">
                  <p className="font-semibold text-text-primary">ATS Score</p>
                  <p className="text-text-tertiary">
                    Seu CV vs. essa vaga ·{" "}
                    <span className="line-through">72</span>{" "}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">→ 91</span>
                  </p>
                </div>
              </div>
            </div>

            <ul className="mt-3 space-y-1.5">
              {QUESTIONS.map((q, i) => (
                <li
                  key={q}
                  className="relative flex items-start gap-2.5 overflow-hidden rounded-md border border-neutral-200 bg-bg px-2.5 py-2 dark:border-zinc-800"
                >
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[9px] font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-text-primary">{q}</span>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 -left-full w-full motion-safe:animate-[sweep_8s_ease-in-out_infinite]"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(234,88,12,0.16) 50%, transparent 100%)",
                      animationDelay: `${i * 0.6}s`,
                    }}
                  />
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between rounded-md border border-neutral-200 bg-bg px-3 py-2 text-[10px] text-text-tertiary dark:border-zinc-800">
              <span>Visão geral · ATS · Prováveis · Aprofundamento · Você pergunta</span>
              <span className="text-emerald-600 dark:text-emerald-400">● online</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes stepIn {
          0% { opacity: 0; transform: translateY(4px); }
          8%, 80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0.4; transform: translateY(0); }
        }
        @keyframes sweep {
          0% { left: -100%; }
          50%, 100% { left: 100%; }
        }
        @keyframes gaugeFill {
          0% { stroke-dashoffset: 201.06; }
          25%, 100% { stroke-dashoffset: 18.1; }
        }
      `}</style>
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-16 w-16 shrink-0">
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
          strokeDashoffset={circumference - (value / 100) * circumference}
          className="stroke-emerald-500 motion-safe:animate-[gaugeFill_4s_ease-out_infinite]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-semibold text-text-primary">
        {value}
      </span>
    </div>
  );
}
