"use client";

import type { PostHog } from "posthog-js";
import type { FunnelEventMap, FunnelEventName } from "./events";

// Module-singleton. Initialized exactly once per browser session by
// <AnalyticsClient /> at the root layout. All other code calls track().
let client: PostHog | null = null;
let initPromise: Promise<void> | null = null;

// `||` (not `??`) on purpose: next.config.ts inlines these vars, and an unset
// var in the build environment becomes the empty string `""` — not undefined.
// `??` would keep `""` and leave PostHog resolving its API URLs against the
// app's own origin (→ 404 HTML, SDK dies). `||` falls back to the real host
// for empty strings too. Applied to KEY for symmetry — `isAnalyticsEnabled()`
// still uses `Boolean(KEY)` so the disabled-when-unset behavior is preserved.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

export function isAnalyticsEnabled(): boolean {
  return Boolean(KEY);
}

/**
 * Idempotent boot. Safe to call from React effect on every mount.
 *
 * LGPD posture:
 *  - `persistence: "localStorage"` — first-party storage only, no cookies set
 *    by PostHog. The site has zero analytics cookies today and the existing
 *    `pv_vid` cookie remains the only one until a consent banner ships.
 *  - `ip` capture is set to `false` so PostHog EU does not store the IP
 *    address against the event. This matches what `/lgpd` promises.
 *  - `respect_dnt: true` — anyone with browser Do-Not-Track set is dropped
 *    by the SDK locally before any network call.
 */
export async function initAnalytics(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!KEY) return;
  if (client) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const mod = await import("posthog-js");
    const posthog = mod.default;
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: false, // we fire `landing_view` ourselves
      capture_pageleave: true,
      persistence: "localStorage",
      disable_session_recording: true,
      ip: false,
      respect_dnt: true,
      person_profiles: "identified_only",
    });
    client = posthog;
  })();
  return initPromise;
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!client) return;
  try {
    client.identify(userId, traits);
  } catch {
    // never break the app for analytics
  }
}

export function resetAnalytics() {
  if (!client) return;
  try {
    client.reset();
  } catch {
    // ignore
  }
}

export function track<E extends FunnelEventName>(
  event: E,
  properties: FunnelEventMap[E],
): void {
  if (typeof window === "undefined") return;
  if (!client) {
    // Pre-init buffer: replay once init resolves. Keeps the first
    // landing_view from being lost if init hasn't completed yet.
    if (initPromise) {
      initPromise.then(() => track(event, properties)).catch(() => undefined);
    }
    return;
  }
  try {
    client.capture(event, properties);
  } catch {
    // ignore
  }
}
