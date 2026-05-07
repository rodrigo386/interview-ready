# Affiliate Program MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan stage-by-stage. Each stage is a discrete commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a curated affiliate program MVP: parceiros aplicam via `/parceiros`, são aprovados manualmente, geram link `?ref=CODE`, recebem 30% recorrente vitalício sobre payments dos referrals, com pagamento manual via Pix e ledger auditável.

**Architecture:** 6 stages, cada uma um commit atômico. Stages 1-3 são "foundation" (zero impacto user-visible). Stages 4-6 são UI (admin → public → partner). Schema em migration 0016. Side-effect tracking via TS após RPCs do webhook (idempotent via UNIQUE(payment_id)).

**Tech Stack:** Next.js 15 App Router server actions, Supabase (Postgres + RLS + RPCs), TypeScript strict, Vitest + RTL pra unit/component tests, Tailwind tokens existentes.

**Spec reference:** `docs/superpowers/specs/2026-05-06-affiliate-program-mvp-design.md`

---

## Stage Overview

| Stage | Files | LOC est | Commit produces |
|---|---|---|---|
| 1. Foundation: migration + libs + types | 5 | ~380 | Tabelas criadas, libs vazias mas testadas, sem efeito user |
| 2. Tracking: middleware + signup attribution | 3 | ~150 | Cookie `pv_ref` set/read, attribution no signup |
| 3. Commission: webhook integration + lazy confirm | 1 modify + 1 test | ~80 | Pagamentos viram comissões automaticamente |
| 4. Admin UI: `/admin/affiliates` | 4 | ~400 | Founder aprova, suspende, marca pago |
| 5. Public: `/parceiros` + apply flow | 4 | ~350 | Pessoas podem aplicar |
| 6. Partner: `/partner` dashboard | 4 | ~300 | Parceiros aprovados veem dados deles |

**Total: ~17 arquivos, ~1700 LOC, 6 commits.** Multi-day project but stages are independent and shippable.

---

## File Structure

| File | Stage | Responsibility |
|---|---|---|
| `supabase/migrations/0016_affiliate_program.sql` | 1 | Schema: 3 tabelas + ALTER profiles add pix_key + RLS + indexes |
| `src/lib/affiliate/types.ts` | 1 | TS types matching DB |
| `src/lib/affiliate/code.ts` | 1 | `validateCode`, `generateCodeFromName` (pure, testable) |
| `src/lib/affiliate/attribution.ts` | 1+2 | `attachReferral(profileId, refCode)` server-only, anti-fraude |
| `src/lib/affiliate/commission.ts` | 1+3 | `recordCommission`, `recordClawback`, `confirmCommissions`, `getPartnerEarnings` |
| `src/lib/affiliate/code.test.ts` | 1 | unit tests do code.ts |
| `src/lib/affiliate/commission.test.ts` | 1 | unit tests do commission.ts (mock supabase) |
| `middleware.ts` | 2 | Modify: capture `?ref=` → set cookie → redirect clean |
| `src/app/auth/callback/route.ts` | 2 | Modify: read pv_ref cookie pós-signup, chamar attachReferral, deletar cookie |
| `src/lib/billing/webhook.ts` | 3 | Modify: chamar recordCommission após RPC sucesso, recordClawback em refund |
| `src/lib/affiliate/commission.integration.test.ts` | 3 | integration test mockando supabase pra commission lifecycle |
| `src/lib/admin/auth.ts` | 4 | Modify: add `requirePartner()` helper |
| `src/app/admin/affiliates/page.tsx` | 4 | Admin gestão server component |
| `src/app/admin/affiliates/actions.ts` | 4 | `approvePartner`, `denyPartner`, `suspendPartner`, `markCommissionsAsPaid` |
| `src/components/affiliate/ApprovalDialog.tsx` | 4 | Client component |
| `src/components/affiliate/ApprovalDialog.test.tsx` | 4 | Component test |
| `src/app/parceiros/page.tsx` | 5 | Landing pública + form |
| `src/app/parceiros/actions.ts` | 5 | `applyAsAffiliate` server action |
| `src/components/affiliate/PartnerForm.tsx` | 5 | Client form com validation |
| `src/components/affiliate/PartnerForm.test.tsx` | 5 | Component test |
| `src/app/(app)/partner/page.tsx` | 6 | Partner dashboard server component |
| `src/app/(app)/partner/actions.ts` | 6 | `updatePixKey` action |
| `src/components/affiliate/CodeBox.tsx` | 6 | Copy button client component |
| `src/components/affiliate/EarningsCard.tsx` | 6 | Server component KPI tile |
| `src/components/affiliate/CodeBox.test.tsx` | 6 | Component test (mock clipboard) |

---

## Stage 1: Foundation — migration + libs + types

**Goal:** Schema deployed, libs implementadas e testadas, mas sem nenhum entry point user-visible. Zero impacto em produção.

### Task 1.1: Migration

**Files:**
- Create: `supabase/migrations/0016_affiliate_program.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration 0016: Affiliate program
-- Schema for curated affiliate program with 30% lifetime recurring commission

-- 1. Add pix_key column to profiles (used for partner payouts; also useful for refund target)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- 2. Affiliate partners table
CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  commission_rate_pct INT NOT NULL DEFAULT 30
    CHECK (commission_rate_pct BETWEEN 0 AND 100),
  notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_code_active ON affiliate_partners(code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_partners_user ON affiliate_partners(user_id);

-- 3. Referrals table (1:1 with profiles)
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE RESTRICT,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  flagged_for_review BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_referrals_partner ON affiliate_referrals(partner_id);

-- 4. Commission ledger (1 row per payment, idempotent via UNIQUE)
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'paid', 'clawback')),
  confirmed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_via TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id)
);

CREATE INDEX IF NOT EXISTS idx_commissions_partner_status ON affiliate_commissions(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_commissions_status_created ON affiliate_commissions(status, created_at);

-- 5. RLS

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- affiliate_partners: user reads own row only
CREATE POLICY "Partners view own row"
  ON public.affiliate_partners
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- affiliate_referrals: NO authenticated access (privacy: user shouldn't know who referred them)
-- Service role only.

-- affiliate_commissions: partner reads own commissions via JOIN
CREATE POLICY "Partners view own commissions"
  ON public.affiliate_commissions
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM public.affiliate_partners WHERE user_id = auth.uid()
    )
  );

-- All INSERT/UPDATE/DELETE on these 3 tables: service_role only (no policy = no access for authenticated).
```

- [ ] **Step 2: Apply migration to remote Supabase**

The project uses Supabase MCP. Apply via the `mcp__claude_ai_Supabase__apply_migration` tool with name `0016_affiliate_program` and the SQL body above.

Expected result: success, 3 new tables visible in `list_tables`, `profiles` has `pix_key` column.

If migration fails, read the error carefully. Common issues:
- Foreign key reference to a table with different column name
- RLS policy syntax error
- `IF NOT EXISTS` already idempotent so safe to re-run partials

### Task 1.2: TypeScript types

**Files:**
- Create: `src/lib/affiliate/types.ts`

- [ ] **Step 1: Write types**

```ts
// src/lib/affiliate/types.ts
export type AffiliatePartnerStatus = "pending" | "active" | "suspended";
export type AffiliateCommissionStatus = "pending" | "confirmed" | "paid" | "clawback";

export type AffiliatePartner = {
  id: string;
  user_id: string;
  code: string;
  display_name: string;
  bio: string | null;
  status: AffiliatePartnerStatus;
  commission_rate_pct: number;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
};

export type AffiliateReferral = {
  profile_id: string;
  partner_id: string;
  attributed_at: string;
  flagged_for_review: boolean;
  flag_reason: string | null;
};

export type AffiliateCommission = {
  id: string;
  partner_id: string;
  payment_id: string;
  amount_cents: number;
  status: AffiliateCommissionStatus;
  confirmed_at: string | null;
  paid_at: string | null;
  paid_via: string | null;
  created_at: string;
};

export type PartnerEarnings = {
  signups_total: number;
  signups_active_paying: number;
  mrr_generated_cents: number;
  total_earned_cents: number;
  pending_cents: number;
  payable_cents: number; // status='confirmed' AND paid_at IS NULL
  paid_all_time_cents: number;
};
```

