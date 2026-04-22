"use client";

import type { CompanyIntel } from "@/lib/ai/schemas";

export function CompanyIntelCards({ intel }: { intel: CompanyIntel }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Overview">{intel.overview}</Panel>
        <Panel title="Strategic context">{intel.strategic_context}</Panel>
      </div>

      {intel.recent_developments.length > 0 && (
        <Section title="Recent developments">
          <div className="space-y-3">
            {intel.recent_developments.map((d, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <h4 className="text-sm font-semibold text-zinc-100">
                  {d.headline}
                </h4>
                <p className="mt-2 text-sm text-zinc-300">{d.why_it_matters}</p>
                {d.source_url && (
                  <a
                    href={d.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-brand hover:underline"
                  >
                    source →
                  </a>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {intel.key_people.length > 0 && (
        <Section title="Key people">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {intel.key_people.map((p, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <h4 className="text-sm font-semibold text-zinc-100">
                  {p.name}
                </h4>
                <p className="mt-1 text-xs text-zinc-400">{p.role}</p>
                <p className="mt-2 text-sm text-zinc-300">
                  {p.background_snippet}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {intel.culture_signals.length > 0 && (
        <Section title="Culture signals">
          <div className="flex flex-wrap gap-2">
            {intel.culture_signals.map((s, i) => (
              <span
                key={i}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-200"
              >
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {intel.questions_this_creates.length > 0 && (
        <Section title="Questions this creates">
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            {intel.questions_this_creates.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-200">{children}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      {children}
    </div>
  );
}
