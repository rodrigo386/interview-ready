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
  const [showDialog, setShowDialog] = useState(false);
  const [paidVia, setPaidVia] = useState("");

  if (payableCents <= 0) {
    return <span className="text-xs text-ink-3">—</span>;
  }

  const handleSubmit = () => {
    if (!paidVia.trim()) {
      setError("Descreva como pagou");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await markAllPayablePaid(partnerId, paidVia.trim());
      if (!res.ok) {
        setError(res.error ?? "Erro");
      } else {
        setShowDialog(false);
        setPaidVia("");
      }
    });
  };

  if (!showDialog) {
    return (
      <button
        type="button"
        onClick={() => setShowDialog(true)}
        className="rounded-pill bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
      >
        Marcar pago
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-orange-500 bg-orange-soft/30 p-3">
      <p className="text-xs font-semibold text-ink">
        Confirmar pagamento de R$ {(payableCents / 100).toFixed(2)}
      </p>
      <input
        type="text"
        value={paidVia}
        onChange={(e) => setPaidVia(e.target.value)}
        placeholder='Ex: "Pix - chave: ana@x.com - 2026-05-07"'
        autoFocus
        className="rounded border border-line bg-white px-2 py-1 text-xs text-ink"
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-pill bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {pending ? "Marcando..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowDialog(false);
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
