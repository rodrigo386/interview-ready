"use client";

import { useState, useTransition } from "react";
import { testTracking } from "@/app/admin/actions";

export function TestTrackingButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { kind: "ok"; rowId: string }
    | { kind: "err"; message: string; code?: string }
    | null
  >(null);

  const handle = () => {
    setResult(null);
    startTransition(async () => {
      const r = await testTracking();
      if (r.ok) {
        setResult({ kind: "ok", rowId: r.rowId });
      } else {
        setResult({ kind: "err", message: r.error, code: r.code });
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="rounded-pill bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-prep transition hover:bg-orange-700 disabled:opacity-50"
      >
        {pending ? "Testando..." : "Testar tracking (insert direto)"}
      </button>
      {result?.kind === "ok" && (
        <p className="text-xs text-green-700">
          ✓ Row {result.rowId.slice(0, 8)}... criado. Tabela e RLS estão OK.
          Recarregue a página pra ver no diagnóstico — se aparecer aqui mas a
          contagem de visitas reais continua 0, o problema é no middleware
          (Edge runtime ou matcher).
        </p>
      )}
      {result?.kind === "err" && (
        <div className="text-xs text-red-700">
          <p>✗ Falhou: {result.message}</p>
          {result.code && <p>Código Postgres: {result.code}</p>}
          <p className="mt-1 text-text-tertiary">
            Tabela está acessível mas o insert falhou — provavelmente RLS ou
            schema. Verifica migration 0018 aplicada.
          </p>
        </div>
      )}
    </div>
  );
}
