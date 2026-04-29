"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mounts inside PrepSkeleton while generation_status is pending/generating.
 * Calls router.refresh() every 5s so the layout re-fetches the row from
 * Supabase. When the row flips to 'complete' or 'failed', the layout's
 * conditional swaps PrepSkeleton out for the real content (or PrepFailed).
 *
 * Soft-refresh keeps the URL and avoids a full page reload — preserves
 * scroll, in-flight requests, and feels native.
 */
export function PrepSkeletonRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
