import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  prepGuideSchema,
  atsAnalysisSchema,
  companyIntelSchema,
  cvRewriteSchema,
} from "@/lib/ai/schemas";
import {
  CompanyIntelSection,
  INTEL_SECTION_ID,
  PrepSection,
} from "@/components/prep/PrepGuide";
import { PrepFailed } from "@/components/prep/PrepFailed";
import { PrepSkeleton } from "@/components/prep/PrepSkeleton";
import { AtsCtaCard } from "@/components/prep/AtsCtaCard";
import { AtsScoreCard } from "@/components/prep/AtsScoreCard";
import { AtsFailed } from "@/components/prep/AtsFailed";
import { AtsSkeleton } from "@/components/prep/AtsSkeleton";
import { PrepOverview } from "@/components/prep/PrepOverview";
import {
  PrepSidebar,
  type SidebarItem,
  type SidebarItemStatus,
} from "@/components/prep/PrepSidebar";

const OVERVIEW_ID = "overview";
const ATS_ID = "ats";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("prep_sessions")
    .select("generation_status")
    .eq("id", id)
    .single();

  const isGenerating =
    data?.generation_status === "generating" ||
    data?.generation_status === "pending";

  return {
    title: "Prep — PrepaVaga",
    other: isGenerating ? { "http-equiv": "refresh", content: "3" } : {},
  };
}

type SessionRow = {
  id: string;
  generation_status: string | null;
  prep_guide: unknown;
  error_message: string | null;
  ats_status: string | null;
  ats_analysis: unknown;
  ats_error_message: string | null;
  company_intel: unknown;
  company_intel_status: string | null;
  cv_rewrite: unknown;
  cv_rewrite_status: string | null;
  cv_rewrite_error: string | null;
};

export default async function PrepViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string; card?: string }>;
}) {
  const { id } = await params;
  const { section: sectionParam, card } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, generation_status, prep_guide, error_message, ats_status, ats_analysis, ats_error_message, company_intel, company_intel_status, cv_rewrite, cv_rewrite_status, cv_rewrite_error",
    )
    .eq("id", id)
    .single<SessionRow>();

  if (error || !session) {
    notFound();
  }

  if (
    session.generation_status === "generating" ||
    session.generation_status === "pending"
  ) {
    return <PrepSkeleton />;
  }

  if (session.generation_status === "failed") {
    return <PrepFailed id={session.id} errorMessage={session.error_message} />;
  }

  const parsedGuide = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsedGuide.success) {
    console.error("[prep/view] stored guide failed schema:", parsedGuide.error);
    return <PrepFailed id={session.id} errorMessage="Stored guide is malformed." />;
  }
  const guide = parsedGuide.data;

  const intelParsed =
    session.company_intel_status === "complete"
      ? companyIntelSchema.safeParse(session.company_intel)
      : null;
  const intel = intelParsed?.success ? intelParsed.data : null;
  const intelStatus = toSidebarStatus(
    session.company_intel_status,
    intel !== null,
  );
  const intelAvailable =
    intelStatus === "ready" ||
    intelStatus === "generating" ||
    intelStatus === "failed";

  const atsStatus = toAtsSidebarStatus(session.ats_status);
  const atsScore =
    session.ats_status === "complete"
      ? safeAtsScore(session.ats_analysis)
      : null;
  const rewriteStatus = toSidebarStatus(session.cv_rewrite_status, false);

  const sectionContainingCard = card
    ? guide.sections.find((s) => s.cards.some((c) => c.id === card))
    : undefined;

  const activeId = resolveActiveId({
    sectionParam,
    sectionContainingCard,
    sectionIds: guide.sections.map((s) => s.id),
  });

  const items: SidebarItem[] = buildSidebarItems({
    sessionId: session.id,
    guide,
    intelAvailable,
    intelStatus,
    atsStatus,
  });

  const activeIdResolved = items.some((i) => i.id === activeId)
    ? activeId
    : OVERVIEW_ID;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <header className="mb-6 md:mb-8">
        <Link
          href="/dashboard"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          ← Voltar para seus preps
        </Link>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px,1fr] md:gap-10">
        <aside>
          <PrepSidebar items={items} activeId={activeIdResolved} />
        </aside>

        <main>
          {renderActiveSection({
            activeId: activeIdResolved,
            session,
            guide,
            intel,
            intelStatus,
            atsStatus,
            atsScore,
            rewriteStatus,
            activeCardId: card,
          })}
        </main>
      </div>
    </div>
  );
}

function toSidebarStatus(
  raw: string | null | undefined,
  hasData: boolean,
): SidebarItemStatus {
  if (raw === "generating" || raw === "researching" || raw === "pending") {
    return "generating";
  }
  if (raw === "failed") return "failed";
  if (raw === "complete" && hasData) return "ready";
  if (raw === "complete") return "pending";
  return "pending";
}

function toAtsSidebarStatus(raw: string | null | undefined): SidebarItemStatus {
  if (raw === "generating") return "generating";
  if (raw === "failed") return "failed";
  if (raw === "complete") return "ready";
  return "pending";
}

