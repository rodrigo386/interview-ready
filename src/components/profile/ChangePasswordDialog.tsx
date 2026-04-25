"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/app/(app)/profile/actions";

export function ChangePasswordDialog({
  action,
}: {
  action: (i: { currentPassword: string; newPassword: string }) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setSuccess(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (next !== confirm) {
      setError("As senhas novas não coincidem.");
      return;
    }
    if (next.length < 8) {
      setError("A senha nova precisa ter pelo menos 8 caracteres.");
      return;
    }
    startTransition(async () => {
      const result = await action({ currentPassword: current, newPassword: next });
      if (result.ok) {
        setSuccess(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setError(result.error);
      }
    });
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Trocar senha
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
        <h3 className="text-lg font-semibold text-text-primary">Trocar senha</h3>
        <div>
          <label className="mb-1 block text-sm text-text-secondary" htmlFor="cur-pwd">
            Senha atual
          </label>
          <input
            id="cur-pwd"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-secondary" htmlFor="new-pwd">
            Nova senha
          </label>
          <input
            id="new-pwd"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            required
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-secondary" htmlFor="cnf-pwd">
            Confirme a nova senha
          </label>
          <input
            id="cnf-pwd"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-700">Senha trocada com sucesso.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close} disabled={pending}>
            Fechar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
