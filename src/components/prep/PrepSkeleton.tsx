import { SECTION_KINDS } from "@/lib/ai/prompts/section-generator";

const STEPS = [
  { label: "CV lido e analisado", done: true },
  { label: "Vaga processada", done: true },
  { label: "Pesquisando a empresa na web", done: false },
  { label: "Analisando encaixe com seu perfil", done: false },
  { label: "Gerando roteiros STAR", done: false },
  { label: "Montando PDF final", done: false },
];

export function PrepSkeleton() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 animate-pulse rounded-full bg-brand-600" />
          <p className="text-base font-semibold text-text-primary">
            Gerando seu dossiê
          </p>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Estamos preparando seu dossiê. Isso leva entre 15 e 25 minutos.
        </p>

        <ul className="mt-6 space-y-2.5">
          {STEPS.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-3 text-sm"
            >
              <span
                aria-hidden
                className={
                  s.done
                    ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white"
                    : "inline-flex h-5 w-5 animate-pulse items-center justify-center rounded-full border border-border text-xs text-text-tertiary"
                }
              >
                {s.done ? "✓" : "⏳"}
              </span>
              <span className={s.done ? "text-text-primary" : "text-text-secondary"}>
                {s.label}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs text-text-muted">
          Você pode fechar esta aba. Te avisamos por e-mail quando estiver pronto.
        </p>
      </div>

      <div className="mt-10 -mx-2 flex gap-2 overflow-x-auto px-2 pb-2">
        {Array.from({ length: SECTION_KINDS.length + 1 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-32 shrink-0 animate-pulse rounded-full border border-border bg-surface"
          />
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {SECTION_KINDS.map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}
