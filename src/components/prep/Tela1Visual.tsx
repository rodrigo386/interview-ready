"use client";

import { useState } from "react";
import { usePrepShell } from "./PrepShellProvider";
import { FocusCard } from "./FocusCard";
import { SkipCard } from "./SkipCard";
import { SuccessCard } from "./SuccessCard";
import { DeletePrepButton } from "./DeletePrepButton";
import { CompanyCard } from "./CompanyCard";
import { JobCard } from "./JobCard";
import { IntelCard } from "./IntelCard";
import type { StepNumber } from "@/lib/prep/types";
import type { CompanyIntel } from "@/lib/ai/schemas";

const FOCUS_BY_STEP: Record<
  StepNumber,
  {
    title: string;
    description: string;
    ctaLabel: string;
    routeSegment: string;
  }
> = {
  1: {
    title: "Vamos começar pela vaga",
    description: "Entenda o que a empresa está buscando",
    ctaLabel: "Ver visão geral →",
    routeSegment: "ats",
  },
  2: {
    title: "Seu CV está pronto pro filtro?",
    description: "Descubra seu score ATS em 30 segundos",
    ctaLabel: "Rodar análise →",
    routeSegment: "ats",
  },
  3: {
    title: "Pronto pra treinar as perguntas básicas?",
    description: "Perguntas selecionadas pra você. Tempo estimado: ~8 minutos.",
    ctaLabel: "Começar agora →",
    routeSegment: "likely",
  },
  4: {
    title: "Hora das perguntas difíceis",
    description: "Perguntas de aprofundamento sobre liderança e execução",
    ctaLabel: "Continuar →",
    routeSegment: "deep-dive",
  },
  5: {
    title: "Última etapa: suas perguntas",
    description: "Perguntas estratégicas pra você fazer ao entrevistador",
    ctaLabel: "Finalizar prep →",
    routeSegment: "ask",
  },
};

const SKIP_BY_STEP: Record<
  StepNumber,
  { prompt: string; ctaLabel: string; routeSegment: string } | null
> = {
  1: { prompt: "Pular pra análise ATS?", ctaLabel: "Pular para passo 2 →", routeSegment: "ats" },
  2: { prompt: "Pular direto pras perguntas?", ctaLabel: "Pular para passo 3 →", routeSegment: "likely" },
  3: { prompt: "Pular pro aprofundamento?", ctaLabel: "Pular para passo 4 →", routeSegment: "deep-dive" },
  4: { prompt: "Pular pra suas perguntas?", ctaLabel: "Pular para passo 5 →", routeSegment: "ask" },
  5: null,
};

export function Tela1Visual({
  sessionId,
  jobDescription,
  companyIntel,
  companyIntelStatus,
}: {
  sessionId: string;
  jobDescription?: string | null;
  companyIntel?: CompanyIntel | null;
  companyIntelStatus?: string | null;
}) {
  const { company, role, estimatedMinutes, currentStep, completedSteps } = usePrepShell();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const allDone = completedSteps.includes(5);

  const focus = FOCUS_BY_STEP[currentStep];
  const skip = SKIP_BY_STEP[currentStep];
  const stepChip = `PASSO ${currentStep} DE 5`;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
          Prep para
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink md:text-[32px]">
          {company}
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          {role} · {estimatedMinutes} min
        </p>
      </header>

      {allDone ? (
        <SuccessCard sessionId={sessionId} />
      ) : (
        <>
          <FocusCard
            stepChip={stepChip}
            title={focus.title}
            description={focus.description}
            ctaLabel={focus.ctaLabel}
            ctaHref={`/prep/${sessionId}/${focus.routeSegment}`}
          />
          {skip && (
            <SkipCard
              prompt={skip.prompt}
              ctaLabel={skip.ctaLabel}
              href={`/prep/${sessionId}/${skip.routeSegment}`}
            />
          )}
        </>
      )}

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
          Inteligência da vaga
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <CompanyCard
            companyName={company}
            intel={companyIntel ?? null}
            status={companyIntelStatus ?? null}
          />
          <JobCard jobTitle={role} jobDescription={jobDescription ?? null} />
          <IntelCard intel={companyIntel ?? null} status={companyIntelStatus ?? null} />
        </div>
      </section>

      <section className="border-t border-line pt-6">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="text-[13px] font-semibold text-ink-3 hover:text-ink-2"
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? "Opções avançadas ▴" : "Opções avançadas ▾"}
        </button>
        {advancedOpen && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
              Não preciso mais deste prep
            </p>
            <DeletePrepButton sessionId={sessionId} companyName={company} />
          </div>
        )}
      </section>
    </div>
  );
}
