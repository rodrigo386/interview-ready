import { DeletePrepButton } from "./DeletePrepButton";
import { JourneyArc } from "./JourneyArc";
import { ContinueCard } from "./ContinueCard";
import type { JourneyNode } from "./navigation-types";

export function PrepOverview({
  sessionId,
  company,
  role,
  estimatedMinutes,
  nodes,
  nextStep,
}: {
  sessionId: string;
  company: string;
  role: string;
  estimatedMinutes: number;
  nodes: JourneyNode[];
  nextStep: {
    title: string;
    body: string;
    href: string;
    ctaLabel: string;
  } | null;
}) {
  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
          Prep para
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          <span className="text-brand-600">{company}</span>
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {role} · tempo estimado: {estimatedMinutes} min
        </p>
      </header>

      <JourneyArc nodes={nodes} activeId="overview" />

      {nextStep && (
        <ContinueCard
          title={nextStep.title}
          body={nextStep.body}
          href={nextStep.href}
          ctaLabel={nextStep.ctaLabel}
        />
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
          Zona de perigo
        </h2>
        <div className="mt-3">
          <DeletePrepButton sessionId={sessionId} companyName={company} />
        </div>
      </section>
    </div>
  );
}
