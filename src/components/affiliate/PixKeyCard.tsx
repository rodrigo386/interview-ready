"use client";

import { useState, useTransition } from "react";
import { updatePixKey } from "@/app/(app)/partner/actions";
import { safeCall } from "@/lib/affiliate/safe-action";

export function PixKeyCard({ initialPixKey }: { initialPixKey: string | null }) {
  const [editing, setEditing] = useState(false);
  const [pixKey, setPixKey] = useState(initialPixKey ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("pix_key", pixKey);
      const wrapped = await safeCall(() => updatePixKey(fd));
      if (!wrapped.ok) {
        setError(wrapped.message);
        return;
      }
      const res = wrapped.value;
      if (res.ok) {
        setEditing(false);
      } else {
        setError(res.error ?? "Erro");
      }
    });
  };

  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-prep">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
          Chave Pix (recebimento)
        </p>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-orange-700 hover:underline"
          >
            Editar
          </button>
        )}
      </div>

      {!editing ? (
        <p className="mt-2 break-all font-mono text-sm text-ink">
          {initialPixKey || "—"}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="CPF, e-mail, celular ou chave aleatória"
            autoFocus
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink"
          />
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="rounded-pill bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {pending ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
                setPixKey(initialPixKey ?? "");
              }}
              disabled={pending}
              className="rounded-pill border border-line px-4 py-1.5 text-xs font-semibold text-ink-2 hover:bg-bg disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
