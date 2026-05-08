"use client";

import { useState, useTransition } from "react";
import {
  markAllPayablePaid,
  payPartnerViaPix,
} from "@/app/admin/affiliates/actions";
import { safeCall } from "@/lib/affiliate/safe-action";

const MIN_PAYOUT_CENTS = 10000;

export function PayoutButton({
  partnerId,
  payableCents,
}: {
  partnerId: string;
  payableCents: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "manual">("idle");
  const [paidVia, setPaidVia] = useState("");

  if (payableCents <= 0) {
    return <span className="text-xs text-ink-3">—</span>;
  }

  const belowMinimum = payableCents < MIN_PAYOUT_CENTS;

  const handleAutoPix = () => {
    if (belowMinimum) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const wrapped = await safeCall(() => payPartnerViaPix(partnerId));
      if (!wrapped.ok) {
        setError(wrapped.message);
        return;
      }
      const res = wrapped.value;
      if (!res.ok) {
        setError(res.error);
      } else {
        setSuccess(res.message);
      }
    });
  };

  const handleManual = () => {
    if (!paidVia.trim()) {
      setError("Descreva como pagou");
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const wrapped = await safeCall(() =>
        markAllPayablePaid(partnerId, paidVia.trim()),
      );
      if (!wrapped.ok) {
        setError(wrapped.message);
        return;
      }
      const res = wrapped.value;
      if (!res.ok) {
        setError(res.error ?? "Erro");
      } else {
        setMode("idle");
        setPaidVia("");
        setSuccess(`Marcado como pago manualmente (${res.updated ?? 0} comissões)`);
      }
    });
  };

  if (success) {
    return (
      <p className="max-w-[260px] rounded-md bg-green-soft px-2 py-1 text-xs text-green-700">
        ✓ {success}
      </p>
    );
  }

  if (mode === "manual") {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-orange-500 bg-orange-soft/30 p-3">
        <p className="text-xs font-semibold text-ink">
          Marcar pagamento manual de R$ {(payableCents / 100).toFixed(2)}
        </p>
        <input
          type="text"
          value={paidVia}
          onChange={(e) => setPaidVia(e.target.value)}
          placeholder='Ex: "Pix banco - chave: ana@x.com - 2026-05-08"'
          autoFocus
          className="rounded border border-line bg-white px-2 py-1 text-xs text-ink"
        />
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleManual}
            disabled={pending}
            className="rounded-pill bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {pending ? "Marcando..." : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("idle");
              setError(null);
              setPaidVia("");
            }}
            disabled={pending}
            className="rounded-pill border border-line px-3 py-1 text-xs font-semibold text-ink-2 hover:bg-bg disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleAutoPix}
        disabled={pending || belowMinimum}
        title={
          belowMinimum
            ? `Mínimo R$ 100,00 — faltam R$ ${((MIN_PAYOUT_CENTS - payableCents) / 100).toFixed(2)}`
            : "Dispara Pix via Asaas e marca commissions como pagas"
        }
        className="rounded-pill bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Pagando..." : "Pagar via Pix"}
      </button>
      <button
        type="button"
        onClick={() => setMode("manual")}
        disabled={pending}
        className="text-[10px] font-medium text-ink-3 underline hover:text-ink-2"
      >
        Marcar pago manualmente
      </button>
      {belowMinimum && (
        <p className="max-w-[180px] text-right text-[10px] text-ink-3">
          Abaixo do mínimo R$100
        </p>
      )}
      {error && <p className="max-w-[260px] text-xs text-red-700">{error}</p>}
    </div>
  );
}
