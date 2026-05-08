"use client";

import { useState, useTransition } from "react";
import { submitIndexNowAction } from "@/app/admin/actions";

export function IndexNowButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { kind: "ok"; submitted: number; status: number }
    | { kind: "err"; message: string }
    | null
  >(null);

  const handle = () => {
    setResult(null);
    startTransition(async () => {
      const r = await submitIndexNowAction();
      if (r.ok) {
        setResult({ kind: "ok", submitted: r.submitted, status: r.status });
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
        {pending ? "Submetendo..." : "Submeter URLs ao IndexNow"}
      </button>
      {result?.kind === "ok" && (
        <p className="text-xs text-green-700">
          ✓ {result.submitted} URLs submetidas (HTTP {result.status}). Bing/Yandex
          recrawlam em horas.
        </p>
      )}
      {result?.kind === "err" && (
        <p className="text-xs text-red-700">✗ {result.message}</p>
      )}
    </div>
  );
}
