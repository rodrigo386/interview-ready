import { CheckoutButton } from "./CheckoutButton";

export function FreeTierBanner({
  prepsUsedThisMonth,
  prepsResetAt,
  credits,
}: {
  prepsUsedThisMonth: number;
  prepsResetAt: string;
  credits: number;
}) {
  const resetMs = new Date(prepsResetAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(0, Math.ceil((resetMs - Date.now()) / (24 * 60 * 60 * 1000)));
  const remaining = Math.max(0, 1 - prepsUsedThisMonth) + credits;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-orange-soft px-4 py-3 text-sm">
      <p className="text-ink-2">
        ⚡ Plano <strong>Free</strong> —{" "}
        {remaining > 0
          ? `${remaining} prep${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}.`
          : "Limite atingido."}{" "}
        {prepsUsedThisMonth >= 1 && credits === 0 && daysLeft > 0 && (
          <span className="text-ink-3">Próximo grátis em {daysLeft} {daysLeft === 1 ? "dia" : "dias"}.</span>
        )}
      </p>
      <CheckoutButton kind="pro_subscription">Assinar Pro</CheckoutButton>
    </div>
  );
}
