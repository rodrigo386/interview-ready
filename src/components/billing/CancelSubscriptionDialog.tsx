"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function CancelSubscriptionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (text !== "CANCELAR") return;
    setError(null);
    start(async () => {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Erro HTTP ${res.status}`);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Cancelar assinatura
      </Button>
    );
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg bg-bg p-6 shadow-prep">
        <h3 className="text-lg font-semibold text-text-primary">Cancelar assinatura</h3>
        <p className="text-sm text-text-secondary">
          Sua conta vai voltar pro plano Free no fim do ciclo atual. Preps gerados continuam acessíveis.
          Digite <strong>CANCELAR</strong> pra confirmar.
        </p>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          placeholder="CANCELAR"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => { setOpen(false); setText(""); setError(null); }} disabled={pending}>
            Voltar
          </Button>
          <Button type="button" onClick={submit} disabled={text !== "CANCELAR" || pending}>
            {pending ? "Cancelando…" : "Cancelar definitivamente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
