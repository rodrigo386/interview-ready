"use client";

import { useState, useTransition } from "react";
import { markAllPayablePaid } from "@/app/admin/affiliates/actions";

export function PayoutButton({
  partnerId,
  payableCents,
}: {
  partnerId: string;
  payableCents: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (payableCents <= 0) {
    return <span className="text-xs text-ink-3">—</span>;
  }

  const handleClick = () => {
    const paidVia = prompt(
      `Confirmar pagamento de R$ ${(payableCents / 100).toFixed(2)} para este parceiro?\n\nDescreva como pagou (ex: "Pix - chave: ana@example.com - 2026-05-07"):`,
    );
    if (!paidVia || !paidVia.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await markAllPayablePaid(partnerId, paidVia.trim());
      if (!res.ok) setError(res.error ?? "Erro");
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-pill bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {pending ? "Marcando..." : "Marcar pago"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
