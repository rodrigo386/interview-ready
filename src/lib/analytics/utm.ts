"use client";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

type UtmKey = (typeof UTM_KEYS)[number];
export type UtmParams = Partial<Record<UtmKey, string>>;

const SESSION_KEY = "prepavaga:utm";

/**
 * Read UTM params from the current URL, persist them to sessionStorage so
 * they survive soft-nav and page interactions, then return them. Call on
 * landing page entry; the stored values are later attached to conversion
 * events (signup_started, signup_completed) for campaign funnel attribution.
 */
export function captureUtmFromUrl(): UtmParams {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utms: UtmParams = {};
  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) utms[key] = val;
  }
  if (Object.keys(utms).length > 0) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(utms));
    } catch {
      // sessionStorage may be unavailable in private mode; silently ignore
    }
  }
  return utms;
}

/**
 * Retrieve UTM params captured earlier in the session. Returns an empty
 * object when no UTMs were present on landing (organic traffic).
 */
export function getStoredUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UtmParams) : {};
  } catch {
    return {};
  }
}
