# Billing & Paywall (Asaas) — design spec

**Date:** 2026-04-25
**Status:** draft
**Author:** brainstorming session with Claude

## 1. Goal

Activate the freemium model promised in CLAUDE.md §1. Stop giving the
product away for free, start charging in BRL via the Brazilian gateway
**Asaas**, and enforce per-user prep quotas at the only point that
matters: when the user tries to create a new prep.

## 2. Scope (confirmed)

| Decision | Value |
|---|---|
| Pricing | Free 1 prep/30d · Pro R$30/mês ilimitado · Per-use R$10 = 1 prep avulso |
| Currency | BRL only |
| Gateway | Asaas (sandbox + production) |
| Payment methods | Whatever Asaas supports — Pix, cartão, boleto. User picks on Asaas hosted page. |
| Quota enforcement | Hard block at `createPrep` |
| Block UX | Dual-CTA modal: "Assinar Pro R$30" + "Comprar 1 prep R$10" |
| Quota reset | Rolling 30 days from `preps_reset_at` (defaults to signup date) |
| Cancellation | All preps remain readable + writable forever |
| Per-use tracking | Integer `prep_credits` balance on `profiles` |
| Schema | `profiles` extension + new `payments` + `subscription_events` tables |

## 3. Non-goals (MVP)

- Annual / yearly plans.
- Team / multi-seat tier (already in CLAUDE.md as `tier='team'` but not in MVP scope).
- Coupon codes / promo codes.
- Trials beyond the existing "1 prep/30d" Free tier.
- Custom invoice / NF-e generation (Asaas handles fiscal docs on its side).
- In-app payment method storage. PCI scope = zero. Asaas hosted checkout owns it.
- Refund / chargeback admin UI.

## 4. Architecture

### 4.1 Money path (happy)

```
User clicks "Assinar Pro"
  → POST /api/billing/checkout { kind: "pro_subscription" }
    → ensure asaas_customer_id (POST /v3/customers if missing)
    → POST /v3/subscriptions { customer, value:30, cycle:"MONTHLY", ... }
    → returns { paymentLink }
  → 303 redirect to paymentLink (Asaas hosted)
User pays via Pix / card on Asaas
  → Asaas POST /api/asaas/webhook { event:"PAYMENT_RECEIVED", payment:{...} }
    → verify asaas-access-token header == env.ASAAS_WEBHOOK_TOKEN
    → idempotency check: subscription_events.asaas_event_id unique
    → upsert payments row (kind='pro_subscription')
    → UPDATE profiles SET tier='pro', subscription_status='active',
        subscription_renews_at = payment.nextDueDate
  → return 200
User redirected to /dashboard?billing=ok with tier=pro live.
```

### 4.2 Per-use path

Same as Pro but with `POST /v3/payments` (one-shot, no subscription).
Webhook handler increments `profiles.prep_credits` instead of flipping tier.

### 4.3 Quota enforcement at `createPrep`

```ts
function checkQuota(p: ProfileBilling, now: Date): QuotaCheck {
  if (p.subscription_status === 'active' || p.subscription_status === 'overdue') {
    return { allowed: true, mode: 'pro' };
  }
  // Free tier: rolling 30-day window.
  const elapsedMs = now.getTime() - new Date(p.preps_reset_at).getTime();
  if (elapsedMs > 30 * 24 * 3600 * 1000) {
    return { allowed: true, mode: 'reset' };  // caller resets row
  }
  if (p.preps_used_this_month < 1) {
    return { allowed: true, mode: 'free' };
  }
  if (p.prep_credits > 0) {
    return { allowed: true, mode: 'credit' };
  }
  return { allowed: false, mode: 'block' };
}
```

`createPrep` action consumes after generation succeeds:

| mode | side effect |
|---|---|
| `pro` | increment `preps_used_this_month` (analytics only, no enforcement) |
| `reset` | set `preps_used_this_month=1`, `preps_reset_at=NOW()` |
| `free` | increment `preps_used_this_month` |
| `credit` | decrement `prep_credits` |
| `block` | return `{ error: "quota_exceeded" }`, UI shows `<UpgradeModal>` |