### Task 1.3: Code validation lib + tests

**Files:**
- Create: `src/lib/affiliate/code.ts`
- Create: `src/lib/affiliate/code.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/affiliate/code.test.ts
import { describe, expect, it } from "vitest";
import { validateCode, generateCodeFromName } from "./code";

describe("validateCode", () => {
  it("accepts valid uppercase alphanumeric with hyphens", () => {
    expect(validateCode("ANA-COACH")).toBe(true);
    expect(validateCode("AB")).toBe(true);
    expect(validateCode("PARTNER123")).toBe(true);
    expect(validateCode("A-B-C-D-E-F")).toBe(true);
  });

  it("rejects too short codes", () => {
    expect(validateCode("A")).toBe(false);
    expect(validateCode("")).toBe(false);
  });

  it("rejects too long codes (>40)", () => {
    expect(validateCode("A".repeat(41))).toBe(false);
    expect(validateCode("A".repeat(40))).toBe(true);
  });

  it("rejects lowercase", () => {
    expect(validateCode("ana-coach")).toBe(false);
    expect(validateCode("Ana-Coach")).toBe(false);
  });

  it("rejects whitespace and special chars", () => {
    expect(validateCode("ANA COACH")).toBe(false);
    expect(validateCode("ANA_COACH")).toBe(false);
    expect(validateCode("ANA.COACH")).toBe(false);
    expect(validateCode("ANA/COACH")).toBe(false);
  });

  it("rejects null/undefined gracefully", () => {
    expect(validateCode(null as unknown as string)).toBe(false);
    expect(validateCode(undefined as unknown as string)).toBe(false);
  });
});

describe("generateCodeFromName", () => {
  it("uppercases and replaces spaces with hyphens", () => {
    expect(generateCodeFromName("Ana Costa")).toBe("ANA-COSTA");
  });

  it("strips special chars and accents", () => {
    expect(generateCodeFromName("João da Silva")).toBe("JOAO-DA-SILVA");
    expect(generateCodeFromName("Maria O'Brien")).toBe("MARIA-OBRIEN");
  });

  it("collapses consecutive hyphens", () => {
    expect(generateCodeFromName("Ana   Costa")).toBe("ANA-COSTA");
    expect(generateCodeFromName("Ana - Costa")).toBe("ANA-COSTA");
  });

  it("trims leading/trailing hyphens", () => {
    expect(generateCodeFromName(" Ana Costa ")).toBe("ANA-COSTA");
    expect(generateCodeFromName("- Ana -")).toBe("ANA");
  });

  it("caps at 40 chars", () => {
    const long = "A".repeat(50);
    expect(generateCodeFromName(long).length).toBe(40);
  });

  it("returns empty string for input that has no valid chars", () => {
    expect(generateCodeFromName("...")).toBe("");
    expect(generateCodeFromName("")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test -- src/lib/affiliate/code.test.ts
```

Expected: failure with module-not-found on `./code`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/affiliate/code.ts
const CODE_REGEX = /^[A-Z0-9-]{2,40}$/;

export function validateCode(code: string | null | undefined): boolean {
  if (!code || typeof code !== "string") return false;
  return CODE_REGEX.test(code);
}

export function generateCodeFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "") // strip non-alphanum-hyphen-space
    .replace(/\s+/g, "-") // spaces to single hyphens
    .replace(/-+/g, "-") // collapse hyphens
    .replace(/^-|-$/g, "") // trim leading/trailing hyphens
    .slice(0, 40);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test -- src/lib/affiliate/code.test.ts
```

Expected: all tests pass.

### Task 1.4: Attribution lib (skeleton, behavior comes in Stage 2)

**Files:**
- Create: `src/lib/affiliate/attribution.ts`

- [ ] **Step 1: Write the function (no tests yet — integration tests live in Stage 2)**

```ts
// src/lib/affiliate/attribution.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateCode } from "./code";

export type AttributionResult =
  | { attributed: true; partnerId: string; flagged: boolean; flagReason?: string }
  | { attributed: false; reason: "invalid_code" | "code_not_found" | "self_referral" | "already_attributed" | "error" };

/**
 * Attaches a referral to a profile if the cookie code resolves to an active partner.
 * Idempotent: called multiple times for the same profile_id, the existing referral wins (no overwrite).
 * Anti-fraud:
 *   - Rejects if partner.user_id == profile_id (self-referral)
 *   - Flags (but does not reject) if same email domain or same CPF as partner
 *
 * Side-effects: inserts into affiliate_referrals on success.
 */
export async function attachReferral(
  profileId: string,
  refCode: string | null | undefined,
  supabase: SupabaseClient,
): Promise<AttributionResult> {
  if (!validateCode(refCode)) {
    return { attributed: false, reason: "invalid_code" };
  }

  // Already attributed? (idempotent)
  const { data: existing } = await supabase
    .from("affiliate_referrals")
    .select("partner_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existing) {
    return { attributed: false, reason: "already_attributed" };
  }

  // Find partner by code (only active)
  const { data: partner, error: pErr } = await supabase
    .from("affiliate_partners")
    .select("id, user_id")
    .eq("code", refCode!)
    .eq("status", "active")
    .maybeSingle();
  if (pErr) return { attributed: false, reason: "error" };
  if (!partner) return { attributed: false, reason: "code_not_found" };

  if (partner.user_id === profileId) {
    return { attributed: false, reason: "self_referral" };
  }

  // Anti-fraud flags
  const flags: string[] = [];
  const { data: refereeProfile } = await supabase
    .from("profiles")
    .select("email, cpf_cnpj")
    .eq("id", profileId)
    .single();
  const { data: partnerProfile } = await supabase
    .from("profiles")
    .select("email, cpf_cnpj")
    .eq("id", partner.user_id)
    .single();
  if (refereeProfile && partnerProfile) {
    const refDomain = refereeProfile.email?.split("@")[1];
    const partnerDomain = partnerProfile.email?.split("@")[1];
    if (refDomain && partnerDomain && refDomain === partnerDomain) {
      flags.push("same_email_domain");
    }
    if (
      refereeProfile.cpf_cnpj &&
      partnerProfile.cpf_cnpj &&
      refereeProfile.cpf_cnpj === partnerProfile.cpf_cnpj
    ) {
      flags.push("same_cpf");
    }
  }

  const flagged = flags.length > 0;
  const flagReason = flagged ? flags.join(",") : null;

  const { error: insErr } = await supabase.from("affiliate_referrals").insert({
    profile_id: profileId,
    partner_id: partner.id,
    flagged_for_review: flagged,
    flag_reason: flagReason,
  });

  if (insErr) return { attributed: false, reason: "error" };

  return {
    attributed: true,
    partnerId: partner.id,
    flagged,
    flagReason: flagReason ?? undefined,
  };
}
```

### Task 1.5: Commission lib + tests

**Files:**
- Create: `src/lib/affiliate/commission.ts`
- Create: `src/lib/affiliate/commission.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/affiliate/commission.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { recordCommission, recordClawback } from "./commission";

