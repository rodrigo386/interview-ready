"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Kind = "pro_subscription" | "prep_purchase";

export function UpgradeModal({
  open,
  onClose,
  onCheckout,
  daysToReset,
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: (kind: Kind) => void;
  daysToReset?: number;
}) {
  const [pendingKind, setPendingKind] = useState<Kind | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handle = (kind: Kind) => {
    setPendingKind(kind);
    onCheckout(kind);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-bg p-6 shadow-prep"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-text-primary">
          Você atingiu o limite do plano Free
        </h3>
        {typeof daysToReset === "number" && daysToReset > 0 && (
          <p className="mt-2 text-sm text-text-secondary">
            Próximo prep grátis em ~{daysToReset} {daysToReset === 1 ? "dia" : "dias"}.
          </p>
        )}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-orange-500 bg-orange-soft p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Recomendado
            </p>
            <h4 className="mt-1 text-lg font-bold text-ink">Pro</h4>
            <p className="text-sm text-ink-2">Preps ilimitados, R$ 30 / mês</p>
            <Button
              type="button"
              onClick={() => handle("pro_subscription")}
              disabled={pendingKind !== null}
              className="mt-4 w-full"
            >
              {pendingKind === "pro_subscription" ? "Abrindo…" : "Assinar Pro"}
            </Button>
          </div>
          <div className="rounded-lg border border-line bg-bg p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
              Avulso
            </p>
            <h4 className="mt-1 text-lg font-bold text-ink">1 prep — R$ 10</h4>
            <p className="text-sm text-ink-2">Pague só este prep, sem mensalidade.</p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handle("prep_purchase")}
              disabled={pendingKind !== null}
              className="mt-4 w-full"
            >
              {pendingKind === "prep_purchase" ? "Abrindo…" : "Comprar este prep"}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
