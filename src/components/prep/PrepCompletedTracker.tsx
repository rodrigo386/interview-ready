"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

const STORAGE_PREFIX = "prepavaga:prep-completed-fired:";

/**
 * Fires `prep_completed` exactly once per prep per browser session. Mounted
 * by the visão geral page — by the time that route renders, the prep guide
 * has been fetched successfully so we can treat arrival as "user saw a
 * completed prep". Section-level partial completion is its own banner.
 */
export function PrepCompletedTracker({
  sessionId,
  sectionCount,
}: {
  sessionId: string;
  sectionCount?: number;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `${STORAGE_PREFIX}${sessionId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage can be unavailable (private mode) — still fire so
      // we don't lose the event entirely. Worst case is a second fire on
      // reload, which dedup at the dashboard level handles cheaply.
    }
    track("prep_completed", { section_count: sectionCount });
  }, [sessionId, sectionCount]);

  return null;
}