function safeAtsScore(raw: unknown): number | null {
  const parsed = atsAnalysisSchema.safeParse(raw);
  return parsed.success ? parsed.data.score : null;
}

function resolveActiveId({
  sectionParam,
  sectionContainingCard,
  sectionIds,
}: {
  sectionParam?: string;
  sectionContainingCard?: { id: string };
  sectionIds: string[];
}): string {
  if (sectionParam) {
    if (sectionParam === OVERVIEW_ID) return OVERVIEW_ID;
    if (sectionParam === ATS_ID) return ATS_ID;
    if (sectionParam === INTEL_SECTION_ID) return INTEL_SECTION_ID;
    if (sectionIds.includes(sectionParam)) return sectionParam;
  }
  if (sectionContainingCard) return sectionContainingCard.id;
  return OVERVIEW_ID;
}

function buildSidebarItems({
  sessionId,
  guide,
  intelAvailable,
  intelStatus,
  atsStatus,
}: {
  sessionId: string;
  guide: { sections: Array<{ id: string; icon: string; title: string }> };
  intelAvailable: boolean;
  intelStatus: SidebarItemStatus;
  atsStatus: SidebarItemStatus;
}): SidebarItem[] {
  const items: SidebarItem[] = [
    {
      id: OVERVIEW_ID,
      icon: "🏠",
      label: "Visão geral",
      status: "ready",
      href: `/prep/${sessionId}?section=${OVERVIEW_ID}`,
    },
  ];

  if (intelAvailable) {
    items.push({
      id: INTEL_SECTION_ID,
      icon: "🏢",
      label: "Sobre a empresa",
      status: intelStatus,
      href: `/prep/${sessionId}?section=${INTEL_SECTION_ID}`,
    });
  }

  items.push({
    id: ATS_ID,
    icon: "📊",
    label: "Compatibilidade ATS",
    status: atsStatus,
    href: `/prep/${sessionId}?section=${ATS_ID}`,
  });

  for (const section of guide.sections) {
    items.push({
      id: section.id,
      icon: section.icon,
      label: section.title,
      status: "ready",
      href: `/prep/${sessionId}?section=${section.id}`,
    });
  }

  return items;
}

function renderActiveSection({
  activeId,
  session,
  guide,
  intel,
  intelStatus,
  atsStatus,
  atsScore,
  rewriteStatus,
  activeCardId,
}: {
  activeId: string;
  session: SessionRow;
  guide: { meta: { company: string; role: string; estimated_prep_time_minutes: number }; sections: Array<{ id: string; icon: string; title: string; summary: string; cards: Array<{ id: string }> }> };
  intel: ReturnType<typeof companyIntelSchema.parse> | null;
  intelStatus: SidebarItemStatus;
  atsStatus: SidebarItemStatus;
  atsScore: number | null;
  rewriteStatus: SidebarItemStatus;
  activeCardId?: string;
}) {
  if (activeId === OVERVIEW_ID) {
    return (
      <PrepOverview
        sessionId={session.id}
        company={guide.meta.company}
        role={guide.meta.role}
        estimatedMinutes={guide.meta.estimated_prep_time_minutes}
        sectionsReady={guide.sections.length}
        sectionsTotal={guide.sections.length}
        intelStatus={
          intelStatus === "pending" && !intel ? "unavailable" : intelStatus
        }
        atsStatus={atsStatus}
        atsScore={atsScore}
        rewriteStatus={rewriteStatus}
        firstSectionId={guide.sections[0]?.id ?? null}
      />
    );
  }

  if (activeId === ATS_ID) {
    return renderAtsBlock(session);
  }

  if (activeId === INTEL_SECTION_ID && intel) {
    return (
      <CompanyIntelSection companyName={guide.meta.company} intel={intel} />
    );
  }

  const aiSection = guide.sections.find((s) => s.id === activeId);
  if (aiSection) {
    // activeCardId is validated against the section's cards inside PrepSection.
    // Type assertion is safe: the section shape matches PrepGuideType["sections"][number].
    return (
      <PrepSection
        section={aiSection as never}
        activeCardId={activeCardId}
      />
    );
  }

  return null;
}

function renderAtsBlock(session: SessionRow) {
  if (session.ats_status === "generating") return <AtsSkeleton />;
  if (session.ats_status === "failed") {
    return (
      <AtsFailed sessionId={session.id} errorMessage={session.ats_error_message} />
    );
  }
  if (session.ats_status === "complete") {
    const parsed = atsAnalysisSchema.safeParse(session.ats_analysis);
    if (!parsed.success) {
      return (
        <AtsFailed
          sessionId={session.id}
          errorMessage="Stored analysis is malformed."
        />
      );
    }
    const rewriteParsed =
      session.cv_rewrite_status === "complete"
        ? cvRewriteSchema.safeParse(session.cv_rewrite)
        : null;
    const validRewrite = rewriteParsed?.success ? rewriteParsed.data : null;
    return (
      <AtsScoreCard
        analysis={parsed.data}
        sessionId={session.id}
        cvRewrite={validRewrite}
        cvRewriteStatus={session.cv_rewrite_status}
        cvRewriteError={session.cv_rewrite_error}
      />
    );
  }
  return <AtsCtaCard sessionId={session.id} />;
}