### 4.4 Subscription lifecycle

| Event from Asaas | DB write |
|---|---|
| `SUBSCRIPTION_CREATED` | save `asaas_subscription_id` (already saved at checkout time; no-op) |
| `PAYMENT_CREATED` | insert `payments` row, status='pending' |
| `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` | promote to `tier='pro'` (if subscription) or `+1 credit` (if one-off). `payments.status='received'` |
| `PAYMENT_OVERDUE` | `payments.status='overdue'`, `subscription_status='overdue'`. Tier stays. |
| `SUBSCRIPTION_DELETED` | set `subscription_status='canceled'`. If `subscription_renews_at < NOW()`, also flip `tier='free'`. |
| `PAYMENT_REFUNDED` | `payments.status='refunded'`. If pro_subscription, set tier='free'. If prep_purchase, decrement credits (clamped ≥ 0). |

### 4.5 No PCI scope

We never see card numbers, never tokenize ourselves, never store payment instruments. Asaas owns checkout UI, retry logic, dunning emails. We just consume webhooks.

## 5. Data model

### 5.1 Migration `0009_billing.sql`

```sql
ALTER TABLE public.profiles
  ADD COLUMN asaas_customer_id TEXT UNIQUE,
  ADD COLUMN asaas_subscription_id TEXT,
  ADD COLUMN subscription_status TEXT
    CHECK (subscription_status IN
      ('active','overdue','canceled','expired','none')),
  ADD COLUMN subscription_renews_at TIMESTAMPTZ,
  ADD COLUMN prep_credits INT NOT NULL DEFAULT 0
    CHECK (prep_credits >= 0);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asaas_payment_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('pro_subscription','prep_purchase')),
  amount_cents INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN
    ('pending','confirmed','received','refunded','overdue','failed')),
  billing_method TEXT,
  paid_at TIMESTAMPTZ,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payments_user ON public.payments(user_id, created_at DESC);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own payments"
  ON public.payments FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  asaas_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  asaas_subscription_id TEXT,
  asaas_payment_id TEXT,
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sub_events_user ON public.subscription_events(user_id, received_at DESC);
CREATE INDEX idx_sub_events_type ON public.subscription_events(event_type);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
-- no SELECT policy for end users; service role / Studio only.
```

### 5.2 `subscription_status` semantics

- `none` — never subscribed (default for fresh signups)
- `active` — current period paid; tier=pro effective
- `overdue` — last invoice unpaid; tier still pro until Asaas hard-cancels
- `canceled` — user-canceled; tier flips to free at `subscription_renews_at`
- `expired` — Asaas exhausted retry policy and canceled the sub; tier=free immediately

### 5.3 `ProfileShellData` extensions

```ts
asaasCustomerId: string | null;
subscriptionStatus: 'active' | 'overdue' | 'canceled' | 'expired' | 'none';
subscriptionRenewsAt: string | null;
prepCredits: number;
```

## 6. Files & components

```
src/lib/billing/
  asaas.ts             HTTP client (fetch + Bearer); createCustomer,
                       createSubscription, createPayment, cancelSubscription,
                       getCustomer
  prices.ts            PRO_AMOUNT_CENTS=3000, PER_USE_AMOUNT_CENTS=1000
  quota.ts             checkQuota(profile, now) → QuotaCheck
  webhook.ts           verifyToken(headers), dispatch(event, payload, supabase)
  types.ts             AsaasCustomer, AsaasSubscription, AsaasPayment,
                       AsaasWebhookEvent (only fields we use)

src/app/api/billing/
  checkout/route.ts    POST { kind } → { checkoutUrl } | { error }
  cancel/route.ts      POST → { ok } | { error }

src/app/api/asaas/
  webhook/route.ts     POST → 200 | 401

src/components/billing/
  UpgradeModal.tsx          dual-CTA modal (subscribe / one-shot)
  CheckoutButton.tsx        client; calls /api/billing/checkout, redirects
  CancelSubscriptionDialog.tsx
  BillingHistoryList.tsx    server; reads from payments table
  CreditsBadge.tsx          chip "Créditos: N" — shown when N > 0
  TierPill.tsx              "Free" | "Pro" pill for the header

src/app/(app)/profile/account/
  page.tsx (modify)         show subscription card, history, cancel CTA

src/app/prep/new/
  actions.ts (modify)       quota check + side effects
  UpgradeBlocker.tsx        client; renders UpgradeModal when state.error === "quota_exceeded"

src/app/(app)/dashboard/
  page.tsx (modify)         banner "Plano Free — N preps restantes este ciclo"
```

