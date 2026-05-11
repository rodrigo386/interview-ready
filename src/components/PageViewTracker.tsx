"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const COOKIE_NAME = "pv_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Fires a /api/track beacon on every route entry. Reads/sets pv_vid cookie
 * client-side. Mounts once at the root layout; usePathname() dep makes it
 * re-fire on client-side navigation between routes.
 *
 * Why client beacon instead of middleware? Edge runtime on Railway standalone
 * silently dropped SUPABASE_SERVICE_ROLE_KEY, breaking the direct-REST write.
 * Beacon keeps the write in a Node API route where env always works.
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Skip admin/dashboard paths — internal traffic, not interesting for
    // public analytics. Server-side filter happens too, but client filter
    // saves the round-trip.
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/prep/") ||
      pathname.startsWith("/partner")
    ) {
      return;
    }

    let visitorId = getCookie(COOKIE_NAME);
    if (!visitorId) {
      visitorId = generateUuid();
      setCookie(COOKIE_NAME, visitorId, COOKIE_MAX_AGE);
    }

    // keepalive lets the request finish even if the user navigates away
    // immediately after landing on the page.
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, path: pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1")}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  // SameSite=Lax + Secure for production safety; works on localhost too.
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${
    location.protocol === "https:" ? "; Secure" : ""
  }`;
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for old browsers — RFC4122 v4 via Math.random (not crypto-strong,
  // but visitor IDs don't need cryptographic strength).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
