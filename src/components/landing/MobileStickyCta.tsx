"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Only appears after the visitor scrolls past the hero (~1 viewport). Before
// that, the hero CTA is on screen and a second CTA would be noise.
const SHOW_AFTER_PX = 560;

/**
 * Mobile-only persistent CTA bar for anonymous landing visitors. On phones the
 * navbar CTA is hidden behind the hamburger, so once the visitor scrolls past
 * the hero there is no signup path until the very bottom of the page. This bar
 * closes that gap. Desktop already has the sticky navbar CTA + exit-intent
 * popup, so it renders md:hidden.
 */
export function MobileStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-bg/95 px-4 pt-2.5 backdrop-blur-md md:hidden dark:border-zinc-800"
      style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs leading-snug text-text-secondary">
          <span className="block font-semibold text-text-primary">
            1ª preparação grátis
          </span>
          Sem cartão. Pronta em minutos.
        </p>
        <Link
          href="/signup"
          data-analytics-cta="mobile_sticky"
          data-analytics-location="landing"
          className="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition hover:bg-brand-700"
        >
          Criar conta →
        </Link>
      </div>
    </div>
  );
}
