"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import { track } from "@/lib/analytics/client";
import { findSku } from "@/lib/billing/prices";

type Kind = "prep_purchase";

/**
 * O botão de compra deste modal sempre leva ao SKU de 1 crédito — quem quer
 * pacote vai pelo link "Ver pacotes" → `/pricing`, onde o `CheckoutButton`
 * decide a quantidade. Constante nomeada (e propagada até o `start`) porque a
 * mesma quantidade precisa aparecer no evento e na cobrança: se um dia o
 * modal passar a vender pacote, as duas mudam juntas ou nenhuma muda.
 */
const MODAL_QTY = 1;

export function UpgradeModal({
  open,
  onClose,
  onCheckout,
  reason = "quota_exceeded",
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: (kind: Kind, qty: number) => void;
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
    // `checkout_iniciado` também sai daqui, e não só do `CheckoutButton`.
    // Este modal é o paywall de verdade — o que `GenerateFullPrepCta`,
    // `NewPrepForm` e `PrepFailed` abrem quando o saldo acaba —, e ele
    // chamava `checkout.start()` direto, sem emitir nada. Como o webhook
    // emite `checkout_confirmado` para TODA compra, a taxa "checkout
    // iniciado → pagamento confirmado" (métrica de sucesso da spec) saía
    // maior que 100% e sem denominador confiável.
    //
    // Emitido no clique, pelo mesmo motivo do `CheckoutButton`: uma intenção
    // de compra, um evento. O laço de retry dos 422 de
    // `cpf_required`/`address_required` vive DENTRO do `start()` e reenvia o
    // POST até 3 vezes — emitir lá dentro contaria tentativa, não intenção.
    // O `disabled={pendingKind !== null}` do botão fecha a outra ponta: não
    // dá para clicar duas vezes no mesmo modal aberto.
    track("checkout_iniciado", {
      qty: MODAL_QTY,
      cents: findSku(MODAL_QTY)?.cents ?? 0,
    });
    setPendingKind(kind);
    onCheckout(kind, MODAL_QTY);
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
