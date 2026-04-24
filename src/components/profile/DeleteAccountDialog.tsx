"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/app/(app)/profile/actions";

export function DeleteAccountDialog({
  action,
}: {
  action: (i: { confirmation: "EXCLUIR" }) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (text !== "EXCLUIR") return;
    startTransition(async () => {
      const result = await action({ confirmation: "EXCLUIR" });
      if (!result.ok) setError(result.error);
      // success: action redirects, no client work needed
    });
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Excluir minha conta
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-lg bg-bg p-6 shadow-prep"
      >
        <h3 className="text-lg font-semibold text-text-primary">Excluir minha conta</h3>
        <p className="text-sm text-text-secondary">
          Essa ação é permanente. Todos os seus preps, CVs e dados serão excluídos
          imediatamente. Digite <strong>EXCLUIR</strong> para confirmar.
        </p>
        <div>
          <label htmlFor="del-confirm" className="mb-1 block text-sm text-text-secondary">
            Digite EXCLUIR para confirmar
          </label>
          <input
            id="del-confirm"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setText("");
              setError(null);
            }}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={text !== "EXCLUIR" || pending}
          >
            {pending ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
        </div>
      </form>
    </div>
  );
}
