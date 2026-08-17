"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import { track } from "@/lib/analytics/client";

type Kind = "pro_subscription" | "prep_purchase";

export function UpgradeModal({
  open,
  onClose,
  onCheckout,
  reason = "quota_exceeded",
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: (kind: Kind) => void;
  reason?: "quota_exceeded" | "soft_cap" | "other";
}) {
  const [pendingKind, setPendingKind] = useState<Kind | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef, onClose);

  // Fire once per open. Multiple effect runs while `open` stays true must
  // not re-fire — gated by the dep array which only changes on transitions.
  useEffect(() => {
    if (open) {
      track("paywall_view", { reason });
    }
  }, [open, reason]);

  if (!open) return null;

  const handle = (kind: Kind) => {
    setPendingKind(kind);
    onCheckout(kind);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl rounded-lg bg-bg p-6 shadow-prep"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="upgrade-modal-title" className="text-xl font-bold text-text-primary">
          Seus créditos acabaram
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          A análise ATS que você já viu continua grátis. Pra gerar o resto da preparação —
          pesquisa da empresa, currículo reescrito e roteiros de pergunta — compre um crédito.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-orange-500 bg-orange-soft p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Avulso
            </p>
            <h4 className="mt-1 text-lg font-bold text-ink">1 prep · R$ 10</h4>
            <p className="text-sm text-ink-2">Pague só esta preparação, sem mensalidade.</p>
            <Button
              type="button"
              variant="primary"
              onClick={() => handle("prep_purchase")}
              disabled={pendingKind !== null}
              className="mt-4 w-full"
            >
              {pendingKind === "prep_purchase" ? "Abrindo…" : "Comprar este prep"}
            </Button>
          </div>
          <div className="rounded-lg border border-line bg-bg p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
              Economize em pacote
            </p>
            <h4 className="mt-1 text-lg font-bold text-ink">3 por R$ 25 · 5 por R$ 40</h4>
            <p className="text-sm text-ink-2">
              Créditos não expiram. Use quando precisar, vaga por vaga.
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-flex w-full items-center justify-center rounded-pill border border-orange-500 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-soft"
            >
              Ver pacotes
            </Link>
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
