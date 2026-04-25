"use client";

import { useTransition } from "react";
import { rerunCompanyIntel } from "@/app/prep/[id]/actions";

export function RerunIntelButton({
  sessionId,
  isResearching,
  variant = "primary",
}: {
  sessionId: string;
  isResearching: boolean;
  variant?: "primary" | "ghost";
}) {
  const [pending, startTransition] = useTransition();
  const disabled = pending || isResearching;
  const className =
    variant === "primary"
      ? "inline-flex items-center justify-center rounded-pill bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-prep transition-colors hover:bg-orange-700 disabled:opacity-60"
      : "inline-flex items-center justify-center rounded-pill border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-2 transition-colors hover:bg-bg disabled:opacity-60";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => startTransition(() => rerunCompanyIntel(sessionId))}
      className={className}
    >
      {pending || isResearching ? "Pesquisando…" : "Pesquisar empresa"}
    </button>
  );
}
