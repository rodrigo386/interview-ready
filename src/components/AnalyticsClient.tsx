"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAnalytics, track } from "@/lib/analytics/client";

/**
 * Mounts once at the root layout. Owns three responsibilities:
 *
 *  1. Initialize PostHog on first mount (idempotent, LGPD-safe defaults
 *     handled inside `initAnalytics`).
 *  2. Fire `landing_view` on `/` route entry (including soft nav).
 *  3. Delegate `cta_click` from any element marked `data-analytics-cta`.
 *     Keeps tracking attribute-driven so components stay tracking-free.
 *
 * If `NEXT_PUBLIC_POSTHOG_KEY` is unset, every call below is a no-op —
 * the existing `<PageViewTracker />` keeps owning page_views the way it
 * always has.
 */
export function AnalyticsClient() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (pathname === "/") {
      track("landing_view", { path: "/" });
    }
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      const el = target.closest<HTMLElement>("[data-analytics-cta]");
      if (!el) return;
      const cta = el.dataset.analyticsCta ?? "unknown";
      const location = el.dataset.analyticsLocation ?? pathname ?? "unknown";
      const href =
        el instanceof HTMLAnchorElement
          ? el.getAttribute("href") ?? undefined
          : undefined;
      track("cta_click", { cta, location, href });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pathname]);

  return null;
}
