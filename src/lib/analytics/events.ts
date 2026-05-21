/**
 * Funnel event schema. Names match PRE-3's acceptance criteria 1:1 so the
 * PostHog dashboard can be built straight off these strings without
 * renaming. Property bags are deliberately small — keep them queryable as
 * top-level columns in PostHog, not nested JSON.
 *
 * Add a new event by extending FunnelEventMap; the typed helpers in
 * `client.ts` and `server.ts` will surface any missing properties.
 */
export type FunnelEventMap = {
  landing_view: { path: string };
  cta_click: { cta: string; location: string; href?: string };
  // `form_variant` tags the signup-friction experiment (PRE-4). It is optional
  // so Google OAuth signups (which never render the form) stay valid; the
  // email form always sets it. Before/after lift = filter on this property.
  signup_started: { method: "email" | "google"; form_variant?: string };
  signup_completed: {
    method: "email" | "google";
    pending_confirmation: boolean;
    form_variant?: string;
  };
  prep_started: { has_existing_cv: boolean; jd_source: "paste" | "url" | "unknown" };
  prep_completed: { duration_ms?: number; section_count?: number };
  paywall_view: { reason: "quota_exceeded" | "soft_cap" | "other" };
  checkout_started: { kind: "pro_subscription" | "prep_purchase" };
  checkout_completed: {
    kind: "pro_subscription" | "prep_purchase";
    amount_cents: number;
    billing_method?: string;
  };
  subscription_started: {
    plan: "pro_promo_30" | "pro_full_50" | "other";
    amount_cents: number;
    billing_method?: string;
  };
};

export type FunnelEventName = keyof FunnelEventMap;
