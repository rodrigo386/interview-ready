"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const SHOWN_STORAGE_KEY = "pv_exit_popup_shown_at";
const RESHOW_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 1 week between shows
const MIN_DWELL_MS = 8000; // don't trigger within 8s of landing
const TOP_LEAVE_THRESHOLD_PX = 12;

/**
 * Mouse-leave-the-top capture for anonymous landing visitors. When the user
 * moves the cursor toward the browser chrome (likely to close/switch tabs),
 * we surface a soft offer reminding them the first prep is free + permanent.
 *
 * Constraints:
 *  - Desktop only (mouseleave is unreliable on touch — mobile gets the
 *    sticky bottom CTA pattern from the Hero anyway).
 *  - Respects prefers-reduced-motion implicitly (no big animation).
 *  - Stored in localStorage so it doesn't re-fire on every page in a
 *    session. Re-shows after 1 week so returning prospects get a nudge.
 *  - 8s dwell minimum so accidental top-edge brushes early in the visit
 *    don't fire (would be obnoxious).
 *
 * Mounted at the Hero/landing level (caller controls when to render — should
 * be skipped for logged-in users to avoid pestering them about their own
 * accounts).
 */
export function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);

  // Arm after dwell. Also short-circuit if popup was shown recently.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const lastShownAt = Number(localStorage.getItem(SHOWN_STORAGE_KEY) ?? "0");
      if (Number.isFinite(lastShownAt) && Date.now() - lastShownAt < RESHOW_AFTER_MS) {
        return;
      }
    } catch {
      // localStorage blocked — proceed without the rate limit
    }
    const t = setTimeout(() => setArmed(true), MIN_DWELL_MS);
    return () => clearTimeout(t);
  }, []);

  // Detect mouseleave through the top of the viewport.
  useEffect(() => {
    if (!armed || open) return;
    if (typeof window === "undefined") return;

    function onMouseOut(e: MouseEvent) {
      // Mouse moved INTO browser chrome (e.relatedTarget is null when
      // leaving viewport entirely) AND the exit point was near the top.
      if (e.relatedTarget !== null) return;
      if (e.clientY > TOP_LEAVE_THRESHOLD_PX) return;
      setOpen(true);
      try {
        localStorage.setItem(SHOWN_STORAGE_KEY, String(Date.now()));
      } catch {
        // ignore
      }
    }

    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [armed, open]);

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-popup-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/60 px-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-orange-500 bg-bg p-6 text-center shadow-prep"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={close}
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-bg hover:text-text-primary"
        >
          ×
        </button>

        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700">
          Espera
        </p>
        <h2
          id="exit-popup-title"
          className="mt-2 text-2xl font-semibold tracking-tight text-text-primary"
        >
          Sua primeira preparação é{" "}
          <span className="text-orange-500">grátis e vitalícia</span>
        </h2>
        <p className="mt-3 text-sm leading-snug text-text-secondary">
          Sem cartão, sem fidelidade. Cola o link de uma vaga + seu CV e em ~60s
          você recebe ATS, pesquisa da empresa e perguntas prováveis.
        </p>

        <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            onClick={close}
            className="inline-flex items-center justify-center gap-2 rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
          >
            Criar conta grátis
            <span aria-hidden>→</span>
          </Link>
          <button
            type="button"
            onClick={close}
            className="rounded-pill border border-line bg-bg px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-line"
          >
            Agora não
          </button>
        </div>

        <p className="mt-4 text-[11px] text-text-tertiary">
          Pode ler nossos artigos antes em{" "}
          <Link
            href="/artigos"
            onClick={close}
            className="underline hover:text-text-primary"
          >
            /artigos
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
