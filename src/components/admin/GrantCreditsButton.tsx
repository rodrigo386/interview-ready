"use client";

import { useState, useTransition } from "react";
import { grantCreditsAction } from "@/app/admin/actions";

/**
 * Concessão manual de crédito, no `/admin/users`. Mesmo molde do
 * `GrantProButton` (botão discreto → dialog de confirmação → action), com um
 * campo de quantidade a mais.
 *
 * É o caminho de compensação do operador para quem pagou e não recebeu. Sem
 * ele, o único jeito era rodar UPDATE no SQL Editor de produção.
 */
export function GrantCreditsButton({
  userId,
  email,
  prepCredits,
}: {
  userId: string;
  email: string;
  prepCredits: number;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
    setDone(null);
    setQty("1");
  }

  function onConfirm() {
    setError(null);
    const parsed = Number(qty);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      setError("Informe um número inteiro de 1 a 50.");
      return;
    }
    startTransition(async () => {
      const res = await grantCreditsAction(userId, parsed);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Mostra o saldo resultante em vez de fechar direto: concessão de
      // crédito é irreversível pela UI, então o operador precisa ver o que
      // ficou antes de sair.
      setDone(res.balance);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-orange-soft px-2 py-1 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-soft dark:border-orange-900 dark:text-orange-300"
      >
        + Crédito
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="grant-credits-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-lg border border-neutral-200 bg-bg p-5 shadow-prep dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="grant-credits-title"
              className="text-base font-semibold text-text-primary"
            >
              Conceder crédito de preparação
            </h3>
            {done === null ? (
              <>
                <p className="mt-2 text-sm text-text-secondary">
                  Adicionar créditos a <strong>{email}</strong>. Saldo atual:{" "}
                  <strong>{prepCredits}</strong>.
                </p>
                <label
                  htmlFor="grant-credits-qty"
                  className="mt-4 block text-xs font-semibold text-text-secondary"
                >
                  Quantidade (1 a 50)
                </label>
                <input
                  id="grant-credits-qty"
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={qty}
                  disabled={pending}
                  onChange={(e) => setQty(e.target.value)}
                  className="mt-1 w-24 rounded-md border border-neutral-200 bg-bg px-3 py-1.5 text-sm dark:border-zinc-800"
                />
                <p className="mt-3 rounded-md border border-yellow-soft bg-yellow-soft/40 px-3 py-2 text-xs text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300">
                  Não há como desfazer pela UI. Cada crédito vale uma preparação
                  completa (R$ 10).
                </p>
              </>
            ) : (
              <p className="mt-2 rounded-md border border-green-soft bg-green-soft/40 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
                Concedido. Saldo de <strong>{email}</strong> agora é{" "}
                <strong>{done}</strong>.
              </p>
            )}
            {error && (
              <p className="mt-3 rounded-md border border-red-soft bg-red-soft/40 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary dark:border-zinc-800"
              >
                {done === null ? "Cancelar" : "Fechar"}
              </button>
              {done === null && (
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={pending}
                  className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  {pending ? "Concedendo…" : "Conceder"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
