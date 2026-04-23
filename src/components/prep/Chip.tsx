import type { ReactNode } from "react";

export type ChipVariant = "default" | "orange";

export function Chip({
  variant = "default",
  children,
}: {
  variant?: ChipVariant;
  children: ReactNode;
}) {
  const variantClass =
    variant === "orange"
      ? "bg-orange-soft text-orange-700"
      : "bg-bg text-ink-2 border border-line";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium ${variantClass}`}
    >
      {children}
    </span>
  );
}
