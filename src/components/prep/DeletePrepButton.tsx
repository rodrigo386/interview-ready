"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deletePrep } from "@/app/prep/[id]/actions";

type Variant = "full" | "compact";

export function DeletePrepButton({
  sessionId,
  companyName,
  variant = "full",
}: {
  sessionId: string;
  companyName: string;
  variant?: Variant;
}) {
  const [confirming, setConfirming] = useState(false);
  const action = deletePrep.bind(null, sessionId);

  if (!confirming) {
    return variant === "compact" ? (
      <CompactIdle onOpen={() => setConfirming(true)} />
    ) : (
      <FullIdle onOpen={() => setConfirming(true)} />
    );
  }

  return (
    <form action={action} className="contents">
      {variant === "compact" ? (
        <CompactConfirm onCancel={() => setConfirming(false)} />
      ) : (
        <FullConfirm
          companyName={companyName}
          onCancel={() => setConfirming(false)}
        />
      )}
    </form>
  );
}

function FullIdle({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-2 rounded-md border border-red-900/40 bg-red-950/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40"
    >
      🗑 Excluir este prep
    </button>
  );
}

function FullConfirm({
  companyName,
  onCancel,
}: {
  companyName: string;
  onCancel: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-3 rounded-md border border-red-900/50 bg-red-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-red-200">
        Excluir o prep de <strong>{companyName}</strong>? Esta ação não pode ser
        desfeita.
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          {pending ? "Excluindo…" : "Sim, excluir"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary hover:bg-surface-muted disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function CompactIdle({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Excluir prep"
      title="Excluir prep"
      className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-red-950/40 hover:text-red-300"
    >
      🗑
    </button>
  );
}

function CompactConfirm({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-1">
      <button
        type="submit"
        disabled={pending}
        aria-label="Confirmar exclusão"
        className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
      >
        {pending ? "…" : "Excluir"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        aria-label="Cancelar exclusão"
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary hover:bg-surface-muted disabled:opacity-60"
      >
        Cancelar
      </button>
    </div>
  );
}
