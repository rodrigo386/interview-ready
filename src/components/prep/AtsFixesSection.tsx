import { IssueRow } from "./IssueRow";
import type { AtsFix } from "@/lib/ai/schemas";

export function AtsFixesSection({ fixes }: { fixes: AtsFix[] }) {
  const top3 = fixes.slice(0, 3);

  if (top3.length === 0) {
    return (
      <section className="rounded-lg border-l-4 border-green-500 bg-green-soft px-5 py-4 shadow-prep">
        <h3 className="text-sm font-bold text-green-700">Nenhum ajuste necessário</h3>
        <p className="mt-1 text-[15px] leading-6 text-ink">
          Seu CV já usa os termos-chave que essa vaga pede. Não encontramos lacunas
          de vocabulário pra corrigir — foque a preparação nas próximas etapas.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-prep">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">
          {top3.length} ajustes em ordem de impacto
        </h3>
      </header>
      <ul className="space-y-2">
        {top3.map((fix, i) => (
          <IssueRow
            key={fix.priority}
            severity={i === 0 ? "critical" : "warning"}
            number={fix.priority}
            title={fix.gap}
            description={fix.jd_language}
            impact={`+${10 + (top3.length - i) * 4} pts`}
          />
        ))}
      </ul>
    </section>
  );
}
