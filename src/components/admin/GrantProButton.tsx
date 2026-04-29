"use client";

import { useState, useTransition } from "react";
import { grantProAction, revokeProAction } from "@/app/admin/actions";

export function GrantProButton({
  userId,
  email,
  tier,
  isAdmin,
  hasAsaasSubscription,
}: {
  userId: string;
  email: string;
  tier: string;
  isAdmin: boolean;
  hasAsaasSubscription: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isPro = tier === "pro";
  const label = isPro ? "Remover Pro" : "Conceder Pro";

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = isPro
        ? await revokeProAction(userId)
        : await grantProAction(userId);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={isAdmin}
        onClick={() => setOpen(true)}
        className={
          "rounded-md border px-2 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 " +
          (isPro
            ? "border-neutral-200 text-text-secondary hover:bg-neutral-100 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
            : "border-green-soft text-green-700 hover:bg-green-soft dark:border-green-900 dark:text-green-300")
        }
        title={isAdmin ? "Admins têm Pro permanente" : undefined}
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-neutral-200 bg-bg p-5 shadow-prep dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-text-primary">
              {isPro ? "Remover Pro?" : "Conceder Pro?"}
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              {isPro ? (
                <>
                  Voltar <strong>{email}</strong> para o plano Free? Perde acesso ilimitado a preps imediatamente.
                </>
              ) : (
                <>
                  Dar acesso Pro ilimitado a <strong>{email}</strong> sem cobrança? Marca como <code>tier=pro</code> + <code>subscription_status=active</code>.
                </>
              )}
            </p>
            {hasAsaasSubscription && (
              <p className="mt-3 rounded-md border border-yellow-soft bg-yellow-soft/40 px-3 py-2 text-xs text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300">
                ⚠️ Este usuário tem subscription Asaas ativa. {isPro
                  ? "Cancele lá também ou o webhook pode reverter este estado."
                  : "Conceder Pro manualmente não substitui a cobrança ativa."}
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
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary dark:border-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className={
                  "rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60 " +
                  (isPro
                    ? "bg-neutral-700 hover:bg-neutral-900 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                    : "bg-green-500 hover:bg-green-700")
                }
              >
                {pending ? "Salvando…" : isPro ? "Remover Pro" : "Conceder Pro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
