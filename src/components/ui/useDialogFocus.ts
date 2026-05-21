"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Adds dialog-grade focus management to a modal:
 *
 * - When `open` becomes true, focus moves into the dialog (the first
 *   focusable element OR a node passed via `initialFocusRef`).
 * - Tab / Shift+Tab cycle within the dialog (focus trap).
 * - ESC fires `onClose`.
 * - When `open` becomes false, focus restores to whatever element opened
 *   the dialog (typically a button on the page that's now hidden).
 *
 * Body scroll is locked while open so the page behind doesn't scroll on
 * mobile when the user touches the dialog backdrop.
 *
 * `onClose` is captured via a ref so callers don't need to memoize it.
 * Without this, a fresh `onClose` reference each render would cause the
 * effect to re-run on every keystroke (cleanup restores focus → effect
 * re-runs and re-focuses CEP), making the form impossible to fill out.
 */
export function useDialogFocus<T extends HTMLElement>(
  open: boolean,
  dialogRef: RefObject<T | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  // Stable ref to the latest onClose. Reading from this inside the effect
  // means the effect itself doesn't depend on the callback identity.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Lock body scroll.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog. Wait one frame so refs from children
    // (e.g. autoFocus inputs) settle first.
    const focusTarget =
      initialFocusRef?.current ??
      dialog.querySelector<HTMLElement>(FOCUSABLE) ??
      dialog;
    requestAnimationFrame(() => focusTarget.focus());

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = Array.from(
        dialog!.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the trigger element if still in the DOM.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
    // Intentionally only depends on `open`. dialogRef and initialFocusRef
    // are RefObjects (identity stable across renders). onClose is captured
    // via onCloseRef so the effect doesn't re-run on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
