import type { SalaryBenchmark } from "@/lib/ai/schemas";
import { RerunSalaryButton } from "./RerunSalaryButton";

const SENIORITY_LABEL: Record<SalaryBenchmark["seniority"], string> = {
  estagio: "Estágio",
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
  lideranca: "Liderança",
  nao_identificado: "Nível indefinido",
};

const CONFIDENCE: Record<
  SalaryBenchmark["confidence"],
  { label: string; cls: string }
> = {
  high: {
    label: "Alta confiança",
    cls: "bg-green-soft text-green-700",
  },
  medium: {
    label: "Confiança média",
    cls: "bg-yellow-soft text-yellow-700",
  },
  low: {
    label: "Baixa confiança",
    cls: "bg-line text-ink-3",
  },
};

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function SalaryCard({
  sessionId,
  benchmark,
  status,
}: {
  sessionId: string;
  benchmark: SalaryBenchmark | null;
  status: string | null;
}) {
  const isResearching = status === "researching" || status === "pending";
  const isFailed = status === "failed";
  const isSkipped =
    status === "skipped" || (!isResearching && !isFailed && !benchmark);

  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border border-line bg-white p-5 shadow-prep">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
            Mercado
          </p>
          <h3 className="mt-0.5 text-lg font-bold text-ink">Faixa salarial</h3>
        </div>
        {benchmark && (
          <span
            className={`shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-semibold ${CONFIDENCE[benchmark.confidence].cls}`}
          >
            {CONFIDENCE[benchmark.confidence].label}
          </span>
        )}
      </header>

      {isResearching && (
        <p className="text-[14px] italic text-ink-3">⏳ Pesquisando…</p>
      )}

      {(isFailed || isSkipped) && (
        <div className="space-y-2">
          <p className="text-[14px] italic text-ink-3">
            Toque em pesquisar pra estimar a faixa pra essa vaga.
          </p>
          <RerunSalaryButton sessionId={sessionId} isResearching={false} />
        </div>
      )}

      {benchmark && (
        <>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
              Mediana estimada
            </p>
            <p className="mt-1 text-2xl font-extrabold text-ink">
              {formatBRL(benchmark.median_brl)}
              <span className="text-sm font-medium text-ink-3">/mês</span>
            </p>
            <p className="mt-0.5 text-[13px] text-ink-2">
              Faixa{" "}
              <span className="font-semibold">{formatBRL(benchmark.min_brl)}</span>
              {" – "}
              <span className="font-semibold">{formatBRL(benchmark.max_brl)}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip>{SENIORITY_LABEL[benchmark.seniority]}</Chip>
            <Chip>{benchmark.region_hint}</Chip>
            {benchmark.employment_type_hint && (
              <Chip>{benchmark.employment_type_hint}</Chip>
            )}
          </div>

          <p className="text-[13px] leading-5 text-ink-2">{benchmark.notes}</p>

          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <p className="text-[11px] leading-4 text-ink-3">
              Estimativa via dados públicos · pode variar por benefícios.
            </p>
            <RerunSalaryButton
              sessionId={sessionId}
              isResearching={false}
              variant="ghost"
            />
          </div>
        </>
      )}
    </article>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-pill bg-bg px-2 py-0.5 text-[11px] font-medium text-ink-2">
      {children}
    </span>
  );
}
