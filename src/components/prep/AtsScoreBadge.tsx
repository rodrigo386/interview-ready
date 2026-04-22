export function AtsScoreBadge({ score }: { score: number }) {
  const style =
    score >= 70
      ? "bg-emerald-950/40 text-emerald-300 border-emerald-900"
      : score >= 40
        ? "bg-amber-950/40 text-amber-300 border-amber-900"
        : "bg-red-950/40 text-red-300 border-red-900";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${style}`}>
      ATS {score}%
    </span>
  );
}
