"use client";

import { useCheckoutFlow } from "./useCheckoutFlow";

type Kind = "pro_subscription" | "prep_purchase";

export function CheckoutButton({
  kind,
  children,
  variant,
}: {
  kind: Kind;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const { start, pending, error, dialog } = useCheckoutFlow();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(kind)}
        className={
          variant === "ghost"
            ? "rounded-pill border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-bg disabled:opacity-60"
            : "rounded-pill bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        }
      >
        {pending ? "Abrindo…" : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-500">
          {error}
        </p>
      )}
      {dialog}
    </>
  );
}
