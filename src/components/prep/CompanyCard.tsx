import type { CompanyIntel } from "@/lib/ai/schemas";

const PALETTE = [
  { bg: "bg-orange-soft", text: "text-orange-700" },
  { bg: "bg-green-soft", text: "text-green-700" },
  { bg: "bg-yellow-soft", text: "text-yellow-700" },
];

function initial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

function paletteFor(name: string) {
  const code = name.charCodeAt(0) || 0;
  return PALETTE[code % PALETTE.length];
}

export function CompanyCard({
  companyName,
  intel,
  status,
}: {
  companyName: string;
  intel: CompanyIntel | null;
  status: string | null;
}) {
  const palette = paletteFor(companyName);
  const isResearching = status === "researching" || status === "pending";
  const isFailed = status === "failed";

  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border border-line bg-white p-5 shadow-prep">
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${palette.bg} ${palette.text}`}
        >
          {initial(companyName)}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
            Empresa
          </p>
          <h3 className="truncate text-lg font-bold text-ink">{companyName}</h3>
        </div>
      </header>

      {isResearching && (
        <p className="text-[14px] italic text-ink-3">
          ⏳ Pesquisando empresa…
        </p>
      )}

      {isFailed && (
        <p className="text-[14px] italic text-ink-3">
          Pesquisa falhou. Tente recriar o prep.
        </p>
      )}

      {!isResearching && !isFailed && !intel && (
        <p className="text-[14px] italic text-ink-3">
          Pesquisa não disponível para esta empresa.
        </p>
      )}

      {intel && (
        <>
          <p className="text-[15px] leading-6 text-ink-2">{intel.overview}</p>

          {intel.culture_signals.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
                Vibe
              </p>
              <div className="flex flex-wrap gap-1.5">
                {intel.culture_signals.map((s) => (
                  <span
                    key={s}
                    className="rounded-pill bg-orange-soft px-2.5 py-1 text-xs font-medium text-orange-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {intel.recent_developments.length > 0 && (
            <div className="mt-auto">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
                Notícias recentes
              </p>
              <ul className="space-y-2.5">
                {intel.recent_developments.slice(0, 2).map((d) => (
                  <li
                    key={d.headline}
                    className="border-l-2 border-orange-500 pl-3"
                  >
                    <p className="text-[14px] font-semibold leading-5 text-ink">
                      {d.headline}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-5 text-ink-2">
                      {d.why_it_matters}
                    </p>
                    {d.source_url && (
                      <a
                        href={d.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-[11px] font-medium text-orange-700 hover:text-orange-500"
                      >
                        Fonte ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {intel.recent_developments.length > 2 && (
                <p className="mt-2 text-[11px] text-ink-3">
                  + {intel.recent_developments.length - 2} mais nas seções
                  detalhadas
                </p>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}
