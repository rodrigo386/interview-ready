import Link from "next/link";
import type { PrepGuide as PrepGuideType, CompanyIntel } from "@/lib/ai/schemas";
import { PrepCard } from "./PrepCard";
import { CompanyIntelCards } from "./CompanyIntelCards";

const INTEL_TAB_ID = "company-intel";

export function PrepGuide({
  guide,
  sessionId,
  activeSectionId,
  activeCardId,
  companyIntel,
}: {
  guide: PrepGuideType;
  sessionId: string;
  activeSectionId?: string;
  activeCardId?: string;
  companyIntel?: CompanyIntel | null;
}) {
  const showIntelTab = Boolean(companyIntel);

  const sectionContainingCard = activeCardId
    ? guide.sections.find((s) => s.cards.some((c) => c.id === activeCardId))
    : undefined;

  // If intel exists and no section is explicitly selected, intel is the default active tab.
  // If activeSectionId is explicitly the intel id, intel is active.
  // Otherwise, find the matching section (fallback to card's section, then first section).
  const intelIsActive =
    showIntelTab &&
    (activeSectionId === INTEL_TAB_ID || (!activeSectionId && !sectionContainingCard));

  const activeSection = intelIsActive
    ? null
    : guide.sections.find((s) => s.id === activeSectionId) ??
      sectionContainingCard ??
      guide.sections[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <div className="mb-2">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-100"
          >
            ← Back to dashboard
          </Link>
        </div>
        <h1 className="text-3xl font-semibold">
          Prep for <span className="text-brand">{guide.meta.company}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {guide.meta.role} · est. {guide.meta.estimated_prep_time_minutes} min prep
        </p>
      </header>

      <nav className="mb-8 -mx-2 flex gap-2 overflow-x-auto px-2 pb-2">
        {showIntelTab && (
          <Link
            key={INTEL_TAB_ID}
            href={`/prep/${sessionId}?section=${INTEL_TAB_ID}`}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
              intelIsActive
                ? "border-brand bg-brand text-white"
                : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            <span aria-hidden>🏢</span>
            <span>Company Intel</span>
          </Link>
        )}
        {guide.sections.map((section) => {
          const isActive = !intelIsActive && activeSection?.id === section.id;
          return (
            <Link
              key={section.id}
              href={`/prep/${sessionId}?section=${section.id}`}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                isActive
                  ? "border-brand bg-brand text-white"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              <span aria-hidden>{section.icon}</span>
              <span>{section.title}</span>
            </Link>
          );
        })}
      </nav>

      {intelIsActive && companyIntel ? (
        <section>
          <h2 className="text-xl font-semibold">
            <span className="mr-2" aria-hidden>
              🏢
            </span>
            Company Intel
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Research on {guide.meta.company} — weave these into your answers.
          </p>
          <div className="mt-6">
            <CompanyIntelCards intel={companyIntel} />
          </div>
        </section>
      ) : activeSection ? (
        <section>
          <h2 className="text-xl font-semibold">
            <span className="mr-2" aria-hidden>
              {activeSection.icon}
            </span>
            {activeSection.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{activeSection.summary}</p>

          <div className="mt-6 space-y-3">
            {activeSection.cards.map((card) => (
              <PrepCard
                key={card.id}
                card={card}
                defaultOpen={card.id === activeCardId}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
