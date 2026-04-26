import Link from "next/link";

export function FreeTierBanner({
  prepsUsedThisMonth,
  credits,
}: {
  prepsUsedThisMonth: number;
  prepsResetAt?: string;
  credits: number;
}) {
  const freeRemaining = Math.max(0, 1 - prepsUsedThisMonth);
  const remaining = freeRemaining + credits;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-orange-soft px-4 py-3 text-sm">
      <p className="text-ink-2">
        ⚡ Plano <strong>Free</strong>:{" "}
        {remaining > 0
          ? `${remaining} prep${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}.`
          : "Você já usou sua prep grátis."}{" "}
        {prepsUsedThisMonth >= 1 && credits === 0 && (
          <span className="text-ink-3">Assine Pro ou compre uma prep avulsa pra continuar.</span>
        )}
      </p>
      <Link
        href="/pricing"
        className="rounded-pill bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
      >
        Ver planos
      </Link>
    </div>
  );
}
