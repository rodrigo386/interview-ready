export function EarningsCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border ${
        accent ? "border-orange-500 bg-orange-soft/30" : "border-line bg-white"
      } p-5 shadow-prep`}
    >
      <p className="text-xs uppercase tracking-wide text-ink-3">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          accent ? "text-orange-700" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