### 6.1 `src/lib/billing/asaas.ts` skeleton

```ts
import "server-only";
import { env } from "@/lib/env";

const BASE = env.ASAAS_BASE_URL; // 'https://sandbox.asaas.com/api/v3' or 'https://api.asaas.com/v3'

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.ASAAS_API_KEY) throw new Error("ASAAS_API_KEY is not set");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "PrepaVAGA/1.0",
      access_token: env.ASAAS_API_KEY,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Asaas ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

export const asaas = {
  createCustomer: (input: { name: string; email: string; externalReference: string }) =>
    call<AsaasCustomer>("/customers", { method: "POST", body: JSON.stringify(input) }),
  createSubscription: (input: AsaasSubscriptionInput) =>
    call<AsaasSubscription>("/subscriptions", { method: "POST", body: JSON.stringify(input) }),
  createPayment: (input: AsaasPaymentInput) =>
    call<AsaasPayment>("/payments", { method: "POST", body: JSON.stringify(input) }),
  cancelSubscription: (id: string) =>
    call<{ deleted: boolean }>(`/subscriptions/${id}`, { method: "DELETE" }),
};
```

### 6.2 `MOCK_ASAAS=1` switch

When set, `asaas.ts` returns canned data and `webhook/route.ts` skips token verification. Used by Vitest + Playwright. Production must never set it. Same idea as the existing `MOCK_ANTHROPIC=1`.

## 7. API contracts

### 7.1 `POST /api/billing/checkout`

```ts
type CheckoutBody = { kind: "pro_subscription" | "prep_purchase" };
type CheckoutResponse = { checkoutUrl: string } | { error: string };
```

Server flow:
1. Auth via `supabase.auth.getUser()`. 401 if missing.
2. Read profile (id, full_name, email, asaas_customer_id, subscription_status).
3. If `kind === "pro_subscription"` and `subscription_status === "active"` → return `{ error: "Já assinante" }`. (Cancel-then-re-subscribe goes through `/cancel`.)
4. Ensure `asaas_customer_id`:
   - If null, `asaas.createCustomer({ name: full_name ?? email, email, externalReference: user.id })`.
   - Save `asaas_customer_id` to profile.
5. Branch:
   - `pro_subscription`: `asaas.createSubscription({ customer, billingType:"UNDEFINED", value:30.00, cycle:"MONTHLY", description:"PrepaVAGA Pro — assinatura mensal", externalReference:`pro:${user.id}`, callback:{ successUrl:`${APP_URL}/dashboard?billing=ok`, autoRedirect:true } })`. Save `asaas_subscription_id`. Return Asaas-provided invoice/payment link.
   - `prep_purchase`: `asaas.createPayment({ customer, billingType:"UNDEFINED", value:10.00, description:"PrepaVAGA — 1 prep avulso", externalReference:`prep:${user.id}:${nanoid()}`, dueDate: tomorrow ISO, callback:{ successUrl, autoRedirect:true } })`. Return invoice URL.
6. Return `{ checkoutUrl }` (303-equivalent; client does `window.location.href = ...`).

### 7.2 `POST /api/billing/cancel`

```ts
type CancelResponse = { ok: true } | { ok: false; error: string };
```

