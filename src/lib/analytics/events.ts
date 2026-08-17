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
  landing_view: {
    path: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  };
  cta_click: { cta: string; location: string; href?: string };
  // `form_variant` tags the signup-friction experiment (PRE-4). It is optional
  // so Google OAuth signups (which never render the form) stay valid; the
  // email form always sets it. Before/after lift = filter on this property.
  // utm_* fields carry attribution from the landing URL through signup for
  // funnel filtering in PostHog (PRE-13 campaign attribution).
  signup_started: {
    method: "email" | "google";
    form_variant?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
  };
  signup_completed: {
    method: "email" | "google";
    pending_confirmation: boolean;
    form_variant?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
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
  // Ferramenta ATS anônima (/analise-ats-gratis). São os três passos que as
  // métricas de sucesso da spec pedem: quantas análises rodam, quantas
  // chegam ao resultado, e quantas viram conta. `anon_ats_started` e
  // `anon_ats_completed` saem do navegador com distinctId anônimo do
  // PostHog; `anon_ats_claimed` sai do servidor já com o user id, e é o
  // ponto onde o PostHog costura a pessoa anônima com a conta.
  anon_ats_started: {
    cv_source: "file" | "paste";
    /** Onde o formulário foi enviado. "hero" é a landing, "page" é
     * /analise-ats-gratis. Separa o topo de funil da home do tráfego que
     * chega direto na ferramenta. Opcional: eventos anteriores a
     * 2026-08-17 não têm a propriedade. */
    placement?: "hero" | "page";
  };
  anon_ats_completed: {
    score: number;
    fixes_count: number;
    /** "gemini" — qual modelo produziu a nota. Linhas de antes de
     * 2026-08-16 podem trazer "cerebras" (removido, ver CLAUDE.md §10). */
    model_used?: string;
  };
  anon_ats_claimed: { method: "email" | "google" };
  subscription_started: {
    plan: "pro_promo_30" | "pro_full_50" | "other";
    amount_cents: number;
    billing_method?: string;
  };
  // Funil do crédito avulso (Task 9, PRE-3): sem estes dois, 3 das 4 métricas
  // de sucesso da spec ficam inapuráveis. `checkout_iniciado` sai do
  // CheckoutButton, uma vez por clique (uma intenção de compra) — mesmo que
  // o useCheckoutFlow precise reenviar o POST por causa de um 422
  // cpf_required/address_required, o evento não repete por tentativa.
  // `checkout_confirmado` sai do servidor no webhook (`handlePaymentReceived`),
  // só quando `externalReference.kind === "prep_purchase"` — assinatura tem
  // seu próprio `subscription_started` e não deve contar aqui. `qty`/`cents`
  // seguem os SKUs de `PREP_SKUS` (1→1000, 3→2500, 5→4000 centavos).
  checkout_iniciado: { qty: number; cents: number };
  checkout_confirmado: { qty: number; cents: number };
};

export type FunnelEventName = keyof FunnelEventMap;
