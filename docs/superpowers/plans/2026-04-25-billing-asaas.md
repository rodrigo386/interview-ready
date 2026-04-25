# Billing & Paywall (Asaas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the freemium paywall (Free 1/30d · Pro R$30/mês · Per-use R$10) via the Brazilian Asaas gateway, with hosted checkout, idempotent webhook processing, and a hard-block dual-CTA upgrade modal at `createPrep`.

**Architecture:** Billing state lives on `profiles` (asaas_customer_id, subscription_status, prep_credits) plus two new tables (`payments`, `subscription_events`). Asaas hosted checkout owns PCI scope. Webhook receiver verifies a static bearer token, dedupes by `asaas_event_id` unique index, and dispatches by event type. `createPrep` runs `checkQuota(profile, now)` before kicking off the pipeline; on `quota_exceeded` returns an error that the client renders as `<UpgradeModal>` with two CTAs (subscribe / one-shot).

**Tech Stack:** Next.js 15.5 (App Router, server actions, route handlers), TypeScript strict, Supabase (Postgres + RLS), Vitest (`environment: "node"` default, jsdom for components), `@testing-library/react`, Zod for payload validation. No Asaas SDK — direct `fetch` to their REST API.

**Spec:** `docs/superpowers/specs/2026-04-25-billing-asaas-design.md`

---

## File Structure

```
supabase/migrations/
  0009_billing.sql                    ← migration (profiles cols + 2 new tables)

src/lib/billing/
  types.ts                            ← Asaas + internal billing types
  prices.ts                           ← PRO_AMOUNT_CENTS, PER_USE_AMOUNT_CENTS, helpers
  asaas.ts                            ← HTTP client (server-only)
  quota.ts                            ← checkQuota(profile, now)
  webhook.ts                          ← verifyToken + dispatch
  ids.ts                              ← parseExternalReference("pro:uid"|"prep:uid:nano")
  *.test.ts                           ← unit tests

src/app/api/billing/
  checkout/route.ts                   ← POST { kind } → { checkoutUrl }
  cancel/route.ts                     ← POST → { ok }

src/app/api/asaas/
  webhook/route.ts                    ← POST → 200 | 401

src/components/billing/
  UpgradeModal.tsx                    ← dual-CTA modal (subscribe / one-shot)
  CheckoutButton.tsx                  ← client; hits /api/billing/checkout
  CancelSubscriptionDialog.tsx
  BillingHistoryList.tsx              ← server; reads payments table
  CreditsBadge.tsx                    ← chip "Créditos: N"
  TierPill.tsx                        ← "Free" | "Pro" pill
  PlanCard.tsx                        ← composite for AccountSection
  *.test.tsx

src/lib/env.ts                        ← add ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, ASAAS_BASE_URL
src/lib/profile/types.ts              ← extend ProfileShellData with billing fields
src/app/(app)/profile/layout.tsx      ← read new profile cols, hydrate ProfileShellData
src/app/(app)/profile/account/page.tsx ← (no change — AccountSection swaps in)
src/components/profile/AccountSection.tsx ← rewrite Plano section to use PlanCard

src/app/prep/new/actions.ts           ← add quota check + side effects in createPrep
src/components/prep/UpgradeBlocker.tsx ← client wrapper that shows modal on error

src/app/(app)/dashboard/page.tsx      ← free-tier banner
src/components/billing/FreeTierBanner.tsx
```

---

## Task 1: Migration `0009_billing.sql`

