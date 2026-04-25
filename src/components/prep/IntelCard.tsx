import type { CompanyIntel } from "@/lib/ai/schemas";
import { RerunIntelButton } from "./RerunIntelButton";

export function IntelCard({
  sessionId,
  intel,
  status,
}: {
  sessionId: string;
  intel: CompanyIntel | null;
  status: string | null;
}) {
  const isResearching = status === "researching" || status === "pending";
  const isFailed = status === "failed";
  const isSkipped = status === "skipped" || (!isResearching && !isFailed && !intel);

  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border border-line bg-white p-5 shadow-prep">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
          Sua jogada
        </p>
        <h3 className="mt-0.5 text-lg font-bold text-ink">Pessoas e ângulos</h3>
      </header>

      {isResearching && (
        <p className="text-[14px] italic text-ink-3">
          ⏳ Pesquisando…
        </p>
      )}

      {(isFailed || isSkipped) && (
        <div className="space-y-2">
          <p className="text-[14px] italic text-ink-3">
            {isFailed
              ? "A pesquisa não rodou. Toque em pesquisar pra rodar agora."
              : "Sem intel pra esta empresa ainda."}
          </p>
          <RerunIntelButton sessionId={sessionId} isResearching={false} />
        </div>
      )}

      {intel && (
        <>
          {intel.strategic_context && (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
                Contexto
              </p>
              <p className="text-[14px] leading-6 text-ink-2">
                {intel.strategic_context}
              </p>
            </div>
          )}

          {intel.key_people.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
                Pessoas-chave
              </p>
              <ul className="space-y-2">
                {intel.key_people.slice(0, 3).map((p) => (
                  <li
                    key={p.name}
                    className="rounded-md bg-bg p-2.5"
                  >
                    <p className="text-[14px] font-semibold leading-5 text-ink">
                      {p.name}
                    </p>
                    <p className="text-[12px] text-ink-3">{p.role}</p>
                    <p className="mt-1 text-[13px] leading-5 text-ink-2">
                      {p.background_snippet}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {intel.questions_this_creates.length > 0 && (
            <div className="mt-auto">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
                Perguntas que provam pesquisa
              </p>
              <ul className="space-y-1.5">
                {intel.questions_this_creates.slice(0, 3).map((q) => (
                  <li
                    key={q}
                    className="text-[13px] leading-5 text-ink-2"
                  >
                    <span aria-hidden className="mr-1.5 text-orange-500">
                      ❯
                    </span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </article>
  );
}
