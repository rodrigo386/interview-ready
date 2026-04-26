import Link from "next/link";

export function PlanBadge({
  tier,
  subscriptionStatus,
  prepsUsedThisMonth,
  prepCredits,
}: {
  tier: "free" | "pro" | "team";
  subscriptionStatus: "active" | "overdue" | "canceled" | "expired" | "none" | null;
  prepsUsedThisMonth: number;
  prepCredits: number;
}) {
  const isPro =
    tier === "pro" && (subscriptionStatus === "active" || subscriptionStatus === "overdue");

  if (isPro) {
    return (
      <Link
        href="/profile/account"
        aria-label="Plano Pro, gerenciar assinatura"
        className="inline-flex items-center gap-1.5 rounded-pill border border-green-soft bg-green-soft px-2.5 py-1 text-xs font-semibold text-green-700 transition hover:bg-green-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
      >
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
        Pro
      </Link>
    );
  }

  const freeRemaining = Math.max(0, 1 - prepsUsedThisMonth);
  const remaining = freeRemaining + prepCredits;

  return (
    <Link
      href="/pricing"
      aria-label={`Plano Free, ${remaining} prep${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}. Ver planos.`}
      className="inline-flex items-center gap-1.5 rounded-pill border border-orange-soft bg-orange-soft px-2.5 py-1 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
      <span>Free</span>
      <span aria-hidden className="text-orange-700/60 dark:text-orange-300/60">·</span>
      <span>
        {remaining} <span className="hidden sm:inline">prep{remaining === 1 ? "" : "s"}</span>
      </span>
    </Link>
  );
}
