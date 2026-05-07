"use client";

import { useState, useTransition } from "react";
import { approvePartner, denyPartner } from "@/app/admin/affiliates/actions";

export function ApprovalDialog({
  partnerId,
  displayName,
}: {
  partnerId: string;
  displayName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await approvePartner(partnerId);
      if (!res.ok) setError(res.error ?? "Erro");
    });
  };

  const handleDeny = () => {
    if (!confirm(`Negar aplicação de ${displayName}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await denyPartner(partnerId);
      if (!res.ok) setError(res.error ?? "Erro");
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={pending}
          className="rounded-pill bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          Aprovar
        </button>
        <button
          type="button"
          onClick={handleDeny}
          disabled={pending}
          className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-bg disabled:opacity-50"
        >
          Negar
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
