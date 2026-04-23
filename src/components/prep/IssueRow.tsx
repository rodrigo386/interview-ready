export function IssueRow({
  severity,
  number,
  title,
  description,
  impact,
}: {
  severity: "critical" | "warning";
  number: number;
  title: string;
  description: string;
  impact: string;
}) {
  const numberBg = severity === "critical" ? "bg-red-soft text-red-500" : "bg-yellow-soft text-yellow-700";
  const label = `${severity === "critical" ? "Ajuste crítico" : "Ajuste de atenção"}: ${title}. Impacto estimado: ${impact}`;
  return (
    <li
      role="listitem"
      aria-label={label}
      className="grid grid-cols-[40px_1fr_auto] items-start gap-4 rounded-md border border-line bg-white p-4 md:items-center"
    >
      <span
        data-testid="issue-number"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-pill text-sm font-bold ${numberBg}`}
      >
        {number}
      </span>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-[13px] text-ink-2">{description}</p>
      </div>
      <span className="rounded-pill bg-green-soft px-3 py-1 text-xs font-semibold text-green-700">
        {impact}
      </span>
    </li>
  );
}
