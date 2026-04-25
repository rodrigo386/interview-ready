export function CreditsBadge({ credits }: { credits: number }) {
  if (credits <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-green-soft px-2.5 py-1 text-xs font-semibold text-green-700">
      🎟️ {credits} {credits === 1 ? "crédito" : "créditos"}
    </span>
  );
}
