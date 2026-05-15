"use client";

import { useEffect } from "react";
import { identifyUser, resetAnalytics } from "@/lib/analytics/client";

/**
 * Calls `posthog.identify(userId)` once per session so events fired before
 * login (landing_view, signup_started) cohort into the same person as
 * events fired after auth (prep_started, paywall_view, checkout_started).
 *
 * Mount inside server-rendered layouts that already have the user — the
 * Supabase auth check stays where it is, this just passes the id down.
 */
export function AnalyticsIdentify({
  userId,
  tier,
}: {
  userId: string;
  tier?: "free" | "pro" | "team";
}) {
  useEffect(() => {
    if (!userId) {
      resetAnalytics();
      return;
    }
    identifyUser(userId, tier ? { tier } : undefined);
  }, [userId, tier]);
  return null;
}
