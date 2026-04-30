"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

type Kind = "pro_subscription" | "prep_purchase";

export function UpgradeModal({
  open,
  onClose,
  onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: (kind: Kind) => void;
}) {
  const [pendingKind, setPendingKind] = useState<Kind | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef, onClose);

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
          Você já usou sua prep grátis
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          Sua prep grátis vem 1 vez por conta. Pra continuar, assine o Pro ou compre uma prep avulsa.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-orange-500 bg-orange-soft p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Recomendado · promo de lançamento
            </p>
            <h4 className="mt-1 text-lg font-bold text-ink">Pro</h4>
            <p className="text-sm text-ink-2">
              Uso ilimitado.{" "}
              <span className="text-ink-3 line-through">R$ 50</span>{" "}
              <strong className="text-orange-700">R$ 30/mês</strong>
            </p>
            <p className="mt-1 text-[11px] text-ink-3">
              Fair use ~50/mês cobre uso intensivo.
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-flex w-full items-center justify-center rounded-pill bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Ver detalhes do Pro
            </Link>
          </div>
          <div className="rounded-lg border border-line bg-bg p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
              Avulso
            </p>
            <h4 className="mt-1 text-lg font-bold text-ink">1 prep · R$ 10</h4>
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
