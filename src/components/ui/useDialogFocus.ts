"use client";

import { useEffect, type RefObject } from "react";

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
 */
export function useDialogFocus<T extends HTMLElement>(
  open: boolean,
  dialogRef: RefObject<T | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
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
        onClose();
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
  }, [open, dialogRef, onClose, initialFocusRef]);
}
