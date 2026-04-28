"use client";

import { useState, useTransition } from "react";
import { deleteUserAction } from "@/app/admin/actions";

export function DeleteUserButton({
  userId,
  email,
  disabled,
}: {
  userId: string;
  email: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await deleteUserAction(userId);
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
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-soft px-2 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-soft disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-300"
      >
        Excluir
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
              Excluir usuário?
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Tem certeza que quer excluir <strong>{email}</strong>? Apaga conta,
              perfil, preps, CVs e histórico em cascata. <strong>Não dá pra desfazer.</strong>
            </p>
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
                className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? "Excluindo…" : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