// Mock Supabase client
function makeSupabase(overrides: Record<string, any> = {}) {
  const defaults = {
    payment: { id: "pay-1", user_id: "user-1", amount_cents: 3000, status: "received" },
    referral: { partner_id: "partner-1" },
    partner: { id: "partner-1", status: "active", commission_rate_pct: 30 },
    insertResult: { error: null },
    updateResult: { error: null },
  };
  const cfg = { ...defaults, ...overrides };

  const fromMock = vi.fn((table: string) => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.maybeSingle = vi.fn(async () => {
      if (table === "payments") return { data: cfg.payment, error: null };
      if (table === "affiliate_referrals") return { data: cfg.referral, error: null };
      if (table === "affiliate_partners") return { data: cfg.partner, error: null };
      return { data: null, error: null };
    });
    builder.single = builder.maybeSingle;
    builder.insert = vi.fn(async () => cfg.insertResult);
    builder.update = vi.fn().mockReturnValue(builder);
    return builder;
  });

  return { from: fromMock } as any;
}

describe("recordCommission", () => {
  it("inserts a pending commission for a referred payment", async () => {
    const sb = makeSupabase();
    const res = await recordCommission("pay-1", sb);
    expect(res.recorded).toBe(true);
    expect(sb.from).toHaveBeenCalledWith("affiliate_commissions");
  });

  it("skips when payment has no referral", async () => {
    const sb = makeSupabase({ referral: null });
    const res = await recordCommission("pay-1", sb);
    expect(res.recorded).toBe(false);
    expect(res.reason).toBe("no_referral");
  });

  it("skips when partner is suspended", async () => {
    const sb = makeSupabase({ partner: { id: "partner-1", status: "suspended", commission_rate_pct: 30 } });
    const res = await recordCommission("pay-1", sb);
    expect(res.recorded).toBe(false);
    expect(res.reason).toBe("partner_inactive");
  });

  it("computes amount as commission_rate_pct of payment.amount_cents", async () => {
    const sb = makeSupabase({
      payment: { id: "pay-1", user_id: "user-1", amount_cents: 3000, status: "received" },
      partner: { id: "partner-1", status: "active", commission_rate_pct: 30 },
    });
    const res = await recordCommission("pay-1", sb);
    expect(res.recorded).toBe(true);
    expect(res.amountCents).toBe(900); // 30% of 3000
  });

  it("returns idempotent=true on UNIQUE violation (already recorded)", async () => {
    const sb = makeSupabase({
      insertResult: { error: { code: "23505", message: "duplicate key" } },
    });
    const res = await recordCommission("pay-1", sb);
    expect(res.recorded).toBe(false);
    expect(res.reason).toBe("already_recorded");
  });
});

describe("recordClawback", () => {
  it("updates commission row to clawback status", async () => {
    const sb = makeSupabase();
    const res = await recordClawback("pay-1", sb);
    expect(res.clawed).toBe(true);
  });
});
```

- [ ] **Step 2: Write the implementation**

```ts
// src/lib/affiliate/commission.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartnerEarnings } from "./types";

export type RecordCommissionResult =
  | { recorded: true; amountCents: number; partnerId: string }
  | { recorded: false; reason: "no_payment" | "no_referral" | "partner_inactive" | "already_recorded" | "error"; detail?: string };

export type RecordClawbackResult =
  | { clawed: true }
  | { clawed: false; reason: "no_commission" | "error" };

const CONFIRM_WINDOW_DAYS = 7;

/**
 * Records a commission row for a payment if the user was referred by an active partner.
 * Idempotent: re-running for the same payment_id returns "already_recorded".
 * Side-effect failures must be tolerated by the caller (webhook).
 */
export async function recordCommission(
  paymentId: string,
  supabase: SupabaseClient,
): Promise<RecordCommissionResult> {
  // 1. Load payment
  const { data: payment, error: pErr } = await supabase
    .from("payments")
    .select("id, user_id, amount_cents")
    .eq("id", paymentId)
    .maybeSingle();
  if (pErr) return { recorded: false, reason: "error", detail: pErr.message };
  if (!payment) return { recorded: false, reason: "no_payment" };

  // 2. Find referral for this user
  const { data: referral } = await supabase
    .from("affiliate_referrals")
    .select("partner_id")
    .eq("profile_id", payment.user_id)
    .maybeSingle();
  if (!referral) return { recorded: false, reason: "no_referral" };

  // 3. Load partner, check active
  const { data: partner } = await supabase
    .from("affiliate_partners")
    .select("id, status, commission_rate_pct")
    .eq("id", referral.partner_id)
    .maybeSingle();
  if (!partner) return { recorded: false, reason: "no_referral" };
  if (partner.status !== "active") {
    return { recorded: false, reason: "partner_inactive" };
  }

  // 4. Compute commission amount
  const amountCents = Math.floor(
    (payment.amount_cents * partner.commission_rate_pct) / 100,
  );

  // 5. Insert (UNIQUE(payment_id) makes this idempotent)
  const { error: insErr } = await supabase.from("affiliate_commissions").insert({
    partner_id: partner.id,
    payment_id: payment.id,
    amount_cents: amountCents,
    status: "pending",
  });
  if (insErr) {
    if (insErr.code === "23505") {
      return { recorded: false, reason: "already_recorded" };
    }
    return { recorded: false, reason: "error", detail: insErr.message };
  }

  return { recorded: true, amountCents, partnerId: partner.id };
}

/**
 * Marks a commission as clawback (refund happened).
 * Tolerates missing row (refund of payment that never had a commission).
 */
export async function recordClawback(
  paymentId: string,
  supabase: SupabaseClient,
): Promise<RecordClawbackResult> {
  const { data, error } = await supabase
    .from("affiliate_commissions")
    .update({ status: "clawback" })
    .eq("payment_id", paymentId)
    .select("id");
  if (error) return { clawed: false, reason: "error" };
  if (!data || data.length === 0) return { clawed: false, reason: "no_commission" };
  return { clawed: true };
}

/**
 * Lazy bump pending → confirmed for rows older than CONFIRM_WINDOW_DAYS days.
 * Called on /admin/affiliates and /partner page loads (no cron required).
 */
