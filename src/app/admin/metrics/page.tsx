import type { Metadata } from "next";
import { LineChart, BarChart } from "@/components/admin/charts";
import { getHistoricalSeries } from "@/lib/admin/timeseries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Métricas · Admin · PrepaVaga",
  robots: { index: false, follow: false },
};

export default async function MetricsAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const days = clamp(Number(params.days ?? "30") || 30, 7, 90);

  const series = await getHistoricalSeries(days);

  const totals = {
    signups: sum(series.signups),
    preps: sum(series.preps),
    failed: sum(series.prepsFailed),
    revenueCents: sum(series.revenueCents),
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Métricas
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Histórico dos últimos {days} dias.
        </p>
        <div className="mt-4 inline-flex gap-1 rounded-full border border-neutral-200 p-1 text-xs dark:border-zinc-800">
          {[7, 30, 90].map((d) => (
            <a
              key={d}
              href={`/admin/metrics?days=${d}`}
              className={
                "rounded-full px-3 py-1 font-medium transition " +
                (days === d
                  ? "bg-brand-600 text-white"
                  : "text-text-secondary hover:text-text-primary")
              }
            >
              {d}d
            </a>
          ))}
        </div>
      </header>

      <Card
        title="Cadastros por dia"
        subtitle={`${totals.signups.toLocaleString("pt-BR")} novos no período`}
      >
        <BarChart data={series.signups} />
      </Card>

      <Card
        title="Preps geradas por dia"
        subtitle={`${totals.preps.toLocaleString("pt-BR")} no período · ${totals.failed.toLocaleString("pt-BR")} falhadas`}
      >
        <LineChart data={series.preps} />
      </Card>

      <Card
        title="Receita por dia"
        subtitle={`R$ ${(totals.revenueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} no período`}
      >
        <BarChart
          data={series.revenueCents}
          color="#2DB87F"
          formatValue={(v) =>
            `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          }
        />
      </Card>

      {totals.failed > 0 && (
        <Card
          title="Preps falhadas por dia"
          subtitle={`${totals.failed.toLocaleString("pt-BR")} falhas — investigar em Saúde`}
        >
          <BarChart data={series.prepsFailed} color="#E54848" />
        </Card>
      )}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-bg p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-zinc-800">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-text-tertiary">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sum(points: { value: number }[]): number {
  return points.reduce((acc, p) => acc + p.value, 0);
}
