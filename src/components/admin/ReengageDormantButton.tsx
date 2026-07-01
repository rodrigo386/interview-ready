"use client";

import { useState, useTransition } from "react";
import { reengageDormantUsersAction } from "@/app/admin/actions";

export function ReengageDormantButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { kind: "ok"; sent: number; skipped: number }
    | { kind: "err"; message: string }
    | null
  >(null);

  const handle = () => {
    setResult(null);
    startTransition(async () => {
      const r = await reengageDormantUsersAction();
      if (r.ok) {
        setResult({ kind: "ok", sent: r.sent, skipped: r.skipped });
      } else {
        setResult({ kind: "err", message: r.error });
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
        {pending ? "Enviando..." : "Reengajar dormentes"}
      </button>
      {result?.kind === "ok" && (
        <p className="text-xs text-green-700">
          ✓ {result.sent} email{result.sent === 1 ? "" : "s"} enviado
          {result.sent === 1 ? "" : "s"}
          {result.skipped > 0 ? ` · ${result.skipped} falhou(ram) no envio` : ""}.
          {result.sent === 0 && result.skipped === 0
            ? " Nenhum usuário dormente elegível."
            : ""}
        </p>
      )}
      {result?.kind === "err" && (
        <p className="text-xs text-red-700">✗ {result.message}</p>
      )}
    </div>
  );
}
