import { Gauge } from "./Gauge";
import type { AtsAnalysis } from "@/lib/ai/schemas";

function verdict(score: number) {
  if (score <= 40) return { label: "❌ RISCO ALTO DE REJEIÇÃO", cls: "bg-red-soft text-red-500" };
  if (score <= 70) return { label: "⚠️ AJUSTES NECESSÁRIOS", cls: "bg-yellow-soft text-yellow-700" };
  return { label: "✅ PRONTO PRA SUBMETER", cls: "bg-green-soft text-green-700" };
}

const RANGES: Array<{ label: string; range: [number, number]; cls: string }> = [
  { label: "0-40 Rejeita", range: [0, 40], cls: "bg-red-soft text-red-500" },
  { label: "41-70 Você está aqui", range: [41, 70], cls: "bg-yellow-soft text-yellow-700" },
  { label: "71-100 Passa", range: [71, 100], cls: "bg-green-soft text-green-700" },
];

export function AtsHero({ analysis, role }: { analysis: AtsAnalysis; role: string }) {
  const v = verdict(analysis.score);
  return (
    <section className="rounded-lg bg-bg p-6 shadow-prep md:p-8">
      <div className="grid items-center gap-6 md:grid-cols-[240px_1fr] md:gap-8">
        <div className="flex justify-center">
          <Gauge value={analysis.score} />
        </div>
        <div>
          <span className={`inline-flex rounded-pill px-3 py-1 text-xs font-semibold ${v.cls}`}>
            {v.label}
          </span>
          <h3 className="mt-3 text-xl font-bold text-ink">
            {analysis.score >= 71
              ? "Seu CV está bem alinhado pro filtro ATS"
              : `Seu CV provavelmente não passa do filtro ATS pra ${role}`}
          </h3>
          <p className="mt-2 text-[15px] leading-6 text-ink-2">
            {analysis.overall_assessment}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {RANGES.map((r) => {
              const isCurrent = analysis.score >= r.range[0] && analysis.score <= r.range[1];
              return (
                <span
                  key={r.label}
                  className={`rounded-md px-3 py-2 text-center text-[11px] font-semibold ${r.cls} ${isCurrent ? "ring-2 ring-ink" : "opacity-60"}`}
                >
                  {r.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