1. Auth.
2. Read `asaas_subscription_id`. If missing → `{ ok: false, error: "Sem assinatura ativa" }`.
3. `asaas.cancelSubscription(asaas_subscription_id)`.
4. Optimistically: `UPDATE profiles SET subscription_status='canceled' WHERE id=user.id`. Tier flip happens on webhook (or naturally when `subscription_renews_at` lapses).
5. Return `{ ok: true }`. UI revalidates `/profile/account`.

### 7.3 `POST /api/asaas/webhook`

```ts
// Header: asaas-access-token: <env.ASAAS_WEBHOOK_TOKEN>
// Body: { event: string, payment?: object, subscription?: object, ... }
```

1. Read raw header `asaas-access-token`. Constant-time compare to `env.ASAAS_WEBHOOK_TOKEN`. Mismatch → 401, log warn, no DB writes.
2. Parse body. Validate via Zod (loose — only the fields we read).
3. Idempotency: `INSERT INTO subscription_events (asaas_event_id, event_type, asaas_subscription_id, asaas_payment_id, user_id, raw_payload) VALUES (...) ON CONFLICT (asaas_event_id) DO NOTHING`. If `rowsAffected === 0` (already processed), return 200 immediately.
4. Resolve `user_id` from:
   - `payment.externalReference` (`pro:<uid>` or `prep:<uid>:<nanoid>`), OR
   - `customer.externalReference` if `payment.customer` is set, OR
   - `profiles.asaas_customer_id = payment.customer` lookup.
   If user can't be resolved → 200 + log warn (skip side effects).
5. Dispatch by `event` (see §4.4 table).
6. Always 200, even on dispatch errors (log them). Asaas retries on non-2xx; we want exactly-once via the idempotency PK.

## 8. UX surface

### 8.1 `<UpgradeModal>` — when `createPrep` returns `quota_exceeded`

```
┌────────────────────────────────────────────────┐
│ Você atingiu o limite do plano Free            │
│                                                │
│ Próximo prep grátis em ~12 dias.               │
│                                                │
│ ┌──────────────────────┐ ┌──────────────────┐  │
│ │ Assinar Pro          │ │ Comprar este    │  │
│ │ R$30/mês ilimitado   │ │ prep — R$10     │  │
│ │ [Assinar →]          │ │ [Pagar →]       │  │
│ └──────────────────────┘ └──────────────────┘  │
│                                                │
│              [Voltar pro dashboard]            │
└────────────────────────────────────────────────┘
```

Both CTAs hit `/api/billing/checkout` and redirect.

### 8.2 `/profile/account` (Conta tab)

Replaces the disabled "Gerenciar assinatura" button with:

- **Plano** card now shows real status:
  - `Free`: "Plano Free — próximo prep em N dias" + "Assinar Pro" CTA
  - `Pro active`: "Plano Pro — renova em DD/MM" + "Cancelar assinatura" + "Trocar cartão" (link to Asaas customer area, see §8.3)
  - `Pro canceled`: "Cancelado — acesso até DD/MM" + "Reativar"
  - `Pro overdue`: "Pagamento em atraso — atualize seu cartão" + retry link
- **Créditos avulsos** chip if `prep_credits > 0`: "Você tem N preps avulsos"
- **Histórico de pagamentos** list (newest first) — date, kind, amount, status

### 8.3 Customer area for card management

Asaas hosts a per-customer area at `https://www.asaas.com/customer/<id>` (or similar). The "Trocar cartão" link uses this URL with the user's customer id. We don't build our own.

### 8.4 Dashboard banner (free tier)

When `subscription_status !== 'active'`:

```
┌─────────────────────────────────────────────────────┐
│ ⚡ Plano Free — N prep(s) restante(s) este ciclo.    │
│                                       [Assinar Pro] │
└─────────────────────────────────────────────────────┘
```

Hidden once `tier='pro'`. Doesn't shift the layout (fixed height, predictable).

## 9. Error handling

