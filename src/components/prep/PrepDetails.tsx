"use client";

import { useState } from "react";
import type { CompanyIntel } from "@/lib/ai/schemas";

type Section = {
  id: string;
  icon: string;
  title: string;
};

const SECTIONS: Section[] = [
  { id: "jd", icon: "📋", title: "Descrição da vaga" },
  { id: "company", icon: "🏢", title: "Sobre a empresa" },
  { id: "recruiter", icon: "👤", title: "Recrutador" },
  { id: "news", icon: "📰", title: "Últimas notícias" },
  { id: "glassdoor", icon: "⭐", title: "Avaliação Glassdoor" },
  { id: "intel", icon: "💡", title: "Intel adicional" },
];

export function PrepDetails({
  jobDescription,
  companyIntel,
  companyIntelStatus,
}: {
  jobDescription: string | null;
  companyIntel: CompanyIntel | null;
  companyIntelStatus: string | null;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
        Detalhes do prep
      </h2>
      <div className="space-y-2">
        {SECTIONS.map((s) => (
          <DetailCard key={s.id} icon={s.icon} title={s.title}>
            {renderBody(s.id, { jobDescription, companyIntel, companyIntelStatus })}
          </DetailCard>
        ))}
      </div>
    </section>
  );
}

function DetailCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset"
      >
        <span aria-hidden className="text-base leading-none">
          {icon}
        </span>
        <span className="flex-1 text-sm font-semibold text-ink">{title}</span>
        <span aria-hidden className="text-ink-3">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-5 py-4 text-[15px] leading-6 text-ink-2">
          {children}
        </div>
      )}
    </div>
  );
}

function renderBody(
  id: string,
  data: {
    jobDescription: string | null;
    companyIntel: CompanyIntel | null;
    companyIntelStatus: string | null;
  },
): React.ReactNode {
  if (id === "jd") {
    if (!data.jobDescription) {
      return <Empty>Descrição da vaga não disponível.</Empty>;
    }
    return (
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-[14px] leading-6 text-ink-2">
        {data.jobDescription}
      </pre>
    );
  }

  if (id === "company") {
    if (data.companyIntelStatus === "researching") return <Loading />;
    if (data.companyIntelStatus === "failed")
      return <Empty>Pesquisa da empresa falhou. Tente recriar o prep.</Empty>;
    if (!data.companyIntel) return <Empty>Pesquisa não disponível.</Empty>;
    return (
      <div className="space-y-3">
        <p>{data.companyIntel.overview}</p>
        {data.companyIntel.culture_signals.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-3">
              Sinais de cultura
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.companyIntel.culture_signals.map((s) => (
                <span
                  key={s}
                  className="rounded-pill bg-orange-soft px-2.5 py-1 text-xs text-orange-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {data.companyIntel.strategic_context && (
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-3">
              Contexto estratégico
            </p>
            <p>{data.companyIntel.strategic_context}</p>
          </div>
        )}
      </div>
    );
  }

  if (id === "recruiter") {
    return (
      <Empty>
        Não identificamos o recrutador automaticamente. Em geral o nome aparece
        ao final da descrição da vaga ou no perfil LinkedIn da empresa.
      </Empty>
    );
  }

  if (id === "news") {
    if (data.companyIntelStatus === "researching") return <Loading />;
    if (!data.companyIntel || data.companyIntel.recent_developments.length === 0)
      return <Empty>Nenhuma notícia relevante encontrada.</Empty>;
    return (
      <ul className="space-y-3">
        {data.companyIntel.recent_developments.map((d) => (
          <li key={d.headline} className="border-l-2 border-orange-500 pl-3">
            <p className="font-semibold text-ink">{d.headline}</p>
            <p className="mt-1 text-[14px]">{d.why_it_matters}</p>
            {d.source_url && (
              <a
                href={d.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-orange-700 hover:text-orange-500"
              >
                Fonte ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (id === "glassdoor") {
    return (
      <Empty>
        Em breve. Vamos integrar com a API do Glassdoor para mostrar nota,
        prós/contras e perguntas frequentes de entrevistas.
      </Empty>
    );
  }

  if (id === "intel") {
    if (data.companyIntelStatus === "researching") return <Loading />;
    if (!data.companyIntel) return <Empty>Intel não disponível.</Empty>;
    return (
      <div className="space-y-3">
        {data.companyIntel.key_people.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-3">
              Pessoas-chave
            </p>
            <ul className="space-y-2">
              {data.companyIntel.key_people.map((p) => (
                <li key={p.name}>
                  <p className="font-semibold text-ink">
                    {p.name}{" "}
                    <span className="font-normal text-ink-3">— {p.role}</span>
                  </p>
                  <p className="text-[14px]">{p.background_snippet}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.companyIntel.questions_this_creates.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-3">
              Perguntas que isso cria pra você
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {data.companyIntel.questions_this_creates.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] italic text-ink-3">{children}</p>;
}

function Loading() {
  return (
    <p className="text-[14px] italic text-ink-3">
      ⏳ Pesquisando… volte em alguns instantes.
    </p>
  );
}