export async function confirmCommissions(
  supabase: SupabaseClient,
): Promise<{ confirmed: number }> {
  const cutoff = new Date(Date.now() - CONFIRM_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("affiliate_commissions")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  if (error) return { confirmed: 0 };
  return { confirmed: data?.length ?? 0 };
}

/**
 * Aggregate KPIs for a partner's dashboard.
 */
export async function getPartnerEarnings(
  partnerId: string,
  supabase: SupabaseClient,
): Promise<PartnerEarnings> {
  // Signups: count of referrals where partner_id = X
  const { count: signupsTotal } = await supabase
    .from("affiliate_referrals")
    .select("profile_id", { count: "exact", head: true })
    .eq("partner_id", partnerId);

  // Active paying: referrals where the profile has tier=pro AND subscription_status=active
  // (This is approximate — counts current Pro, not all-time-paying)
  const { data: referrals } = await supabase
    .from("affiliate_referrals")
    .select("profile_id")
    .eq("partner_id", partnerId);
  const profileIds = (referrals ?? []).map((r) => r.profile_id);
  let activePayingCount = 0;
  let mrrCents = 0;
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, tier, subscription_status")
      .in("id", profileIds)
      .eq("tier", "pro")
      .eq("subscription_status", "active");
    activePayingCount = profiles?.length ?? 0;
    // MRR = active paying × 30% × R$30 = active × 900 cents
    // (assumes Pro at R$30 promo; re-derive if pricing changes)
    mrrCents = activePayingCount * 900;
  }

  // Commission totals by status
  const { data: commissions } = await supabase
    .from("affiliate_commissions")
    .select("amount_cents, status, paid_at")
    .eq("partner_id", partnerId);

  let totalEarned = 0;
  let pending = 0;
  let payable = 0;
  let paidAllTime = 0;
  for (const c of commissions ?? []) {
    if (c.status === "clawback") continue;
    totalEarned += c.amount_cents;
    if (c.status === "pending") pending += c.amount_cents;
    if (c.status === "confirmed" && !c.paid_at) payable += c.amount_cents;
    if (c.status === "paid" || c.paid_at) paidAllTime += c.amount_cents;
  }

  return {
    signups_total: signupsTotal ?? 0,
    signups_active_paying: activePayingCount,
    mrr_generated_cents: mrrCents,
    total_earned_cents: totalEarned,
    pending_cents: pending,
    payable_cents: payable,
    paid_all_time_cents: paidAllTime,
  };
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
pnpm test -- src/lib/affiliate/
```

Expected: all tests pass.

### Task 1.6: Stage 1 verification gate + commit

- [ ] **Step 1: Run full gate**

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: all green.

- [ ] **Step 2: Commit Stage 1**

```bash
git add supabase/migrations/0016_affiliate_program.sql src/lib/affiliate/
git commit -m "$(cat <<'EOF'
feat(affiliate): stage 1 - schema + libs foundation

Adiciona migration 0016 com 3 tabelas (affiliate_partners, _referrals,
_commissions) + ALTER profiles.pix_key. RLS, indexes e CHECK constraints.

Libs: code (validate + generate), attribution (attachReferral com
anti-fraude same-email-domain/same-cpf flagging), commission (record,
clawback, lazy confirm 7 dias, getPartnerEarnings aggregate).

Tests: 4 unit suites em code.test.ts + commission.test.ts (mocked
supabase).

Stage 1 nao tem efeito user-visible (sem entry points). Foundation
pra stages 2-6.

Spec: docs/superpowers/specs/2026-05-06-affiliate-program-mvp-design.md
Plan: docs/superpowers/plans/2026-05-06-affiliate-program-mvp.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do NOT push yet — accumulate commits and push at end of session, OR push after each stage if user prefers.

---

## Stage 2: Tracking middleware + signup attribution

**Goal:** Cookie `pv_ref` é setado quando visitante chega com `?ref=CODE`. Signup atribui o user ao partner. Sem comissão ainda — Stage 3 conecta.

### Task 2.1: Middleware update

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Read existing middleware to understand current shape**

Use Read tool on `middleware.ts`. The current file handles www→apex redirect.

- [ ] **Step 2: Add ref capture logic at the top of the middleware function**

The exact diff depends on the existing structure. The pattern to insert:

```ts
const ref = req.nextUrl.searchParams.get("ref");
if (ref && /^[A-Z0-9-]{2,40}$/.test(ref)) {
  const cleanUrl = req.nextUrl.clone();
  cleanUrl.searchParams.delete("ref");
  const res = NextResponse.redirect(cleanUrl);
  res.cookies.set("pv_ref", ref, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90, // 90 days
    path: "/",
  });
  return res;
}
```

This block runs BEFORE any other middleware logic (host redirect comes after). Reason: even on www → apex redirect, we want to preserve the ref. Actually — better to drop the ref param FIRST and let the other middleware do whatever to the cleaned URL. Order:
1. Detect ref → set cookie + redirect to URL without ref
2. (next request after redirect) → other middleware logic kicks in

Confirm matcher in middleware config covers all routes. If matcher excludes some, add the ref logic in those routes' handlers too. Standard matcher recommendation:

```ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.png$).*)",
  ],
};
```

(Don't change matcher if existing one is broader — just confirm it includes `/`, `/pricing`, `/artigos/*`, `/signup`, `/login`.)

- [ ] **Step 3: Verify with manual cookie check**

Run `pnpm dev` (will be done at end of stage). For now: typecheck only.

```bash
pnpm typecheck
```

Expected: green.

### Task 2.2: Signup attribution

**Files:**
- Modify: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Read auth callback to understand profile creation point**

Use Read tool on `src/app/auth/callback/route.ts`.

- [ ] **Step 2: After profile creation, attach referral**

The pattern: after Supabase exchanges the code for a session AND the profile row exists for the user, read `pv_ref` cookie, call `attachReferral`, delete cookie.

```ts
import { cookies } from "next/headers";
import { attachReferral } from "@/lib/affiliate/attribution";

// ... existing code that creates session + profile ...

// After session + profile are confirmed:
const cookieStore = await cookies();
const refCode = cookieStore.get("pv_ref")?.value;
if (refCode && data.session?.user.id) {
  try {
    await attachReferral(data.session.user.id, refCode, supabase);
  } catch (err) {
    console.warn("[affiliate] attribution failed:", err);
  }
  cookieStore.delete("pv_ref");
}
```

Whether this runs in the OAuth callback OR in a separate signup server action depends on the existing flow. If both exist (OAuth + email/password), add the same logic to BOTH.

If there's a server action like `signupAction` in `src/app/signup/actions.ts`, add the same pattern there after profile creation succeeds.

- [ ] **Step 3: Manual sanity test (deferred to end of stage)**

### Task 2.3: Stage 2 verification gate + commit

- [ ] **Step 1: Run full gate**

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: all green.

- [ ] **Step 2: Commit Stage 2**

```bash
git add middleware.ts src/app/auth/callback/route.ts src/app/signup/  # if signup actions.ts changed
git commit -m "$(cat <<'EOF'
feat(affiliate): stage 2 - tracking middleware + signup attribution

Middleware captura ?ref=CODE em qualquer rota, valida formato
[A-Z0-9-]{2,40}, set cookie pv_ref httpOnly 90 dias, redireciona pra
URL sem o param.

Auth callback (e signup action quando aplicavel) le pv_ref pos-signup,
chama attachReferral, deleta cookie. Anti-fraude flags casos de mesmo
domain/CPF (nao bloqueia, deixa visivel pra admin).

Stage 2: cookie funciona, attribution funciona, mas sem comissoes
ainda (Stage 3 conecta no webhook).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage 3: Webhook commission integration + lazy confirm

**Goal:** Quando webhook Asaas confirma payment, comissão é registrada. Refund aciona clawback.

### Task 3.1: Wire commission into webhook handlers

**Files:**
- Modify: `src/lib/billing/webhook.ts`

- [ ] **Step 1: Add commission side-effect after payment confirmation**

The existing `handlePaymentReceived` calls `supabase.rpc("handle_payment_received", ...)`. After it returns success, call `recordCommission(p.id, supabase)`. Use `payments.id` (the asaas-side identifier mapped to our internal payments row).

Wait — the RPC inserts the payments row internally. To get the internal `payments.id`, we need to query AFTER the RPC. Or pass `p.id` (asaas_payment_id) as the lookup key:

```ts
import { recordCommission, recordClawback } from "@/lib/affiliate/commission";

// inside handlePaymentReceived, AFTER the RPC succeeds:
if (!error) {
  // Look up our internal payment id
  const { data: paymentRow } = await supabase
    .from("payments")
    .select("id")
    .eq("asaas_payment_id", p.id)
    .single();
  if (paymentRow?.id) {
    try {
      await recordCommission(paymentRow.id, supabase);
    } catch (err) {
      console.warn("[affiliate] commission record failed:", err);
    }
  }
}
```

Inside `handlePaymentRefunded`, after successful clawback RPC:

```ts
if (!error) {
  const { data: paymentRow } = await supabase
    .from("payments")
    .select("id")
    .eq("asaas_payment_id", p.id)
    .single();
  if (paymentRow?.id) {
    try {
      await recordClawback(paymentRow.id, supabase);
    } catch (err) {
      console.warn("[affiliate] clawback record failed:", err);
    }
  }
}
```

The try/catch ensures webhook still acks 200 even if commission side-effect fails. Idempotency via UNIQUE(payment_id) means re-delivery of the same webhook re-attempts and finds existing row → returns "already_recorded" → no duplicate.

### Task 3.2: Stage 3 verification + commit

- [ ] **Step 1: Run gate**

```bash
pnpm typecheck
pnpm test
pnpm build
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/billing/webhook.ts
git commit -m "$(cat <<'EOF'
feat(affiliate): stage 3 - webhook commission integration

handlePaymentReceived/Confirmed: apos RPC sucesso, recordCommission
(side-effect, try/catch, idempotente via UNIQUE payment_id). Erro
nao bloqueia webhook ack.

handlePaymentRefunded: recordClawback igual. Tolerante a missing
commission row (refund de payment sem referral).

Stage 3: ledger populado automaticamente. Falta UI (stages 4-6).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage 4: Admin UI — `/admin/affiliates`

**Goal:** Founder pode aprovar/suspender parceiros e marcar comissões como pagas. Esta stage shipa ANTES de `/parceiros` porque parceiros pendentes precisam de UI pra aprovar.

### Task 4.1: requirePartner helper + admin actions

**Files:**
- Modify: `src/lib/admin/auth.ts`
- Create: `src/app/admin/affiliates/actions.ts`

- [ ] **Step 1: Add `requirePartner()` to admin/auth.ts**

After the existing `requireAdmin()`, add:

```ts
export async function requirePartner(): Promise<{
  userId: string;
  partnerId: string;
}> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: partner } = await supabase
    .from("affiliate_partners")
    .select("id, status")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!partner) {
    redirect("/parceiros?msg=not-active");
  }

  return { userId: data.user.id, partnerId: partner.id };
}
```

- [ ] **Step 2: Write admin actions**

```ts
// src/app/admin/affiliates/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { confirmCommissions } from "@/lib/affiliate/commission";

export async function approvePartner(partnerId: string): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireAdmin();
  const sb = await createServiceRoleClient();
  const { error } = await sb
    .from("affiliate_partners")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: userId,
    })
    .eq("id", partnerId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/affiliates");
  return { ok: true };
}

export async function denyPartner(partnerId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const sb = await createServiceRoleClient();
  const { error } = await sb
    .from("affiliate_partners")
    .delete()
    .eq("id", partnerId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/affiliates");
  return { ok: true };
}

export async function suspendPartner(partnerId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const sb = await createServiceRoleClient();
  const { error } = await sb
    .from("affiliate_partners")
    .update({ status: "suspended" })
    .eq("id", partnerId)
    .eq("status", "active");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/affiliates");
  return { ok: true };
}

export async function markCommissionsAsPaid(
  partnerId: string,
  commissionIds: string[],
  paidVia: string,
): Promise<{ ok: boolean; error?: string; updated?: number }> {
  await requireAdmin();
  if (commissionIds.length === 0) return { ok: false, error: "no_ids" };
  const sb = await createServiceRoleClient();
  const { data, error } = await sb
    .from("affiliate_commissions")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_via: paidVia,
    })
    .in("id", commissionIds)
    .eq("partner_id", partnerId)
    .eq("status", "confirmed")
    .select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/affiliates");
  return { ok: true, updated: data?.length ?? 0 };
}

export async function refreshConfirmations(): Promise<{ confirmed: number }> {
  await requireAdmin();
  const sb = await createServiceRoleClient();
  return confirmCommissions(sb);
}
```

The `createServiceRoleClient()` helper exists at `src/lib/supabase/admin.ts` (verify its name; if it's different, use the actual name from `requireAdmin()` source).

### Task 4.2: Admin page UI

**Files:**
- Create: `src/app/admin/affiliates/page.tsx`

- [ ] **Step 1: Implement the admin page (server component with sub-tabs)**

```tsx
// src/app/admin/affiliates/page.tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { confirmCommissions } from "@/lib/affiliate/commission";
import { ApprovalDialog } from "@/components/affiliate/ApprovalDialog";
import { PayoutButton } from "@/components/affiliate/PayoutButton";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { tab = "applications" } = await searchParams;
  const sb = await createServiceRoleClient();

  // Lazy bump pending → confirmed for old commissions
  await confirmCommissions(sb);

  // Pending applications
  const { data: pending } = await sb
    .from("affiliate_partners")
    .select("id, code, display_name, bio, notes, created_at, user_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // Active partners with stats
  const { data: active } = await sb
    .from("affiliate_partners")
    .select("id, code, display_name, status, commission_rate_pct, approved_at, user_id")
    .eq("status", "active")
    .order("approved_at", { ascending: false });

  // Suspended partners
  const { data: suspended } = await sb
    .from("affiliate_partners")
    .select("id, code, display_name, approved_at")
    .eq("status", "suspended");

  // Payable per partner: sum of confirmed AND paid_at IS NULL
  const { data: payableAgg } = await sb
    .from("affiliate_commissions")
    .select("partner_id, amount_cents")
    .eq("status", "confirmed")
    .is("paid_at", null);
  const payableByPartner = new Map<string, number>();
  for (const row of payableAgg ?? []) {
    payableByPartner.set(
      row.partner_id,
      (payableByPartner.get(row.partner_id) ?? 0) + row.amount_cents,
    );
  }

  // Total paid all-time
  const { data: paidAgg } = await sb
    .from("affiliate_commissions")
    .select("amount_cents")
    .eq("status", "paid");
  const paidAllTime =
    paidAgg?.reduce((acc, r) => acc + r.amount_cents, 0) ?? 0;

  // MRR committed: sum of MRR generated by active referrals where partner is active
  // (approximate: count(active referrals × 900 cents commission per Pro))
  const { data: activeReferrals } = await sb
    .from("affiliate_referrals")
    .select("profile_id, partner_id, profiles!inner(tier, subscription_status), affiliate_partners!inner(status)")
    .eq("profiles.tier", "pro")
    .eq("profiles.subscription_status", "active")
    .eq("affiliate_partners.status", "active");
  const mrrCommitted = (activeReferrals?.length ?? 0) * 900;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          Affiliates
        </h1>
        <div className="mt-4 flex gap-4 text-sm">
          <Link
            href="/admin/affiliates?tab=applications"
            className={tab === "applications" ? "font-semibold text-orange-700" : "text-ink-2"}
          >
            Aplicações ({pending?.length ?? 0})
          </Link>
          <Link
            href="/admin/affiliates?tab=active"
            className={tab === "active" ? "font-semibold text-orange-700" : "text-ink-2"}
          >
            Ativos ({active?.length ?? 0})
          </Link>
          <Link
            href="/admin/affiliates?tab=suspended"
            className={tab === "suspended" ? "font-semibold text-orange-700" : "text-ink-2"}
          >
            Suspensos ({suspended?.length ?? 0})
          </Link>
          <Link
            href="/admin/affiliates?tab=metrics"
            className={tab === "metrics" ? "font-semibold text-orange-700" : "text-ink-2"}
          >
            Métricas
          </Link>
        </div>
      </header>

      {tab === "applications" && (
        <section>
          {(pending ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">Sem aplicações pendentes.</p>
          ) : (
            <div className="space-y-4">
              {pending!.map((p) => (
                <article key={p.id} className="rounded-xl border border-line bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-ink">{p.display_name}</h2>
                      <p className="mt-1 text-xs text-ink-3">
                        Código: <code className="font-mono">{p.code}</code> · Aplicou em{" "}
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      {p.bio && <p className="mt-3 text-sm text-ink-2">{p.bio}</p>}
                      {p.notes && <p className="mt-2 text-xs italic text-ink-3">Notas internas: {p.notes}</p>}
                    </div>
                    <ApprovalDialog partnerId={p.id} displayName={p.display_name} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "active" && (
        <section>
          {(active ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">Nenhum parceiro ativo.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-ink-3">
                <tr>
                  <th className="py-2">Nome</th>
                  <th>Código</th>
                  <th>Comissão</th>
                  <th>A pagar</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {active!.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-3 font-medium">{p.display_name}</td>
                    <td><code className="font-mono">{p.code}</code></td>
                    <td>{p.commission_rate_pct}%</td>
                    <td>R$ {((payableByPartner.get(p.id) ?? 0) / 100).toFixed(2)}</td>
                    <td>
                      <PayoutButton
                        partnerId={p.id}
                        payableCents={payableByPartner.get(p.id) ?? 0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "suspended" && (
        <section>
          {(suspended ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">Nenhum suspenso.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {suspended!.map((p) => (
                <li key={p.id} className="rounded border border-line p-3">
                  {p.display_name} ({p.code})
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "metrics" && (
        <section className="grid gap-4 md:grid-cols-3">
          <KPI label="Total pago all-time" value={`R$ ${(paidAllTime / 100).toFixed(2)}`} />
          <KPI label="MRR comprometido" value={`R$ ${(mrrCommitted / 100).toFixed(2)}/mês`} />
          <KPI label="A pagar agora" value={`R$ ${(Array.from(payableByPartner.values()).reduce((a, b) => a + b, 0) / 100).toFixed(2)}`} />
        </section>
      )}
    </main>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

// PayoutButton imported from a separate client component file. See Task 4.3b.
```

**Implementer note:** Above is a skeleton. The actual PayoutControls implementation requires a client component. For v1 keep simple: render a link to `/admin/affiliates/payout?partner=ID` (a separate page) that lists the confirmed-not-paid commissions for the partner, with a form `paid_via` and submit button calling `markCommissionsAsPaid`. Don't over-engineer with inline dialogs. If time permits, implement the dialog inline; otherwise the separate page is acceptable v1 UX.

### Task 4.3: ApprovalDialog client component

**Files:**
- Create: `src/components/affiliate/ApprovalDialog.tsx`
- Create: `src/components/affiliate/ApprovalDialog.test.tsx`

- [ ] **Step 1: Implement ApprovalDialog**

```tsx
"use client";

import { useState, useTransition } from "react";
import { approvePartner, denyPartner } from "@/app/admin/affiliates/actions";

export function ApprovalDialog({
  partnerId,
  displayName,
}: {
  partnerId: string;
  displayName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await approvePartner(partnerId);
      if (!res.ok) setError(res.error ?? "Erro");
    });
  };

  const handleDeny = () => {
    if (!confirm(`Negar aplicação de ${displayName}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await denyPartner(partnerId);
      if (!res.ok) setError(res.error ?? "Erro");
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={pending}
          className="rounded-pill bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          Aprovar
        </button>
        <button
          type="button"
          onClick={handleDeny}
          disabled={pending}
          className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-bg disabled:opacity-50"
        >
          Negar
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Test**

```tsx
// src/components/affiliate/ApprovalDialog.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ApprovalDialog } from "./ApprovalDialog";

vi.mock("@/app/admin/affiliates/actions", () => ({
  approvePartner: vi.fn(async () => ({ ok: true })),
  denyPartner: vi.fn(async () => ({ ok: true })),
}));

describe("<ApprovalDialog />", () => {
  it("renders Aprovar and Negar buttons", () => {
    const { getByRole } = render(<ApprovalDialog partnerId="p-1" displayName="Ana" />);
    expect(getByRole("button", { name: /aprovar/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /negar/i })).toBeInTheDocument();
  });

  it("calls approvePartner on Aprovar click", async () => {
    const { approvePartner } = await import("@/app/admin/affiliates/actions");
    const { getByRole } = render(<ApprovalDialog partnerId="p-1" displayName="Ana" />);
    fireEvent.click(getByRole("button", { name: /aprovar/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(approvePartner).toHaveBeenCalledWith("p-1");
  });
});
```

### Task 4.3b: PayoutButton client component + markAllPayablePaid action

**Files:**
- Create: `src/components/affiliate/PayoutButton.tsx`
- Modify: `src/app/admin/affiliates/actions.ts` (add `markAllPayablePaid`)

- [ ] **Step 1: Add the action**

Add to `src/app/admin/affiliates/actions.ts`:

```ts
export async function markAllPayablePaid(
  partnerId: string,
  paidVia: string,
): Promise<{ ok: boolean; error?: string; updated?: number }> {
  await requireAdmin();
  if (!paidVia.trim()) return { ok: false, error: "paid_via obrigatório" };
  const sb = await createServiceRoleClient();
  const { data, error } = await sb
    .from("affiliate_commissions")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_via: paidVia,
    })
    .eq("partner_id", partnerId)
    .eq("status", "confirmed")
    .is("paid_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/affiliates");
  return { ok: true, updated: data?.length ?? 0 };
}
```

- [ ] **Step 2: Implement PayoutButton**

```tsx
// src/components/affiliate/PayoutButton.tsx
"use client";

import { useState, useTransition } from "react";
import { markAllPayablePaid } from "@/app/admin/affiliates/actions";

export function PayoutButton({
  partnerId,
  payableCents,
}: {
  partnerId: string;
  payableCents: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (payableCents <= 0) {
    return <span className="text-xs text-ink-3">—</span>;
  }

  const handleClick = () => {
    const paidVia = prompt(
      `Confirmar pagamento de R$ ${(payableCents / 100).toFixed(2)} para este parceiro?\n\nDescreva como pagou (ex: "Pix - chave: ana@example.com - 2026-05-06"):`,
    );
    if (!paidVia || !paidVia.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await markAllPayablePaid(partnerId, paidVia.trim());
      if (!res.ok) setError(res.error ?? "Erro");
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-pill bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {pending ? "Marcando..." : "Marcar pago"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
```

The `prompt()` UX is intentionally minimal for v1. Replace with a proper dialog modal in v1.1 if needed.

### Task 4.4: Stage 4 verification + commit

```bash
pnpm typecheck
pnpm test
pnpm build
git add src/lib/admin/auth.ts src/app/admin/affiliates/ src/components/affiliate/ApprovalDialog.tsx src/components/affiliate/ApprovalDialog.test.tsx src/components/affiliate/PayoutButton.tsx
git commit -m "feat(affiliate): stage 4 - admin UI for partner management"
```

---

## Stage 5: Public `/parceiros` + apply flow

**Goal:** Pessoas podem aplicar pra ser parceiro. Cria row pending. Founder aprova via Stage 4.

### Task 5.1: PartnerForm component

**Files:**
- Create: `src/components/affiliate/PartnerForm.tsx`
- Create: `src/components/affiliate/PartnerForm.test.tsx`

- [ ] **Step 1: Implement form (client component)**

```tsx
"use client";

import { useState, useTransition } from "react";
import { applyAsAffiliate } from "@/app/parceiros/actions";
import { generateCodeFromName, validateCode } from "@/lib/affiliate/code";

export function PartnerForm({ defaultName = "" }: { defaultName?: string }) {
  const [displayName, setDisplayName] = useState(defaultName);
  const [code, setCode] = useState(generateCodeFromName(defaultName));
  const [bio, setBio] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [why, setWhy] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleNameChange = (v: string) => {
    setDisplayName(v);
    if (!code || code === generateCodeFromName(displayName)) {
      setCode(generateCodeFromName(v));
    }
  };

  const codeValid = validateCode(code);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!codeValid) {
      setError("Código inválido (2-40 caracteres, A-Z, 0-9, hífen)");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("display_name", displayName);
      fd.set("code", code);
      fd.set("bio", bio);
      fd.set("pix_key", pixKey);
      fd.set("why", why);
      const res = await applyAsAffiliate(fd);
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.error ?? "Erro ao aplicar");
      }
    });
  };

  if (success) {
    return (
      <div className="rounded-xl border-2 border-green-500 bg-green-soft/30 p-6">
        <h2 className="text-lg font-bold text-green-700">Aplicação enviada!</h2>
        <p className="mt-2 text-sm text-ink-2">
          Recebemos sua aplicação e respondemos em até 7 dias úteis no e-mail da
          sua conta.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome ou nome do canal" required>
        <input
          type="text"
          value={displayName}
          onChange={(e) => handleNameChange(e.target.value)}
          required
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </Field>
      <Field label="Código de afiliado (será o ?ref=)" required hint={codeValid ? `prepavaga.com.br/?ref=${code}` : "Use só A-Z, 0-9 e hífen, 2-40 chars"}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
          maxLength={40}
          className="w-full rounded-md border border-line bg-white px-3 py-2 font-mono"
        />
      </Field>
      <Field label="Bio curta" hint="Até 280 caracteres. Aparece pro time de aprovação.">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </Field>
      <Field label="Chave Pix (pra receber pagamentos)" required>
        <input
          type="text"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          required
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </Field>
      <Field label="Pra que público você fala? Por que quer divulgar PrepaVAGA?" required>
        <textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          required
          rows={4}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
          placeholder="Ex: tenho um podcast de carreira com 5k ouvintes mensais. Acho que PrepaVAGA cobre exatamente o gap entre 'corrigi meu CV' e 'estou pronto pra entrevista'..."
        />
      </Field>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={pending || !codeValid}
        className="rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Aplicar"}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-orange-700"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </label>
  );
}
```

- [ ] **Step 2: Test**

```tsx
// src/components/affiliate/PartnerForm.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PartnerForm } from "./PartnerForm";

vi.mock("@/app/parceiros/actions", () => ({
  applyAsAffiliate: vi.fn(async () => ({ ok: true })),
}));

describe("<PartnerForm />", () => {
  it("renders all required fields", () => {
    const { getByLabelText } = render(<PartnerForm />);
    expect(getByLabelText(/nome ou nome do canal/i)).toBeInTheDocument();
    expect(getByLabelText(/código/i)).toBeInTheDocument();
    expect(getByLabelText(/chave pix/i)).toBeInTheDocument();
    expect(getByLabelText(/que público/i)).toBeInTheDocument();
  });

  it("auto-generates code from name initially", () => {
    const { getByDisplayValue } = render(<PartnerForm defaultName="Ana Costa" />);
    expect(getByDisplayValue("ANA-COSTA")).toBeInTheDocument();
  });

  it("shows success after submit", async () => {
    const { getByRole, getByText, getByLabelText } = render(<PartnerForm />);
    fireEvent.change(getByLabelText(/nome ou nome do canal/i), { target: { value: "Test User" } });
    fireEvent.change(getByLabelText(/chave pix/i), { target: { value: "test@example.com" } });
    fireEvent.change(getByLabelText(/que público/i), { target: { value: "I have an audience" } });
    fireEvent.click(getByRole("button", { name: /aplicar/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(getByText(/aplicação enviada/i)).toBeInTheDocument();
  });
});
```

### Task 5.2: applyAsAffiliate server action

**Files:**
- Create: `src/app/parceiros/actions.ts`

```ts
// src/app/parceiros/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { validateCode } from "@/lib/affiliate/code";

export async function applyAsAffiliate(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) {
    redirect("/signup?next=/parceiros");
  }

  const displayName = String(formData.get("display_name") || "").trim();
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const bio = String(formData.get("bio") || "").trim() || null;
  const pixKey = String(formData.get("pix_key") || "").trim();
  const why = String(formData.get("why") || "").trim();

  if (!displayName || displayName.length < 2) return { ok: false, error: "Nome inválido" };
  if (!validateCode(code)) return { ok: false, error: "Código inválido (A-Z, 0-9, hífen, 2-40 chars)" };
  if (!pixKey) return { ok: false, error: "Chave Pix obrigatória" };
  if (!why || why.length < 30) return { ok: false, error: "Conta um pouco mais sobre seu público (mínimo 30 chars)" };

  const admin = await createServiceRoleClient();

  // Already applied?
  const { data: existing } = await admin
    .from("affiliate_partners")
    .select("id, status")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "Você já aplicou. Status atual: " + existing.status };
  }

  // Code uniqueness check
  const { data: codeTaken } = await admin
    .from("affiliate_partners")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (codeTaken) {
    return { ok: false, error: "Este código já está em uso. Escolha outro." };
  }

  // Update profile pix_key
  await admin.from("profiles").update({ pix_key: pixKey }).eq("id", data.user.id);

  // Insert partner
  const { error } = await admin.from("affiliate_partners").insert({
    user_id: data.user.id,
    code,
    display_name: displayName,
    bio,
    notes: `Audiência/Por quê:\n${why}`,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/parceiros");
  return { ok: true };
}
```

### Task 5.3: /parceiros page

**Files:**
- Create: `src/app/parceiros/page.tsx`

```tsx
// src/app/parceiros/page.tsx
import type { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { PartnerForm } from "@/components/affiliate/PartnerForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Programa de Parceiros — 30% recorrente vitalício",
  description:
    "Vire parceiro PrepaVAGA. 30% recorrente vitalício sobre cada cliente que você indicar. Pra coaches, recrutadores, criadores de conteúdo de carreira.",
  alternates: { canonical: "/parceiros" },
};

export default async function ParceirosPage() {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  const isLoggedIn = !!data.user;
  const profile = isLoggedIn
    ? await sb.from("profiles").select("full_name").eq("id", data.user!.id).single()
    : null;

  return (
    <>
      <LandingNavbar />
      <main className="bg-bg">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <header className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Programa de Parceiros
            </p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
              Indique e ganhe 30% recorrente vitalício
            </h1>
            <p className="mt-4 text-lg text-ink-2">
              Pra cada cliente Pro que você trouxer (R$30/mês), você ganha R$9
              todo mês, enquanto eles forem clientes. Sem teto, sem prazo.
            </p>
          </header>

          <section className="mt-14 grid gap-8 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Pra quem</p>
              <p className="mt-2 text-sm text-ink-2">
                Career coaches, recrutadores, RH consultants, criadores de
                conteúdo de carreira no LinkedIn/IG/TikTok/YouTube.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Como funciona</p>
              <p className="mt-2 text-sm text-ink-2">
                Você aplica → aprovamos em até 7 dias → divulga seu link único
                → ganha 30% sobre cada pagamento dos clientes que vieram pelo
                seu link, vitalício.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Pagamento</p>
              <p className="mt-2 text-sm text-ink-2">
                Mensalmente via Pix na sua chave cadastrada. Comissões liberam
                7 dias após o pagamento (janela de reembolso).
              </p>
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-2xl font-bold text-ink">Aplicar</h2>
            {!isLoggedIn ? (
              <div className="mt-4 rounded-xl border-2 border-orange-500 bg-orange-soft/30 p-6">
                <p className="text-sm text-ink-2">
                  Você precisa estar logado pra aplicar.{" "}
                  <a href="/signup?next=/parceiros" className="font-semibold text-orange-700 underline">
                    Criar conta grátis
                  </a>{" "}
                  ou{" "}
                  <a href="/login?next=/parceiros" className="font-semibold text-orange-700 underline">
                    entrar
                  </a>
                  .
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <PartnerForm defaultName={profile?.data?.full_name ?? ""} />
              </div>
            )}
          </section>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
```

### Task 5.4: Stage 5 verification + commit

```bash
pnpm typecheck
pnpm test
pnpm build
git add src/app/parceiros/ src/components/affiliate/
git commit -m "feat(affiliate): stage 5 - public /parceiros page + apply flow"
```

---

## Stage 6: `/partner` dashboard

**Goal:** Parceiros aprovados (active) veem link de afiliado, KPIs, histórico de comissões, podem editar Pix key.

### Task 6.1: CodeBox + EarningsCard

**Files:**
- Create: `src/components/affiliate/CodeBox.tsx`
- Create: `src/components/affiliate/CodeBox.test.tsx`
- Create: `src/components/affiliate/EarningsCard.tsx`

```tsx
// src/components/affiliate/CodeBox.tsx
"use client";

import { useState } from "react";

export function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://prepavaga.com.br/?ref=${code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
        Seu link de afiliado
      </p>
      <div className="mt-3 flex items-center gap-3">
        <code className="flex-1 rounded-md bg-bg px-3 py-2 font-mono text-sm text-ink-2 break-all">
          {url}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-pill bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700"
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
```

```tsx
// src/components/affiliate/CodeBox.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CodeBox } from "./CodeBox";

describe("<CodeBox />", () => {
  it("renders the affiliate URL with code", () => {
    const { getByText } = render(<CodeBox code="ANA-COACH" />);
    expect(getByText(/prepavaga.com.br\/\?ref=ANA-COACH/)).toBeInTheDocument();
  });

  it("calls clipboard.writeText on Copiar click", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { getByRole } = render(<CodeBox code="ANA-COACH" />);
    fireEvent.click(getByRole("button", { name: /copiar/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(writeText).toHaveBeenCalledWith(
      "https://prepavaga.com.br/?ref=ANA-COACH",
    );
  });
});
```

```tsx
// src/components/affiliate/EarningsCard.tsx
export function EarningsCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border ${accent ? "border-orange-500 bg-orange-soft/30" : "border-line bg-white"} p-5`}>
      <p className="text-xs uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-orange-700" : "text-ink"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
```

### Task 6.2: Partner dashboard page + actions

**Files:**
- Create: `src/app/(app)/partner/page.tsx`
- Create: `src/app/(app)/partner/actions.ts`

```ts
// src/app/(app)/partner/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updatePixKey(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: "Não autenticado" };
  const pixKey = String(formData.get("pix_key") || "").trim();
  if (!pixKey) return { ok: false, error: "Chave Pix obrigatória" };
  const { error } = await sb.from("profiles").update({ pix_key: pixKey }).eq("id", data.user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/partner");
  return { ok: true };
}
```

```tsx
// src/app/(app)/partner/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { confirmCommissions, getPartnerEarnings } from "@/lib/affiliate/commission";
import { CodeBox } from "@/components/affiliate/CodeBox";
import { EarningsCard } from "@/components/affiliate/EarningsCard";

export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage() {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login?next=/partner");

  const { data: partner } = await sb
    .from("affiliate_partners")
    .select("id, code, display_name, status, commission_rate_pct, created_at, approved_at")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!partner) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="text-3xl font-bold text-ink">Você ainda não é parceiro</h1>
        <p className="mt-3 text-sm text-ink-2">
          Aplique pelo programa de parceiros pra começar a ganhar 30% recorrente.
        </p>
        <a
          href="/parceiros"
          className="mt-6 inline-block rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Aplicar →
        </a>
      </main>
    );
  }

  if (partner.status === "pending") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="text-2xl font-bold text-ink">Aplicação em análise</h1>
        <p className="mt-3 text-sm text-ink-2">
          Recebemos sua aplicação ({partner.display_name}). Respondemos em até 7
          dias úteis no e-mail da sua conta.
        </p>
      </main>
    );
  }

  if (partner.status === "suspended") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="text-2xl font-bold text-ink">Sua conta de parceiro foi suspensa</h1>
        <p className="mt-3 text-sm text-ink-2">
          Entre em contato:{" "}
          <a href="mailto:prepavaga@prepavaga.com.br" className="text-orange-700 underline">
            prepavaga@prepavaga.com.br
          </a>
        </p>
      </main>
    );
  }

  // Active partner
  const admin = await createServiceRoleClient();
  await confirmCommissions(admin); // lazy bump

  const earnings = await getPartnerEarnings(partner.id, admin);

  // Recent commissions for history table
  const { data: commissions } = await admin
    .from("affiliate_commissions")
    .select("id, payment_id, amount_cents, status, created_at, paid_at")
    .eq("partner_id", partner.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          Dashboard do parceiro
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          {partner.display_name} · código <code className="font-mono">{partner.code}</code> ·
          comissão {partner.commission_rate_pct}%
        </p>
      </header>

      <CodeBox code={partner.code} />

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EarningsCard label="Indicações totais" value={String(earnings.signups_total)} />
        <EarningsCard
          label="Pagantes ativos"
          value={String(earnings.signups_active_paying)}
          hint="Clientes Pro com assinatura ativa"
        />
        <EarningsCard
          label="MRR gerado"
          value={`R$ ${(earnings.mrr_generated_cents / 100).toFixed(2)}/mês`}
        />
        <EarningsCard
          label="A receber"
          value={`R$ ${(earnings.payable_cents / 100).toFixed(2)}`}
          hint="Confirmado e aguardando pagamento"
          accent
        />
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <EarningsCard label="Total ganho all-time" value={`R$ ${(earnings.total_earned_cents / 100).toFixed(2)}`} />
        <EarningsCard label="Aguardando confirmação" value={`R$ ${(earnings.pending_cents / 100).toFixed(2)}`} hint="Janela de 7 dias após pagamento" />
        <EarningsCard label="Já recebido" value={`R$ ${(earnings.paid_all_time_cents / 100).toFixed(2)}`} />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-ink">Histórico</h2>
        {(commissions ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-ink-3">Nenhuma comissão ainda. Compartilhe seu link!</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase text-ink-3">
              <tr>
                <th className="py-2">Data</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Pago em</th>
              </tr>
            </thead>
            <tbody>
              {commissions!.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-3">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                  <td>R$ {(c.amount_cents / 100).toFixed(2)}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>{c.paid_at ? new Date(c.paid_at).toLocaleDateString("pt-BR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "bg-yellow-soft text-yellow-700" },
    confirmed: { label: "Confirmado", cls: "bg-orange-soft text-orange-700" },
    paid: { label: "Pago", cls: "bg-green-soft text-green-700" },
    clawback: { label: "Estornado", cls: "bg-red-soft text-red-500" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-bg text-ink-3" };
  return (
    <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
```

### Task 6.3: Stage 6 verification + commit

```bash
pnpm typecheck
pnpm test
pnpm build
git add src/app/\(app\)/partner/ src/components/affiliate/
git commit -m "feat(affiliate): stage 6 - partner dashboard"
```

---

## Final Push

After all 6 stages committed:

```bash
git push origin main
```

If permission blocked: ask user to push manually (per Spec 1 Stage 9 pattern).

After Railway deploy, smoke-test the flow with founder as test partner:
1. Visit prepavaga.com.br/?ref=TEST-FOUNDER → cookie set
2. Open new account in incognito → signup → check `affiliate_referrals` row created
3. Pay R$10 sandbox → check `affiliate_commissions` row created
4. Check /admin/affiliates lists the pending application from the founder's apply
5. Approve → login as founder → /partner shows dashboard

---

## Definition of Done

All 6 stages complete and pushed. Specifically:
- Migration 0016 applied in production.
- All 6 stage commits in main.
- Smoke test passed in production: signup with ref → commission appears within 5 seconds of payment.
- All existing tests pass + ~30 new tests added pass.
- typecheck + build green.

---

## Implementation order recommendation

Execute stages sequentially via subagent-driven-development:
1. Stage 1 → review → commit
2. Stage 2 → review → commit
3. Stage 3 → review → commit
4. Stage 4 → review → commit
5. Stage 5 → review → commit
6. Stage 6 → review → commit
7. Push + smoke test

Each stage is one implementer dispatch + spec compliance review + code quality review. Multi-day project (~6-8 hours of focused work, depending on issues found).