| Failure | Behavior |
|---|---|
| Asaas API down on checkout | 503 to client, message "Tente novamente em instantes" |
| Asaas API down on cancel | Same; user can retry |
| Webhook token mismatch | 401, log warn, no DB writes |
| Webhook idempotency conflict | 200 (already processed) |
| Webhook payload schema mismatch | 200 + log error (do not retry — payload is garbage) |
| Webhook resolver can't find user | 200 + log warn (orphan event; no side effects) |
| Race: 2 concurrent "Assinar" clicks | Asaas dedupes via `externalReference="pro:userId"`; second create returns existing |
| User cancels mid-flight (closes Asaas page) | Subscription not created → no webhook. User can retry; idempotent. |
| Refund | webhook flips tier=free / decrements credits. If clamped at 0 (already used), accept the loss; do not delete completed preps. |
| Subscription expired during prep generation | Generation continues (we already started). Quota was consumed atomically before generation kicked off. |

## 10. Rollout plan

1. Migration `0009_billing.sql` applied on Supabase.
2. Sandbox account created at Asaas (test mode). Note API key + webhook token.
3. Add env vars to Railway: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3`.
4. Configure Asaas webhook target → `https://app/api/asaas/webhook`, all events on.
5. Implement Asaas client + types + tests (Tasks 1-3 of plan).
6. Implement webhook receiver + dispatch + tests (Tasks 4-5).
7. Implement quota check + `createPrep` integration + UpgradeModal (Tasks 6-7).
8. Implement checkout / cancel routes (Tasks 8-9).
9. Wire UI: AccountSection rewrite, dashboard banner, BillingHistoryList (Tasks 10-12).
10. End-to-end smoke in sandbox: full Pro subscription cycle, full Per-use cycle, cancel cycle, overdue cycle.
11. Switch `ASAAS_BASE_URL` to production + replace API key + webhook token.

## 11. Testing

Unit + component + route integration. No real Asaas calls in CI (`MOCK_ASAAS=1`).

- `quota.test.ts` — matrix of profile states × `now`.
- `webhook.test.ts` — token verify, idempotency, dispatch, payload schema.
- `asaas.test.ts` — request shape via mocked `fetch`.
- `UpgradeModal.test.tsx` — both CTAs, dismiss behaviors.
- `CancelSubscriptionDialog.test.tsx` — disabled until "CANCELAR" typed.
- `route.checkout.test.ts` — happy path + 401 + Asaas down.
- `route.webhook.test.ts` — full event matrix; verifies DB writes.
- `createPrep` quota — pro / free-quota / free-credit / blocked.

E2E (Playwright, manual smoke):
- Sandbox checkout: subscribe Pro → tier changes → cancel → tier reverts.
- Sandbox per-use: pay → credit appears → consume on next prep.

Out of scope: real-money tests, real Pix flow, real refund flow.

## 12. Known edges / decisions deferred

- **Annual plan discount** — not in MVP.
- **Team / multi-seat** — not in MVP.
- **Dunning emails** — Asaas sends them; we don't add app-level reminders.
- **Receipt UI per payment** — list is enough; PDF receipt deferred.
- **Upgrade from Per-use to Pro** — user pays for a Per-use, decides to subscribe; no automatic credit transfer. Documented in copy.
- **Refund from app** — not exposed to users; do via Asaas dashboard. Webhook handles state automatically.
- **Currency conversions** — none. BRL only.

## 13. Risks / things to watch

- **Webhook signature**: Asaas uses a static `asaas-access-token` header (constant per webhook config). It's a bearer token, not HMAC. We trust transport security (HTTPS). Document that the token must be regenerated if leaked.
- **Idempotency hinges on `asaas_event_id`**: Asaas docs claim this is unique per delivery attempt; we rely on the unique index. Verify with sandbox before going live.
- **`subscription_status='overdue'`**: tier stays Pro during dunning to avoid churning paying users on a transient card decline. Asaas eventually moves to canceled; we follow.
- **Rolling 30-day quota** is computed per-request on read, not via cron. Acceptable load (one timestamp comparison per `createPrep`).
- **`MOCK_ASAAS=1`** must never leak to production. Add a runtime guard that throws if the env is set when `NODE_ENV === 'production'`.