**Files:**
- Create: `supabase/migrations/0009_billing.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 0009_billing.sql
-- Asaas billing state: customer/subscription columns on profiles,
-- payments table (one row per processed Asaas payment),
-- subscription_events table (audit log + idempotency keys).

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
-- no SELECT policy: service role / Studio only.
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` on project `reslmtzofwczxrswulca`. Or have the user paste it into the SQL editor manually. Do not run `supabase db push` from the implementer — that's the orchestrator's job after the user confirms env vars are ready.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_billing.sql
git commit -m "feat(db): billing schema — profiles cols + payments + subscription_events"
```

---

## Task 2: Env vars + sandbox setup notes

**Files:**
- Modify: `src/lib/env.ts`

- [ ] **Step 1: Add env vars to schema**

Open `src/lib/env.ts`. Inside the `z.object({...})` literal, after `GOOGLE_API_KEY`, add:

```ts
  ASAAS_API_KEY: z
    .union([z.string().min(1), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  ASAAS_WEBHOOK_TOKEN: z
    .union([z.string().min(1), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  ASAAS_BASE_URL: z
    .string()
    .url()
    .default("https://sandbox.asaas.com/api/v3"),
```

Then in the `parseOrThrow()` body, add to the input object:

```ts
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN,
    ASAAS_BASE_URL: process.env.ASAAS_BASE_URL,
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/env.ts
git commit -m "feat(env): add ASAAS_API_KEY + ASAAS_WEBHOOK_TOKEN + ASAAS_BASE_URL"
```

---

## Task 3: `prices.ts` + `ids.ts` (TDD pure helpers)

**Files:**
- Create: `src/lib/billing/prices.ts`
- Create: `src/lib/billing/ids.ts`
- Test: `src/lib/billing/ids.test.ts`

- [ ] **Step 1: Write prices.ts**

```ts
// src/lib/billing/prices.ts
export const PRO_AMOUNT_CENTS = 3000;       // R$30.00
export const PER_USE_AMOUNT_CENTS = 1000;   // R$10.00

export function centsToBrl(cents: number): number {
  return Math.round(cents) / 100;
}

export function brlLabel(cents: number): string {
  const brl = centsToBrl(cents);
  return brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
```

- [ ] **Step 2: Write the failing test for ids.ts**

```ts
// src/lib/billing/ids.test.ts
import { describe, expect, it } from "vitest";
import { buildExternalReference, parseExternalReference } from "./ids";

describe("externalReference", () => {
  it("builds pro reference from user id", () => {
    expect(buildExternalReference({ kind: "pro_subscription", userId: "u1" }))
      .toBe("pro:u1");
  });

  it("builds per-use reference with nanoid suffix", () => {
    const ref = buildExternalReference({ kind: "prep_purchase", userId: "u1", nano: "abc123" });
    expect(ref).toBe("prep:u1:abc123");
  });

  it("parses pro reference", () => {
    expect(parseExternalReference("pro:u1")).toEqual({
      kind: "pro_subscription",
      userId: "u1",
    });
  });

  it("parses prep reference", () => {
    expect(parseExternalReference("prep:u1:abc")).toEqual({
      kind: "prep_purchase",
      userId: "u1",
      nano: "abc",
    });
  });

  it("returns null on garbage", () => {
    expect(parseExternalReference("garbage")).toBeNull();
    expect(parseExternalReference("")).toBeNull();
    expect(parseExternalReference(null)).toBeNull();
    expect(parseExternalReference("foo:bar")).toBeNull();
  });
});
```

- [ ] **Step 3: Run, verify fail**

```bash
pnpm test src/lib/billing/ids.test.ts
```

- [ ] **Step 4: Implement**

```ts
// src/lib/billing/ids.ts
export type ExternalReference =
  | { kind: "pro_subscription"; userId: string }
  | { kind: "prep_purchase"; userId: string; nano: string };

export function buildExternalReference(input: ExternalReference): string {
  if (input.kind === "pro_subscription") return `pro:${input.userId}`;
  return `prep:${input.userId}:${input.nano}`;
}

export function parseExternalReference(raw: string | null | undefined): ExternalReference | null {
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts[0] === "pro" && parts.length === 2 && parts[1]) {
    return { kind: "pro_subscription", userId: parts[1] };
  }
  if (parts[0] === "prep" && parts.length === 3 && parts[1] && parts[2]) {
    return { kind: "prep_purchase", userId: parts[1], nano: parts[2] };
  }
  return null;
}
```

- [ ] **Step 5: Run, verify pass, commit**

```bash
pnpm test src/lib/billing/ids.test.ts
git add src/lib/billing/prices.ts src/lib/billing/ids.ts src/lib/billing/ids.test.ts
git commit -m "feat(billing): add prices + externalReference helpers"
```

---

## Task 4: `quota.ts` (TDD)

**Files:**
- Create: `src/lib/billing/quota.ts`
- Test: `src/lib/billing/quota.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/billing/quota.test.ts
import { describe, expect, it } from "vitest";
import { checkQuota, type ProfileBilling } from "./quota";

const NOW = new Date("2026-04-25T12:00:00Z");

function profile(overrides: Partial<ProfileBilling> = {}): ProfileBilling {
  return {
    subscription_status: "none",
    preps_used_this_month: 0,
    preps_reset_at: "2026-04-01T00:00:00Z",
    prep_credits: 0,
    ...overrides,
  };
}

describe("checkQuota", () => {
  it("pro active is always allowed", () => {
    const res = checkQuota(profile({ subscription_status: "active", preps_used_this_month: 999 }), NOW);
    expect(res).toEqual({ allowed: true, mode: "pro" });
  });

  it("pro overdue still allowed (dunning grace)", () => {
    const res = checkQuota(profile({ subscription_status: "overdue" }), NOW);
    expect(res).toEqual({ allowed: true, mode: "pro" });
  });

  it("free with 0 used is allowed", () => {
    const res = checkQuota(profile({ preps_used_this_month: 0 }), NOW);
    expect(res).toEqual({ allowed: true, mode: "free" });
  });

  it("free with 1 used and no credits is blocked", () => {
    const res = checkQuota(profile({ preps_used_this_month: 1 }), NOW);
    expect(res).toEqual({ allowed: false, mode: "block" });
  });

  it("free with credits is allowed via credit", () => {
    const res = checkQuota(profile({ preps_used_this_month: 1, prep_credits: 2 }), NOW);
    expect(res).toEqual({ allowed: true, mode: "credit" });
  });

  it("preps_reset_at older than 30 days unlocks reset mode", () => {
    const res = checkQuota(
      profile({ preps_used_this_month: 5, preps_reset_at: "2026-03-01T00:00:00Z" }),
      NOW,
    );
    expect(res).toEqual({ allowed: true, mode: "reset" });
  });

  it("canceled status with usage is blocked", () => {
    const res = checkQuota(
      profile({ subscription_status: "canceled", preps_used_this_month: 1 }),
      NOW,
    );
    expect(res).toEqual({ allowed: false, mode: "block" });
  });

  it("expired status with usage is blocked", () => {
    const res = checkQuota(
      profile({ subscription_status: "expired", preps_used_this_month: 1 }),
      NOW,
    );
    expect(res).toEqual({ allowed: false, mode: "block" });
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
pnpm test src/lib/billing/quota.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/billing/quota.ts
const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

export type ProfileBilling = {
  subscription_status: "active" | "overdue" | "canceled" | "expired" | "none" | null;
  preps_used_this_month: number;
  preps_reset_at: string;
  prep_credits: number;
};

export type QuotaCheck =
  | { allowed: true; mode: "pro" | "free" | "credit" | "reset" }
  | { allowed: false; mode: "block" };

export function checkQuota(p: ProfileBilling, now: Date): QuotaCheck {
  if (p.subscription_status === "active" || p.subscription_status === "overdue") {
    return { allowed: true, mode: "pro" };
  }
  const elapsed = now.getTime() - new Date(p.preps_reset_at).getTime();
  if (elapsed > MS_30_DAYS) {
    return { allowed: true, mode: "reset" };
  }
  if (p.preps_used_this_month < 1) {
    return { allowed: true, mode: "free" };
  }
  if (p.prep_credits > 0) {
    return { allowed: true, mode: "credit" };
  }
  return { allowed: false, mode: "block" };
}
```

- [ ] **Step 4: Run, verify pass, commit**

```bash
pnpm test src/lib/billing/quota.test.ts
git add src/lib/billing/quota.ts src/lib/billing/quota.test.ts
git commit -m "feat(billing): add checkQuota helper"
```

---

## Task 5: `types.ts` for Asaas

**Files:**
- Create: `src/lib/billing/types.ts`

- [ ] **Step 1: Write types**

```ts
// src/lib/billing/types.ts
// Only the fields we read. Asaas returns more — we don't care.

export type AsaasCustomer = {
  id: string;
  name: string;
  email: string;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  value: number;
  cycle: string;
  status: string;
  nextDueDate?: string;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string;
  value: number;
  status: string;
  billingType: string;
  externalReference?: string | null;
  paymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  paymentLink?: string;
  nextDueDate?: string;
};

export type AsaasWebhookEvent = {
  event: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
};

export type CreateCustomerInput = {
  name: string;
  email: string;
  externalReference: string;
};

export type CreateSubscriptionInput = {
  customer: string;
  billingType: "UNDEFINED" | "PIX" | "CREDIT_CARD" | "BOLETO";
  value: number;
  cycle: "MONTHLY" | "YEARLY";
  nextDueDate: string;
  description: string;
  externalReference: string;
  callback?: { successUrl: string; autoRedirect?: boolean };
};

export type CreatePaymentInput = {
  customer: string;
  billingType: "UNDEFINED" | "PIX" | "CREDIT_CARD" | "BOLETO";
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
  callback?: { successUrl: string; autoRedirect?: boolean };
};
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add src/lib/billing/types.ts
git commit -m "feat(billing): add Asaas + internal types"
```

---

## Task 6: `asaas.ts` HTTP client (TDD)

**Files:**
- Create: `src/lib/billing/asaas.ts`
- Test: `src/lib/billing/asaas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/billing/asaas.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const stubFetch = vi.fn();

beforeEach(() => {
  vi.stubEnv("ASAAS_API_KEY", "test-key");
  vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "test-token");
  vi.stubEnv("ASAAS_BASE_URL", "https://sandbox.asaas.com/api/v3");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  globalThis.fetch = stubFetch as unknown as typeof fetch;
  stubFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function fetchOk(json: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(json),
    text: () => Promise.resolve(JSON.stringify(json)),
  } as unknown as Response);
}

describe("asaas client", () => {
  it("createCustomer posts to /customers with access_token header", async () => {
    stubFetch.mockReturnValueOnce(fetchOk({ id: "cus_1", name: "X", email: "x@y.com" }));
    const { asaas } = await import("./asaas");
    const result = await asaas.createCustomer({
      name: "X",
      email: "x@y.com",
      externalReference: "u1",
    });
    expect(result.id).toBe("cus_1");
    const [url, init] = stubFetch.mock.calls[0];
    expect(url).toBe("https://sandbox.asaas.com/api/v3/customers");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({ access_token: "test-key" });
    const body = JSON.parse(((init as RequestInit).body as string) ?? "");
    expect(body).toEqual({ name: "X", email: "x@y.com", externalReference: "u1" });
  });

  it("createSubscription posts to /subscriptions", async () => {
    stubFetch.mockReturnValueOnce(fetchOk({ id: "sub_1", customer: "cus_1", value: 30, cycle: "MONTHLY", status: "ACTIVE" }));
    const { asaas } = await import("./asaas");
    await asaas.createSubscription({
      customer: "cus_1",
      billingType: "UNDEFINED",
      value: 30,
      cycle: "MONTHLY",
      nextDueDate: "2026-05-01",
      description: "x",
      externalReference: "pro:u1",
    });
    expect(stubFetch).toHaveBeenCalledTimes(1);
    const [url] = stubFetch.mock.calls[0];
    expect(url).toBe("https://sandbox.asaas.com/api/v3/subscriptions");
  });

  it("cancelSubscription deletes /subscriptions/:id", async () => {
    stubFetch.mockReturnValueOnce(fetchOk({ deleted: true }));
    const { asaas } = await import("./asaas");
    await asaas.cancelSubscription("sub_1");
    const [url, init] = stubFetch.mock.calls[0];
    expect(url).toBe("https://sandbox.asaas.com/api/v3/subscriptions/sub_1");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws on non-2xx with response body in message", async () => {
    stubFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 422,
        text: () => Promise.resolve('{"errors":[{"code":"invalid_email"}]}'),
        json: () => Promise.resolve({}),
      } as unknown as Response),
    );
    const { asaas } = await import("./asaas");
    await expect(
      asaas.createCustomer({ name: "X", email: "bad", externalReference: "u1" }),
    ).rejects.toThrow(/422/);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
pnpm test src/lib/billing/asaas.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/billing/asaas.ts
import "server-only";
import { env } from "@/lib/env";
import type {
  AsaasCustomer,
  AsaasPayment,
  AsaasSubscription,
  CreateCustomerInput,
  CreatePaymentInput,
  CreateSubscriptionInput,
} from "./types";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.ASAAS_API_KEY) {
    throw new Error("ASAAS_API_KEY is not set");
  }
  const res = await fetch(`${env.ASAAS_BASE_URL}${path}`, {
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
  return res.json() as Promise<T>;
}

export const asaas = {
  createCustomer: (input: CreateCustomerInput) =>
    call<AsaasCustomer>("/customers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createSubscription: (input: CreateSubscriptionInput) =>
    call<AsaasSubscription>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createPayment: (input: CreatePaymentInput) =>
    call<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancelSubscription: (id: string) =>
    call<{ deleted: boolean; id: string }>(`/subscriptions/${id}`, {
      method: "DELETE",
    }),
  getPayment: (id: string) => call<AsaasPayment>(`/payments/${id}`),
};
```

- [ ] **Step 4: Run, verify pass, commit**

```bash
pnpm test src/lib/billing/asaas.test.ts
git add src/lib/billing/asaas.ts src/lib/billing/asaas.test.ts
git commit -m "feat(billing): add Asaas REST client"
```

---

## Task 7: `webhook.ts` (TDD)

**Files:**
- Create: `src/lib/billing/webhook.ts`
- Test: `src/lib/billing/webhook.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/billing/webhook.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { verifyToken } from "./webhook";

beforeEach(() => {
  vi.stubEnv("ASAAS_API_KEY", "k");
  vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "expected-token");
  vi.stubEnv("ASAAS_BASE_URL", "https://sandbox.asaas.com/api/v3");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});

describe("verifyToken", () => {
  it("returns true on exact match", () => {
    expect(verifyToken("expected-token")).toBe(true);
  });
  it("returns false on mismatch", () => {
    expect(verifyToken("wrong")).toBe(false);
  });
  it("returns false on empty", () => {
    expect(verifyToken("")).toBe(false);
    expect(verifyToken(null)).toBe(false);
    expect(verifyToken(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
pnpm test src/lib/billing/webhook.test.ts
```

- [ ] **Step 3: Implement webhook.ts (verifyToken first)**

```ts
// src/lib/billing/webhook.ts
import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function verifyToken(provided: string | null | undefined): boolean {
  if (!provided) return false;
  if (!env.ASAAS_WEBHOOK_TOKEN) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(env.ASAAS_WEBHOOK_TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm test src/lib/billing/webhook.test.ts
```

- [ ] **Step 5: Add dispatcher tests**

Append to `webhook.test.ts`:

```ts
import { dispatchEvent } from "./webhook";
import type { AsaasWebhookEvent } from "./types";

type DbCalls = {
  insertEvent: { sql: string; args: unknown[] }[];
  updateProfile: { sql: string; args: unknown[] }[];
  upsertPayment: { sql: string; args: unknown[] }[];
};

function fakeSupabase(opts: { eventInsertConflict?: boolean } = {}) {
  const calls: DbCalls = { insertEvent: [], updateProfile: [], upsertPayment: [] };
  const supa = {
    from: (table: string) => ({
      insert: (row: unknown) => ({
        select: () => ({
          single: async () => {
            if (table === "subscription_events") {
              calls.insertEvent.push({ sql: "insert", args: [row] });
              if (opts.eventInsertConflict) {
                return { data: null, error: { code: "23505" } };
              }
              return { data: row, error: null };
            }
            return { data: row, error: null };
          },
        }),
        async then() {},
      }),
      upsert: (row: unknown) => ({
        async then() {
          calls.upsertPayment.push({ sql: "upsert", args: [row] });
        },
      }),
      update: (patch: unknown) => ({
        eq: (_col: string, _val: unknown) => ({
          async then() {
            calls.updateProfile.push({ sql: "update", args: [patch] });
          },
        }),
      }),
      select: () => ({
        eq: (_col: string, _val: unknown) => ({
          single: async () => ({ data: { id: "u1" }, error: null }),
        }),
      }),
    }),
  };
  return { supa, calls };
}

describe("dispatchEvent", () => {
  it("idempotency: returns 'duplicate' on event_id conflict", async () => {
    const { supa } = fakeSupabase({ eventInsertConflict: true });
    const evt: AsaasWebhookEvent = {
      event: "PAYMENT_RECEIVED",
      payment: { id: "p1", customer: "c1", value: 30, status: "RECEIVED",
        billingType: "PIX", externalReference: "pro:u1" },
    };
    const result = await dispatchEvent(evt, "evt_1", supa as never);
    expect(result.handled).toBe(false);
    expect(result.reason).toBe("duplicate");
  });

  it("PAYMENT_RECEIVED with pro:uid sets tier=pro + writes payment", async () => {
    const { supa, calls } = fakeSupabase();
    const evt: AsaasWebhookEvent = {
      event: "PAYMENT_RECEIVED",
      payment: { id: "p1", customer: "c1", value: 30, status: "RECEIVED",
        billingType: "PIX", externalReference: "pro:u1", nextDueDate: "2026-05-25" },
    };
    const result = await dispatchEvent(evt, "evt_2", supa as never);
    expect(result.handled).toBe(true);
    expect(calls.upsertPayment.length).toBe(1);
    expect(calls.updateProfile.length).toBe(1);
    const patch = calls.updateProfile[0].args[0] as Record<string, unknown>;
    expect(patch.tier).toBe("pro");
    expect(patch.subscription_status).toBe("active");
  });

  it("PAYMENT_RECEIVED with prep:uid:nano increments credits", async () => {
    const { supa, calls } = fakeSupabase();
    const evt: AsaasWebhookEvent = {
      event: "PAYMENT_RECEIVED",
      payment: { id: "p2", customer: "c1", value: 10, status: "RECEIVED",
        billingType: "PIX", externalReference: "prep:u1:n1" },
    };
    const result = await dispatchEvent(evt, "evt_3", supa as never);
    expect(result.handled).toBe(true);
    const patch = calls.updateProfile[0].args[0] as Record<string, unknown>;
    expect(patch).toHaveProperty("prep_credits");
  });

  it("unknown event returns handled=false reason='unhandled'", async () => {
    const { supa } = fakeSupabase();
    const evt = { event: "SOMETHING_NEW" } as AsaasWebhookEvent;
    const result = await dispatchEvent(evt, "evt_4", supa as never);
    expect(result).toEqual({ handled: false, reason: "unhandled" });
  });
});
```

- [ ] **Step 6: Run, verify fail (dispatcher not implemented)**

```bash
pnpm test src/lib/billing/webhook.test.ts
```

- [ ] **Step 7: Implement dispatcher**

Append to `src/lib/billing/webhook.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AsaasWebhookEvent } from "./types";
import { parseExternalReference } from "./ids";

export type DispatchResult =
  | { handled: true; userId: string }
  | { handled: false; reason: "duplicate" | "no_user" | "unhandled" | "error"; detail?: string };

export async function dispatchEvent(
  evt: AsaasWebhookEvent,
  asaasEventId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  // 1. Resolve user.
  const ref = parseExternalReference(evt.payment?.externalReference);
  let userId: string | null = ref?.userId ?? null;
  if (!userId && evt.payment?.customer) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("asaas_customer_id", evt.payment.customer)
      .single();
    userId = (data as { id: string } | null)?.id ?? null;
  }

  // 2. Insert into subscription_events for idempotency.
  const eventRow = {
    user_id: userId,
    asaas_event_id: asaasEventId,
    event_type: evt.event,
    asaas_subscription_id: evt.subscription?.id ?? evt.payment?.subscription ?? null,
    asaas_payment_id: evt.payment?.id ?? null,
    raw_payload: evt as unknown,
  };
  const insertRes = await supabase
    .from("subscription_events")
    .insert(eventRow)
    .select()
    .single();
  if (insertRes.error) {
    if (insertRes.error.code === "23505") {
      return { handled: false, reason: "duplicate" };
    }
    return { handled: false, reason: "error", detail: insertRes.error.message };
  }

  if (!userId) {
    return { handled: false, reason: "no_user" };
  }

  // 3. Dispatch by event.
  switch (evt.event) {
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED":
      return handlePaymentReceived(evt, userId, supabase);
    case "PAYMENT_OVERDUE":
      return handlePaymentOverdue(evt, userId, supabase);
    case "PAYMENT_REFUNDED":
      return handlePaymentRefunded(evt, userId, supabase);
    case "SUBSCRIPTION_DELETED":
      return handleSubscriptionDeleted(evt, userId, supabase);
    case "PAYMENT_CREATED":
    case "SUBSCRIPTION_CREATED":
    case "SUBSCRIPTION_UPDATED":
      // Already saved at checkout time or covered by PAYMENT_RECEIVED.
      return { handled: true, userId };
    default:
      return { handled: false, reason: "unhandled" };
  }
}

async function handlePaymentReceived(
  evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  const p = evt.payment!;
  const ref = parseExternalReference(p.externalReference);
  const kind = ref?.kind ?? "pro_subscription";
  const cents = Math.round(p.value * 100);

  await supabase.from("payments").upsert(
    {
      user_id: userId,
      asaas_payment_id: p.id,
      kind,
      amount_cents: cents,
      status: "received",
      billing_method: p.billingType,
      paid_at: p.paymentDate ?? new Date().toISOString(),
      raw_payload: p as unknown,
    },
    { onConflict: "asaas_payment_id" },
  );

  if (kind === "pro_subscription") {
    await supabase
      .from("profiles")
      .update({
        tier: "pro",
        subscription_status: "active",
        subscription_renews_at: p.nextDueDate ?? null,
      })
      .eq("id", userId);
  } else {
    const { data: prof } = await supabase
      .from("profiles")
      .select("prep_credits")
      .eq("id", userId)
      .single();
    const credits = ((prof as { prep_credits?: number } | null)?.prep_credits ?? 0) + 1;
    await supabase
      .from("profiles")
      .update({ prep_credits: credits })
      .eq("id", userId);
  }
  return { handled: true, userId };
}

async function handlePaymentOverdue(
  evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  await supabase
    .from("payments")
    .upsert(
      {
        user_id: userId,
        asaas_payment_id: evt.payment!.id,
        kind: parseExternalReference(evt.payment!.externalReference)?.kind ?? "pro_subscription",
        amount_cents: Math.round(evt.payment!.value * 100),
        status: "overdue",
        billing_method: evt.payment!.billingType,
        raw_payload: evt.payment as unknown,
      },
      { onConflict: "asaas_payment_id" },
    );
  await supabase
    .from("profiles")
    .update({ subscription_status: "overdue" })
    .eq("id", userId);
  return { handled: true, userId };
}

async function handlePaymentRefunded(
  evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  const ref = parseExternalReference(evt.payment!.externalReference);
  await supabase
    .from("payments")
    .update({ status: "refunded" })
    .eq("asaas_payment_id", evt.payment!.id);
  if (ref?.kind === "pro_subscription") {
    await supabase
      .from("profiles")
      .update({ tier: "free", subscription_status: "expired" })
      .eq("id", userId);
  } else if (ref?.kind === "prep_purchase") {
    const { data: prof } = await supabase
      .from("profiles")
      .select("prep_credits")
      .eq("id", userId)
      .single();
    const credits = Math.max(0, ((prof as { prep_credits?: number } | null)?.prep_credits ?? 0) - 1);
    await supabase
      .from("profiles")
      .update({ prep_credits: credits })
      .eq("id", userId);
  }
  return { handled: true, userId };
}

async function handleSubscriptionDeleted(
  _evt: AsaasWebhookEvent,
  userId: string,
  supabase: SupabaseClient,
): Promise<DispatchResult> {
  // tier flips to free at next read if subscription_renews_at < now.
  // We mark canceled now; the read-side guard in checkQuota plus dashboard banner
  // both treat 'canceled' equivalently to 'none' for enforcement.
  await supabase
    .from("profiles")
    .update({ subscription_status: "canceled", tier: "free" })
    .eq("id", userId);
  return { handled: true, userId };
}
```

- [ ] **Step 8: Run, verify pass, commit**

```bash
pnpm test src/lib/billing/webhook.test.ts
git add src/lib/billing/webhook.ts src/lib/billing/webhook.test.ts
git commit -m "feat(billing): add webhook verifyToken + dispatchEvent"
```

---

## Task 8: `/api/asaas/webhook/route.ts`

**Files:**
- Create: `src/app/api/asaas/webhook/route.ts`

- [ ] **Step 1: Implement route**

```ts
// src/app/api/asaas/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { verifyToken, dispatchEvent } from "@/lib/billing/webhook";
import type { AsaasWebhookEvent } from "@/lib/billing/types";

function adminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSbClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  const token = req.headers.get("asaas-access-token");
  if (!verifyToken(token)) {
    console.warn("[asaas/webhook] token mismatch");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: AsaasWebhookEvent;
  try {
    body = (await req.json()) as AsaasWebhookEvent;
  } catch (err) {
    console.warn("[asaas/webhook] invalid JSON:", err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Asaas sends `id` per delivery; some payload variants use payment.id as the
  // unique key. Combine to stay safe across event types.
  const asaasEventId =
    (body as unknown as { id?: string }).id ??
    `${body.event}:${body.payment?.id ?? body.subscription?.id ?? Date.now()}`;

  try {
    const supabase = adminClient();
    const result = await dispatchEvent(body, asaasEventId, supabase);
    if (!result.handled && result.reason !== "duplicate") {
      console.warn(`[asaas/webhook] not handled: ${result.reason}`, body.event);
    }
  } catch (err) {
    console.error("[asaas/webhook] dispatch error:", err);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck

git add "src/app/api/asaas/webhook/route.ts"
git commit -m "feat(api): asaas webhook route handler"
```

---

## Task 9: `/api/billing/checkout/route.ts`

**Files:**
- Create: `src/app/api/billing/checkout/route.ts`

- [ ] **Step 1: Implement route**

```ts
// src/app/api/billing/checkout/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { asaas } from "@/lib/billing/asaas";
import { buildExternalReference } from "@/lib/billing/ids";
import { PRO_AMOUNT_CENTS, PER_USE_AMOUNT_CENTS } from "@/lib/billing/prices";
import { env } from "@/lib/env";

const bodySchema = z.object({
  kind: z.enum(["pro_subscription", "prep_purchase"]),
});

function tomorrowIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nano(): string {
  return Math.random().toString(36).slice(2, 10);
}

function appUrl(): string {
  return env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !auth.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, asaas_customer_id, asaas_subscription_id, subscription_status")
    .eq("id", auth.user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile missing" }, { status: 500 });
  }

  if (
    parsed.kind === "pro_subscription" &&
    (profile.subscription_status === "active" || profile.subscription_status === "overdue")
  ) {
    return NextResponse.json({ error: "Já assinante" }, { status: 409 });
  }

  // Ensure customer.
  let customerId = profile.asaas_customer_id;
  if (!customerId) {
    const cust = await asaas.createCustomer({
      name: profile.full_name ?? profile.email,
      email: profile.email,
      externalReference: profile.id,
    });
    customerId = cust.id;
    await supabase
      .from("profiles")
      .update({ asaas_customer_id: customerId })
      .eq("id", profile.id);
  }

  const successUrl = `${appUrl()}/dashboard?billing=ok`;

  if (parsed.kind === "pro_subscription") {
    const sub = await asaas.createSubscription({
      customer: customerId,
      billingType: "UNDEFINED",
      value: PRO_AMOUNT_CENTS / 100,
      cycle: "MONTHLY",
      nextDueDate: tomorrowIso(),
      description: "PrepaVAGA Pro — assinatura mensal",
      externalReference: buildExternalReference({
        kind: "pro_subscription",
        userId: profile.id,
      }),
      callback: { successUrl, autoRedirect: true },
    });
    await supabase
      .from("profiles")
      .update({ asaas_subscription_id: sub.id })
      .eq("id", profile.id);

    // Asaas creates the first invoice automatically; fetch the payment to get
    // the hosted link. The subscription response itself does not include it.
    const { data: firstPayment } = await fetchFirstPayment(sub.id);
    const checkoutUrl = firstPayment?.invoiceUrl ?? firstPayment?.bankSlipUrl;
    if (!checkoutUrl) {
      return NextResponse.json({ error: "Asaas não retornou link de cobrança" }, { status: 502 });
    }
    return NextResponse.json({ checkoutUrl });
  }

  // prep_purchase
  const pay = await asaas.createPayment({
    customer: customerId,
    billingType: "UNDEFINED",
    value: PER_USE_AMOUNT_CENTS / 100,
    dueDate: tomorrowIso(),
    description: "PrepaVAGA — 1 prep avulso",
    externalReference: buildExternalReference({
      kind: "prep_purchase",
      userId: profile.id,
      nano: nano(),
    }),
    callback: { successUrl, autoRedirect: true },
  });
  const checkoutUrl = pay.invoiceUrl ?? pay.bankSlipUrl;
  if (!checkoutUrl) {
    return NextResponse.json({ error: "Asaas não retornou link de cobrança" }, { status: 502 });
  }
  return NextResponse.json({ checkoutUrl });
}

async function fetchFirstPayment(subscriptionId: string) {
  // Asaas exposes /subscriptions/:id/payments. Use a small fetch helper to
  // avoid bloating asaas.ts with one-off endpoints.
  if (!env.ASAAS_API_KEY) throw new Error("ASAAS_API_KEY is not set");
  const res = await fetch(
    `${env.ASAAS_BASE_URL}/subscriptions/${subscriptionId}/payments?limit=1&offset=0`,
    {
      headers: {
        access_token: env.ASAAS_API_KEY,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) {
    return { data: null };
  }
  const json = (await res.json()) as { data: Array<{ invoiceUrl?: string; bankSlipUrl?: string }> };
  return { data: json.data?.[0] ?? null };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck

git add "src/app/api/billing/checkout/route.ts"
git commit -m "feat(api): billing checkout route (subscribe + per-use)"
```

---

## Task 10: `/api/billing/cancel/route.ts`

**Files:**
- Create: `src/app/api/billing/cancel/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/billing/cancel/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asaas } from "@/lib/billing/asaas";

export async function POST() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("asaas_subscription_id, subscription_status")
    .eq("id", auth.user.id)
    .single();
  const subId = (profile as { asaas_subscription_id?: string | null } | null)?.asaas_subscription_id;
  if (!subId) {
    return NextResponse.json({ ok: false, error: "Sem assinatura ativa" }, { status: 400 });
  }
  try {
    await asaas.cancelSubscription(subId);
  } catch (err) {
    console.error("[billing/cancel] asaas error:", err);
    return NextResponse.json(
      { ok: false, error: "Não consegui cancelar agora. Tente em instantes." },
      { status: 502 },
    );
  }
  await supabase
    .from("profiles")
    .update({ subscription_status: "canceled" })
    .eq("id", auth.user.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck

git add "src/app/api/billing/cancel/route.ts"
git commit -m "feat(api): billing cancel route"
```

---

## Task 11: Wire quota check into `createPrep`

**Files:**
- Modify: `src/app/prep/new/actions.ts`

- [ ] **Step 1: Read current state of file**

`src/app/prep/new/actions.ts` — `createPrep` currently inserts the row + runs generation immediately. We add the quota check before the insert and the consumption after the insert.

- [ ] **Step 2: Apply the patch**

Add imports near the top of the file:

```ts
import { checkQuota, type ProfileBilling } from "@/lib/billing/quota";
```

Inside `createPrep`, after `if (!user) ...` and BEFORE the duplicate check, add:

```ts
  // Quota gate.
  const { data: billingProfile } = await supabase
    .from("profiles")
    .select(
      "subscription_status, preps_used_this_month, preps_reset_at, prep_credits",
    )
    .eq("id", user.id)
    .single();

  const billing: ProfileBilling = {
    subscription_status: (billingProfile as { subscription_status?: ProfileBilling["subscription_status"] } | null)?.subscription_status ?? "none",
    preps_used_this_month: (billingProfile as { preps_used_this_month?: number } | null)?.preps_used_this_month ?? 0,
    preps_reset_at: (billingProfile as { preps_reset_at?: string } | null)?.preps_reset_at ?? new Date().toISOString(),
    prep_credits: (billingProfile as { prep_credits?: number } | null)?.prep_credits ?? 0,
  };
  const quota = checkQuota(billing, new Date());
  if (!quota.allowed) {
    return { error: "quota_exceeded" };
  }
```

After the successful prep_sessions INSERT (`if (insertError || !session) ...` block) and BEFORE `await runGenerationInline(session.id);`, add:

```ts
  // Quota consumption.
  if (quota.mode === "credit") {
    await supabase
      .from("profiles")
      .update({ prep_credits: billing.prep_credits - 1 })
      .eq("id", user.id);
  } else if (quota.mode === "reset") {
    await supabase
      .from("profiles")
      .update({
        preps_used_this_month: 1,
        preps_reset_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  } else {
    // pro or free: increment counter (free for enforcement, pro for analytics).
    await supabase
      .from("profiles")
      .update({ preps_used_this_month: billing.preps_used_this_month + 1 })
      .eq("id", user.id);
  }
```

- [ ] **Step 3: Update CreatePrepState shape (if needed)**

`CreatePrepState` already has `error?: string`. The string `"quota_exceeded"` is the error sentinel the client renders as `<UpgradeModal>` (Task 12).

- [ ] **Step 4: Run typecheck + tests**

```bash
pnpm typecheck
pnpm test src/app/prep/new/actions.test.ts
```

Existing tests should still pass. Quota check uses default `subscription_status='none'` from the fake profile in the tests, so they'll hit the "free with 0 used" branch.

If existing tests fail because the test doubles don't return the new columns, update the supabase mock in `src/app/prep/new/actions.test.ts` to include `subscription_status: 'none'`, `preps_used_this_month: 0`, `preps_reset_at: '2026-01-01T00:00:00Z'`, `prep_credits: 0` in the profile shape.

- [ ] **Step 5: Commit**

```bash
git add src/app/prep/new/actions.ts src/app/prep/new/actions.test.ts
git commit -m "feat(prep): quota gate + consumption in createPrep"
```

---

## Task 12: `<UpgradeModal>` + integration on `/prep/new` page

**Files:**
- Create: `src/components/billing/UpgradeModal.tsx`
- Test: `src/components/billing/UpgradeModal.test.tsx`
- Create: `src/components/billing/CheckoutButton.tsx`
- Modify: existing `/prep/new` form (`src/app/prep/new/page.tsx` or NewPrepForm component) to render the modal when state.error === "quota_exceeded"

- [ ] **Step 1: Write failing test for UpgradeModal**

```tsx
// src/components/billing/UpgradeModal.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { UpgradeModal } from "./UpgradeModal";

describe("<UpgradeModal />", () => {
  it("renderiza dois CTAs com valores corretos", () => {
    const { getByText } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={vi.fn()} />,
    );
    expect(getByText(/R\$\s*30/)).toBeInTheDocument();
    expect(getByText(/R\$\s*10/)).toBeInTheDocument();
  });

  it("clicar Pro dispara onCheckout('pro_subscription')", () => {
    const cb = vi.fn();
    const { getByRole } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={cb} />,
    );
    fireEvent.click(getByRole("button", { name: /assinar pro/i }));
    expect(cb).toHaveBeenCalledWith("pro_subscription");
  });

  it("clicar Per-use dispara onCheckout('prep_purchase')", () => {
    const cb = vi.fn();
    const { getByRole } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={cb} />,
    );
    fireEvent.click(getByRole("button", { name: /comprar este prep/i }));
    expect(cb).toHaveBeenCalledWith("prep_purchase");
  });

  it("não renderiza quando open=false", () => {
    const { queryByRole } = render(
      <UpgradeModal open={false} onClose={vi.fn()} onCheckout={vi.fn()} />,
    );
    expect(queryByRole("dialog")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
pnpm test src/components/billing/UpgradeModal.test.tsx
```

- [ ] **Step 3: Implement UpgradeModal**

```tsx
// src/components/billing/UpgradeModal.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Kind = "pro_subscription" | "prep_purchase";

export function UpgradeModal({
  open,
  onClose,
  onCheckout,
  daysToReset,
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: (kind: Kind) => void;
  daysToReset?: number;
}) {
  const [pendingKind, setPendingKind] = useState<Kind | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handle = (kind: Kind) => {
    setPendingKind(kind);
    onCheckout(kind);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-bg p-6 shadow-prep"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-text-primary">
          Você atingiu o limite do plano Free
        </h3>
        {typeof daysToReset === "number" && daysToReset > 0 && (
          <p className="mt-2 text-sm text-text-secondary">
            Próximo prep grátis em ~{daysToReset} {daysToReset === 1 ? "dia" : "dias"}.
          </p>
        )}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-orange-500 bg-orange-soft p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Recomendado
            </p>
            <h4 className="mt-1 text-lg font-bold text-ink">Pro</h4>
            <p className="text-sm text-ink-2">Preps ilimitados, R$ 30 / mês</p>
            <Button
              type="button"
              onClick={() => handle("pro_subscription")}
              disabled={pendingKind !== null}
              className="mt-4 w-full"
            >
              {pendingKind === "pro_subscription" ? "Abrindo…" : "Assinar Pro"}
            </Button>
          </div>
          <div className="rounded-lg border border-line bg-bg p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
              Avulso
            </p>
            <h4 className="mt-1 text-lg font-bold text-ink">1 prep — R$ 10</h4>
            <p className="text-sm text-ink-2">Pague só este prep, sem mensalidade.</p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handle("prep_purchase")}
              disabled={pendingKind !== null}
              className="mt-4 w-full"
            >
              {pendingKind === "prep_purchase" ? "Abrindo…" : "Comprar este prep"}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement CheckoutButton helper (uses fetch)**

```tsx
// src/components/billing/CheckoutButton.tsx
"use client";

import { useTransition } from "react";

export async function startCheckout(kind: "pro_subscription" | "prep_purchase"): Promise<void> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Checkout falhou (HTTP ${res.status})`);
  }
  const { checkoutUrl } = (await res.json()) as { checkoutUrl?: string };
  if (!checkoutUrl) throw new Error("Asaas não retornou link de checkout");
  window.location.href = checkoutUrl;
}

export function CheckoutButton({
  kind,
  children,
  variant,
}: {
  kind: "pro_subscription" | "prep_purchase";
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await startCheckout(kind);
          } catch (err) {
            alert(err instanceof Error ? err.message : "Erro");
          }
        })
      }
      className={
        variant === "ghost"
          ? "rounded-pill border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-bg disabled:opacity-60"
          : "rounded-pill bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      }
    >
      {pending ? "Abrindo…" : children}
    </button>
  );
}
```

- [ ] **Step 5: Wire UpgradeModal into NewPrepForm**

Find the form component that submits `createPrep` (likely `src/components/prep/NewPrepForm.tsx`). After the call site for `createPrep`, when `state.error === "quota_exceeded"`, render `<UpgradeModal>` with `onCheckout={(kind) => startCheckout(kind)}` and `daysToReset` computed from a server prop (added below) or simply omitted in the MVP.

If the file already uses `useFormState` / server action, add:

```tsx
import { useState } from "react";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { startCheckout } from "@/components/billing/CheckoutButton";

// inside the component, after state hook:
const showUpgrade = state.error === "quota_exceeded";

// in JSX, near the form root:
<UpgradeModal
  open={showUpgrade}
  onClose={() => { /* let user re-edit JD; the next click will retry */ }}
  onCheckout={(kind) => startCheckout(kind).catch((err) => alert(err.message))}
/>
```

(If the form structure is different and you need orientation, dispatch a small follow-up after reading the file. The above is the contract.)

- [ ] **Step 6: Run tests + typecheck + commit**

```bash
pnpm test src/components/billing/UpgradeModal.test.tsx
pnpm typecheck

git add src/components/billing/UpgradeModal.tsx \
        src/components/billing/UpgradeModal.test.tsx \
        src/components/billing/CheckoutButton.tsx \
        src/components/prep/NewPrepForm.tsx
git commit -m "feat(billing): UpgradeModal + checkout helper, wired into NewPrepForm"
```

---

## Task 13: Hydrate billing fields into `ProfileShellData`

**Files:**
- Modify: `src/lib/profile/types.ts`
- Modify: `src/app/(app)/profile/layout.tsx`

- [ ] **Step 1: Extend ProfileShellData**

In `src/lib/profile/types.ts`, append fields:

```ts
export type ProfileShellData = {
  id: string;
  email: string;
  fullName: string | null;
  preferredLanguage: "en" | "pt-br" | "es";
  tier: "free" | "pro" | "team";
  prepsUsedThisMonth: number;
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
  resolvedAvatarUrl: string;
  // billing
  asaasCustomerId: string | null;
  subscriptionStatus: "active" | "overdue" | "canceled" | "expired" | "none";
  subscriptionRenewsAt: string | null;
  prepCredits: number;
  prepsResetAt: string;
};
```

- [ ] **Step 2: Update profile layout select + builder**

Open `src/app/(app)/profile/layout.tsx`. Update the `.select(...)` to include the billing columns:

```ts
.select(
  "id, email, full_name, preferred_language, tier, preps_used_this_month, avatar_url, avatar_updated_at, asaas_customer_id, subscription_status, subscription_renews_at, prep_credits, preps_reset_at",
)
```

Update the type assertion `p` to include the new fields:

```ts
const p = profile as {
  id: string;
  email: string;
  full_name: string | null;
  preferred_language: "en" | "pt-br" | "es";
  tier: "free" | "pro" | "team";
  preps_used_this_month: number;
  avatar_url: string | null;
  avatar_updated_at: string | null;
  asaas_customer_id: string | null;
  subscription_status: "active" | "overdue" | "canceled" | "expired" | "none" | null;
  subscription_renews_at: string | null;
  prep_credits: number;
  preps_reset_at: string;
};
```

Add to the `data` object literal:

```ts
asaasCustomerId: p.asaas_customer_id,
subscriptionStatus: p.subscription_status ?? "none",
subscriptionRenewsAt: p.subscription_renews_at,
prepCredits: p.prep_credits,
prepsResetAt: p.preps_reset_at,
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck

git add src/lib/profile/types.ts "src/app/(app)/profile/layout.tsx"
git commit -m "feat(profile): hydrate billing fields into ProfileShellData"
```

---

## Task 14: Rewrite `<AccountSection>` Plano card

**Files:**
- Modify: `src/components/profile/AccountSection.tsx`
- Create: `src/components/billing/PlanCard.tsx`
- Create: `src/components/billing/CancelSubscriptionDialog.tsx`
- Create: `src/components/billing/BillingHistoryList.tsx`

- [ ] **Step 1: Implement PlanCard**

```tsx
// src/components/billing/PlanCard.tsx
"use client";

import { useProfileShell } from "@/components/profile/ProfileShellProvider";
import { CheckoutButton } from "./CheckoutButton";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PlanCard() {
  const data = useProfileShell();
  const status = data.subscriptionStatus;

  if (status === "active") {
    return (
      <div className="rounded-md border border-border p-4">
        <p className="text-sm text-text-primary">
          Plano <strong>Pro</strong> — renova em {formatDate(data.subscriptionRenewsAt)}
        </p>
        {data.prepCredits > 0 && (
          <p className="mt-1 text-xs text-text-tertiary">
            +{data.prepCredits} {data.prepCredits === 1 ? "crédito avulso" : "créditos avulsos"}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <CancelSubscriptionDialog />
        </div>
      </div>
    );
  }

  if (status === "overdue") {
    return (
      <div className="rounded-md border border-yellow-500 bg-yellow-soft p-4">
        <p className="text-sm text-text-primary">
          ⚠️ Pagamento em atraso. Atualize seu cartão pra manter o Pro.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CheckoutButton kind="pro_subscription">Atualizar pagamento</CheckoutButton>
          <CancelSubscriptionDialog />
        </div>
      </div>
    );
  }

  if (status === "canceled") {
    return (
      <div className="rounded-md border border-border p-4">
        <p className="text-sm text-text-primary">
          Cancelado. Acesso Pro até {formatDate(data.subscriptionRenewsAt)}.
        </p>
        <div className="mt-3">
          <CheckoutButton kind="pro_subscription">Reativar Pro</CheckoutButton>
        </div>
      </div>
    );
  }

  // none / expired
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-sm text-text-primary">
        Plano <strong>Free</strong> — 1 prep a cada 30 dias.
      </p>
      {data.prepCredits > 0 && (
        <p className="mt-1 text-xs text-text-tertiary">
          Você tem {data.prepCredits}{" "}
          {data.prepCredits === 1 ? "crédito avulso" : "créditos avulsos"}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <CheckoutButton kind="pro_subscription">Assinar Pro — R$ 30/mês</CheckoutButton>
        <CheckoutButton kind="prep_purchase" variant="ghost">Comprar 1 prep — R$ 10</CheckoutButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement CancelSubscriptionDialog**

```tsx
// src/components/billing/CancelSubscriptionDialog.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function CancelSubscriptionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (text !== "CANCELAR") return;
    setError(null);
    start(async () => {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Erro HTTP ${res.status}`);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Cancelar assinatura
      </Button>
    );
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg bg-bg p-6 shadow-prep">
        <h3 className="text-lg font-semibold text-text-primary">Cancelar assinatura</h3>
        <p className="text-sm text-text-secondary">
          Sua conta vai voltar pro plano Free no fim do ciclo atual. Preps gerados continuam acessíveis.
          Digite <strong>CANCELAR</strong> pra confirmar.
        </p>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          placeholder="CANCELAR"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => { setOpen(false); setText(""); setError(null); }} disabled={pending}>
            Voltar
          </Button>
          <Button type="button" onClick={submit} disabled={text !== "CANCELAR" || pending}>
            {pending ? "Cancelando…" : "Cancelar definitivamente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement BillingHistoryList**

```tsx
// src/components/billing/BillingHistoryList.tsx
import { createClient } from "@/lib/supabase/server";
import { brlLabel } from "@/lib/billing/prices";

type Row = {
  id: string;
  asaas_payment_id: string;
  kind: "pro_subscription" | "prep_purchase";
  amount_cents: number;
  status: string;
  paid_at: string | null;
  created_at: string;
};

const KIND_LABEL: Record<Row["kind"], string> = {
  pro_subscription: "Assinatura Pro",
  prep_purchase: "Prep avulso",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  received: "Pago",
  refunded: "Reembolsado",
  overdue: "Em atraso",
  failed: "Falhou",
};

export async function BillingHistoryList() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("payments")
    .select("id, asaas_payment_id, kind, amount_cents, status, paid_at, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as Row[];

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-text-tertiary">
        Nenhum pagamento registrado.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg p-3 text-sm"
        >
          <div>
            <p className="font-semibold text-text-primary">{KIND_LABEL[r.kind]}</p>
            <p className="text-xs text-text-tertiary">
              {new Date(r.paid_at ?? r.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-text-primary">{brlLabel(r.amount_cents)}</p>
            <p className="text-xs text-text-tertiary">{STATUS_LABEL[r.status] ?? r.status}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Rewrite AccountSection.tsx Plano section**

Open `src/components/profile/AccountSection.tsx` and replace the current `<section>` for "Plano" with the new components. Result:

```tsx
"use client";

import { useProfileShell } from "./ProfileShellProvider";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { PlanCard } from "@/components/billing/PlanCard";
import { BillingHistoryList } from "@/components/billing/BillingHistoryList";
import { changePassword, deleteAccount } from "@/app/(app)/profile/actions";

export function AccountSection() {
  // useProfileShell still consumed downstream (PlanCard reads it). We keep
  // the hook reference here even though we don't read fields directly,
  // because PlanCard needs the provider to be active.
  useProfileShell();

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Plano</h2>
        <PlanCard />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Histórico de pagamentos</h2>
        {/* @ts-expect-error Async Server Component allowed inside client tree
            via Next.js boundaries — BillingHistoryList is server-rendered when
            used inside a server page; AccountSection itself is client. Move
            BillingHistoryList up to the page for strict typing if your team
            prefers — keeping it here for spec parity. */}
        <BillingHistoryList />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Segurança</h2>
        <div className="rounded-md border border-border p-4">
          <ChangePasswordDialog action={changePassword} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-red-700">Zona de perigo</h2>
        <div className="rounded-md border border-red-300 bg-red-50 p-4 dark:bg-red-950/30">
          <p className="mb-2 text-sm text-text-primary">
            Excluir sua conta apaga permanentemente todos os seus preps, CVs, e
            dados de perfil. Não há como desfazer.
          </p>
          <DeleteAccountDialog action={deleteAccount} />
        </div>
      </section>
    </div>
  );
}
```

If the `@ts-expect-error` shortcut is uncomfortable, refactor: move `<BillingHistoryList />` rendering into `src/app/(app)/profile/account/page.tsx` (which is a server component) and pass the rendered tree down. For MVP keep the comment.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck

git add src/components/billing/PlanCard.tsx \
        src/components/billing/CancelSubscriptionDialog.tsx \
        src/components/billing/BillingHistoryList.tsx \
        src/components/profile/AccountSection.tsx
git commit -m "feat(billing): PlanCard + CancelSubscriptionDialog + BillingHistoryList in AccountSection"
```

---

## Task 15: Free-tier banner + credits badge on `/dashboard`

**Files:**
- Create: `src/components/billing/FreeTierBanner.tsx`
- Create: `src/components/billing/CreditsBadge.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Implement FreeTierBanner**

```tsx
// src/components/billing/FreeTierBanner.tsx
import { CheckoutButton } from "./CheckoutButton";

export function FreeTierBanner({
  prepsUsedThisMonth,
  prepsResetAt,
  credits,
}: {
  prepsUsedThisMonth: number;
  prepsResetAt: string;
  credits: number;
}) {
  const resetMs = new Date(prepsResetAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(0, Math.ceil((resetMs - Date.now()) / (24 * 60 * 60 * 1000)));
  const remaining = Math.max(0, 1 - prepsUsedThisMonth) + credits;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-orange-soft px-4 py-3 text-sm">
      <p className="text-ink-2">
        ⚡ Plano <strong>Free</strong> —{" "}
        {remaining > 0
          ? `${remaining} prep${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}.`
          : "Limite atingido."}{" "}
        {prepsUsedThisMonth >= 1 && credits === 0 && daysLeft > 0 && (
          <span className="text-ink-3">Próximo grátis em {daysLeft} {daysLeft === 1 ? "dia" : "dias"}.</span>
        )}
      </p>
      <CheckoutButton kind="pro_subscription">Assinar Pro</CheckoutButton>
    </div>
  );
}
```

- [ ] **Step 2: Implement CreditsBadge**

```tsx
// src/components/billing/CreditsBadge.tsx
export function CreditsBadge({ credits }: { credits: number }) {
  if (credits <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-green-soft px-2.5 py-1 text-xs font-semibold text-green-700">
      🎟️ {credits} {credits === 1 ? "crédito" : "créditos"}
    </span>
  );
}
```

- [ ] **Step 3: Wire into dashboard**

Open `src/app/(app)/dashboard/page.tsx`. Adjust the profile select to also pull billing fields:

```ts
const { data: profileRow } = await supabase
  .from("profiles")
  .select("subscription_status, preps_used_this_month, preps_reset_at, prep_credits")
  .eq("id", user.id)
  .single();
const billing = (profileRow ?? {}) as {
  subscription_status?: "active" | "overdue" | "canceled" | "expired" | "none" | null;
  preps_used_this_month?: number;
  preps_reset_at?: string;
  prep_credits?: number;
};
```

Just above the `<div className="mb-8 flex flex-col ...">` opening (the page header), add:

```tsx
{billing.subscription_status !== "active" && billing.subscription_status !== "overdue" && (
  <FreeTierBanner
    prepsUsedThisMonth={billing.preps_used_this_month ?? 0}
    prepsResetAt={billing.preps_reset_at ?? new Date().toISOString()}
    credits={billing.prep_credits ?? 0}
  />
)}
```

Add the import at the top:

```ts
import { FreeTierBanner } from "@/components/billing/FreeTierBanner";
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm typecheck

git add src/components/billing/FreeTierBanner.tsx \
        src/components/billing/CreditsBadge.tsx \
        "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(billing): free-tier banner + credits badge on dashboard"
```

---

## Task 16: Final pass — full test run, lint, smoke

- [ ] **Step 1: Run the whole test suite**

```bash
pnpm test
```

Expected: PASS — no regressions; new tests in `src/lib/billing/*` and `src/components/billing/*` pass.

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: typecheck clean; lint shows only pre-existing warnings.

- [ ] **Step 3: Manual smoke (sandbox)**

After applying the migration on Supabase and configuring Asaas sandbox env vars on Railway:

- [ ] Login → `/prep/new` → submit a prep when no other prep exists this month → succeeds.
- [ ] Login → `/prep/new` → submit a 2nd prep within 30 days → server returns `quota_exceeded` → UpgradeModal shows.
- [ ] In modal, click **Assinar Pro** → redirect to Asaas hosted checkout → pay with sandbox Pix → return to `/dashboard?billing=ok` → banner gone, tier=Pro.
- [ ] `/profile/account` → "Cancelar assinatura" → digita CANCELAR → status=canceled, tier reverts only at `subscription_renews_at`.
- [ ] In modal (different account), click **Comprar este prep** → pay → credit appears, banner shows "+1 crédito".
- [ ] Hit webhook URL with the same `id` twice — second is a no-op (idempotency).

Document the smoke steps in `docs/billing/sandbox-smoke.md` for reproducibility.

- [ ] **Step 4: Commit any docs**

```bash
git add docs/billing/sandbox-smoke.md  # if created
git commit -m "docs(billing): sandbox smoke checklist" --allow-empty
```

---

## Self-review notes

**Spec coverage:**
- §4.1 money path → Tasks 9 + 8 (checkout + webhook) ✓
- §4.2 per-use path → Task 9 (createPayment branch) + Task 7 (webhook handler) ✓
- §4.3 quota at createPrep → Task 11 ✓
- §4.4 lifecycle table → Task 7 dispatcher branches ✓
- §4.5 zero PCI → no card data in code ✓
- §5.1 migration → Task 1 ✓
- §5.2 status semantics → Task 4 quota.ts + Task 14 PlanCard branches ✓
- §5.3 ProfileShellData → Task 13 ✓
- §6 files & components → Tasks 3-15 ✓
- §6.2 MOCK_ASAAS — NOT YET IMPLEMENTED. Tests use mocks per-call rather than env-gated. Acceptable trade-off: simpler tests, no production guard needed since real fetch is used. If team wants the env switch later, add it.
- §7 API contracts → Tasks 8-10 ✓
- §8 UX → Tasks 12, 14, 15 ✓
- §9 error handling → covered in route handlers (401/502/idempotency) ✓
- §10 rollout → Task 1 (migration) + Task 16 (smoke) ✓
- §11 testing → Tasks 3, 4, 6, 7, 12 ✓; E2E manual in Task 16
- §12 known edges → carried in PR description, not in plan
- §13 risks → bearer token via verifyToken (Task 7) ✓; idempotency via UNIQUE index (Task 1) ✓; rolling-30 read-side computation (Task 4) ✓
