import Link from "next/link";

/**
 * Badge de saldo no header de toda página logada (`AppHeader`).
 *
 * Mostra SÓ o saldo real de créditos. A versão anterior calculava
 * `Math.max(0, 1 - prepsUsedThisMonth) + prepCredits` e anunciava "Free · 1
 * prep" para todo usuário novo — uma preparação grátis que não existe mais
 * (`checkQuota` só olha `prep_credits`) e que `preps_used_this_month`, agora
 * nunca incrementada, garantia que nunca fosse consumida. A promessa aparecia
 * no chrome de `/dashboard`, `/profile/*`, `/prep/new` e das 5 telas de prep.
 *
 * O ramo Pro continua porque existe UM assinante legado em produção; nada
 * cria assinatura nova (`/api/billing/checkout` recusa `pro_subscription`).
 */
export function PlanBadge({
  tier,
  subscriptionStatus,
  prepCredits,
}: {
  tier: "free" | "pro" | "team";
  subscriptionStatus: "active" | "overdue" | "canceled" | "expired" | "none" | null;
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

  // Saldo negativo não deve acontecer, mas o badge não pode anunciá-lo.
  const credits = Math.max(0, prepCredits);
  const noun = credits === 1 ? "crédito" : "créditos";

  return (
    <Link
      href="/pricing"
      aria-label={`${credits} ${noun} de preparação. Ver preços.`}
      className="inline-flex items-center gap-1.5 rounded-pill border border-orange-soft bg-orange-soft px-2.5 py-1 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
      <span>{credits}</span>
      <span className="hidden sm:inline">{noun}</span>
    </Link>
  );
}
