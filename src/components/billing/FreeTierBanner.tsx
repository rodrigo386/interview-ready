import Link from "next/link";

/**
 * Banner persistente de saldo no dashboard. Modelo pós-2026-08-17: não há
 * cota mensal nem plano Free — a análise ATS é sempre grátis e cada crédito
 * comprado libera 1 preparação completa (sem expirar).
 */
export function FreeTierBanner({ credits }: { credits: number }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-orange-soft px-4 py-3 text-sm">
      <p className="text-ink-2">
        {credits > 0
          ? `🎟️ Você tem ${credits} crédito${credits === 1 ? "" : "s"} de preparação.`
          : "A análise ATS é sempre grátis."}{" "}
        {credits === 0 && (
          <span className="text-ink-3">
            Pra gerar a preparação completa, compre um crédito por R$10.
          </span>
        )}
      </p>
      <Link
        href="/pricing"
        className="rounded-pill bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
      >
        Ver preços
      </Link>
    </div>
  );
}
