import Link from "next/link";
import type { PrepGuide as PrepGuideType } from "@/lib/ai/schemas";
import { PrepCard } from "./PrepCard";

export function PrepGuide({
  guide,
  sessionId,
  activeSectionId,
}: {
  guide: PrepGuideType;
  sessionId: string;
  activeSectionId?: string;
}) {
  const active =
    guide.sections.find((s) => s.id === activeSectionId) ?? guide.sections[0];

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
        {guide.sections.map((section) => {
          const isActive = section.id === active.id;
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

      <section>
        <h2 className="text-xl font-semibold">
          <span className="mr-2" aria-hidden>
            {active.icon}
          </span>
          {active.title}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">{active.summary}</p>

        <div className="mt-6 space-y-3">
          {active.cards.map((card) => (
            <PrepCard key={card.id} card={card} />
          ))}
        </div>
      </section>
    </main>
  );
}
