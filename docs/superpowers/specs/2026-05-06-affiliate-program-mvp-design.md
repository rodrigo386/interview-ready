# Affiliate Program MVP — Design

**Date:** 2026-05-06
**Status:** Draft → awaiting user review
**Scope:** Spec 5 of session. Multi-day project (~15 files, 700-1000 LOC). Distinct from prior session specs which were surgical (1-PR each).

---

## Background

PrepaVAGA está em produção desde 2026-04-27 mas ainda não tem canal de aquisição alavancado. Plays de tráfego comuns (LinkedIn orgânico, conteúdo SEO, paid) demandam ou tempo do founder ou caixa que não existe ainda. Affiliate program transfere o trabalho de marketing pra terceiros (recrutadores, coaches, criadores de carreira no LinkedIn/IG/TikTok) em troca de comissão sobre receita gerada.

Decisões definidas no brainstorm:
- **Modelo:** curated (founder aprova manualmente cada parceiro)
- **Comissão:** 30% recorrente vitalício sobre Pro (R$30/mês = R$9/mês recorrente) e Avulso (R$10 = R$3 one-time por compra)
- **Single-tier:** todos parceiros aprovados ganham 30%; coluna `commission_rate_pct` no schema deixa porta aberta pra tiers futuros
- **Atribuição:** first-touch lifetime, janela de 90 dias entre clique e signup
- **Pagamento:** manual Pix mensal (sem Asaas split na v1)

Curated reduz drasticamente fraude vs auto-serve (sem fila de fake accounts criadas com próprio link). Em troca, scaling é limitado pela bandwidth do founder em aprovar — endereçado por CTA "respondemos em até 7 dias" + tier auto-serve futuro como upgrade.

---

## Goal

Lançar um affiliate program MVP funcional em produção que: (1) permita parceiros aplicarem via `/parceiros`, (2) atribua signups via `?ref=CODE` durante 90 dias após primeiro clique, (3) registre comissões automaticamente quando webhook Asaas confirma payment, (4) permita ao founder gerenciar aprovações + pagamentos via `/admin/affiliates`, (5) dê ao parceiro um dashboard `/partner` com KPIs e histórico.

## Non-goals (v1)

- Auto-serve (qualquer um vira affiliate sem aprovação)
- Sistema de tiers (Pro Affiliate, top performer, etc.) — todos no 30%
- Asaas split automático (manual Pix v1)
- E-mail automático ao parceiro quando comissão é registrada/paga
- Materiais marketing (banners, copy templates, social media kits) — parceiros usam o que quiserem
- Tracking de cliques (só conversões: `?ref=CODE` chega → signup → payment)
- Sub-codes (campaigns dentro de um parceiro)
- Multi-currency (BRL only)
- Internacionalização do `/parceiros` (PT-BR only)
- Dashboard analytics avançado (CTR, funil, cohort) — KPIs simples na v1
- A/B testing de copy do `/parceiros`
- Refund automation além de marcar `clawback` (founder lida com Asaas dispute manual)

## Confirmed via codebase exploration

- `middleware.ts` já existe e faz redirect www→apex via `next.config.ts redirects()`. Para query param capture, vou usar `middleware.ts` real (criar se não usar matcher abrangente).
- `payments` table existe com `id`, `user_id`, `asaas_payment_id`, `kind`, `amount_cents`, `status`. Comissões referenciam `payments.id` via FK.
- `subscription_events` table com `asaas_event_id` UNIQUE serve de idempotency check pra webhook handler.
- Webhook handler em `src/lib/billing/webhook.ts` já tem `dispatchEvent` idempotente e processa eventos `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`, etc. Hook de comissão entra como side-effect adicional.
- `requireAdmin()` em `src/lib/admin/auth.ts` já existe. Vou adicionar `requirePartner()` paralelo.
- `(app)/` route group já existe pra rotas autenticadas (`profile`, `dashboard`, `welcome/pro`). `(app)/partner/` cabe naturalmente.
- Migrations vão até `0015` (profile address). Próxima é `0016`.
- `getAdminOverview()` e `getHistoricalSeries()` em `src/lib/admin/metrics.ts` são padrão pra dados agregados; sigo o mesmo shape pra `getAffiliateOverview()`.

---

## Architecture

### Tracking & attribution flow

```
1. Visitor lands on prepavaga.com.br/?ref=ANA-COACH (qualquer rota)
2. middleware.ts:
   - matches: ALL routes except /_next, /api, /favicon, /robots.txt, /sitemap.xml
   - if req.nextUrl.searchParams.has("ref"):
     - validate format /^[A-Z0-9-]{2,40}$/
     - if valid: NextResponse with Set-Cookie pv_ref=CODE; HttpOnly; SameSite=Lax; Max-Age=7776000 (90d); Path=/
     - redirect to same URL with ref param removed
3. User navigates anonymously, cookie persists for 90 days
4. User signs up at /signup → server action signupUser()
5. signupUser() reads cookie via cookies().get("pv_ref")
6. attachReferral(profileId, refCode) called:
   - lookup affiliate_partners where code=CODE and status='active'
   - if found: insert affiliate_referrals (profile_id, partner_id, attributed_at=now)
   - if not found or self-referral or fraud check fails: skip silently
   - delete cookie regardless
7. From this moment forward, every payments row for this profile_id triggers commission recording
```

### Commission lifecycle

```
1. User pays Pro subscription R$30 → Asaas confirms → webhook fires PAYMENT_CONFIRMED
2. webhook.ts dispatchEvent reads payments row, finds linked profile_id
3. recordCommission(paymentId) called:
   - SELECT affiliate_referrals WHERE profile_id = payment.user_id
   - if not referred: skip
   - if partner.status != 'active': skip (suspended partners get nothing for new payments)
   - INSERT affiliate_commissions (partner_id, payment_id, amount_cents=30%*payment.amount, status='pending')
   - UNIQUE constraint on payment_id makes it idempotent (webhook re-delivery is safe)
4. After 7 days from payment.created_at, status auto-bumps to 'confirmed' lazily:
   - confirmCommissions() helper called on /admin/affiliates page load and /partner page load
   - UPDATE affiliate_commissions SET status='confirmed', confirmed_at=now()
     WHERE status='pending' AND created_at < now() - interval '7 days'
   - Lazy approach avoids needing cron (project doesn't have one yet)
5. Refund within 7 days: PAYMENT_REFUNDED webhook → recordClawback(paymentId)
   - UPDATE affiliate_commissions SET status='clawback' WHERE payment_id=X
   - If status was already 'paid' (founder paid before refund happened — race), the row stays as
     'clawback' and the negative balance carries to next month's payout calc
6. Founder pays partner manually:
   - Goes to /admin/affiliates, sees pending payable per partner (status='confirmed' AND paid_at IS NULL)
   - Sums per partner, transfers Pix using partner.pix_key
   - Marks rows as paid: UPDATE ... SET status='paid', paid_at=now(), paid_via='pix:KEY'
```

### Anti-fraud rules (curated still benefits from these)

1. **Self-referral:** `affiliate_referrals.profile_id == affiliate_partners.user_id` → bloqueia atribuição (silent skip + log).
2. **Same email domain:** se `referred_user.email` e `partner.user.email` compartilham domain (após `@`) → atribuição prossegue mas com `flagged_for_review=true`. Founder vê em `/admin/affiliates` antes de aprovar primeira comissão.
3. **Same CPF:** `profiles.cpf_cnpj == partner.user.cpf_cnpj` → mesmo tratamento (flag, não bloqueia).
4. **Refund clawback:** automático via webhook handler.
5. **Suspended partner gets nothing for NEW payments:** se partner foi suspended, payments criados após suspensão não geram commission rows. Comissões pendentes/confirmed pré-suspensão continuam normais.

Não cobre: VPN/IP-spoofing-based abuse (não viable de implementar com confiabilidade), parceiros conluiando para cross-refer entre si (problema de governança humana).

---

## Schema

Migration `supabase/migrations/0016_affiliate_program.sql`:

```sql
-- Pix key on profiles (used by partner payouts)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- Parceiros aprovados
CREATE TABLE public.affiliate_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,                                       -- short bio shown on /parceiros if you ever do a public listing (deferred but column exists)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  commission_rate_pct INT NOT NULL DEFAULT 30
    CHECK (commission_rate_pct BETWEEN 0 AND 100),
  notes TEXT,                                      -- internal admin notes
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partners_code_active ON affiliate_partners(code) WHERE status = 'active';
CREATE INDEX idx_partners_user ON affiliate_partners(user_id);

-- Atribuições: 1:1 com profiles (cada user pode ter no máximo 1 partner que o atribuiu)
CREATE TABLE public.affiliate_referrals (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE RESTRICT,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  flagged_for_review BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT
);

CREATE INDEX idx_referrals_partner ON affiliate_referrals(partner_id);

-- Ledger de comissões: 1 linha por payment (idempotent)
CREATE TABLE public.affiliate_commissions (
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

CREATE INDEX idx_commissions_partner_status ON affiliate_commissions(partner_id, status);
CREATE INDEX idx_commissions_status_created ON affiliate_commissions(status, created_at);

-- RLS
ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- affiliate_partners: user lê só o próprio
CREATE POLICY "Partners can view own row"
  ON public.affiliate_partners
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE: service_role only (admin operations)
-- (no policy = no access for authenticated)

-- affiliate_referrals: NO policy for authenticated (privacy: user shouldn't see who referred them; partner sees aggregate via JOIN with own commissions)
-- service_role only

-- affiliate_commissions: partner sees own via JOIN
CREATE POLICY "Partners can view own commissions"
  ON public.affiliate_commissions
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM public.affiliate_partners WHERE user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: service_role only

-- Optional: pix_key column-level security
-- profiles.pix_key only readable by user themselves (already covered by existing profiles RLS pattern)
```

**Why pix_key on profiles, not on affiliate_partners?** Because the partner is a User. Pix is the User's payment instrument. If the same user later becomes a customer paying for Pro, the same pix_key column structure makes sense (refund target). DRY > separate column.

---

## Components

### Middleware (`middleware.ts`)

Already exists for www→apex redirect. Add the `?ref=` capture **before** the redirect logic. Use `NextResponse.next({ headers: ... })` to set cookie, then issue redirect to URL without `ref` param. Matcher updated to include all paths except `/_next/*`, `/api/*`, static files.

```ts
// pseudo-code shape (full code in plan)
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

### Affiliate libs (`src/lib/affiliate/*`)

- `code.ts` — `validateCode(input)`, `generateCodeFromName(displayName)` (uppercases + dedupes hyphens + length cap)
- `attribution.ts` — `attachReferral(profileId, refCode)` server-only, runs anti-fraud checks, inserts into `affiliate_referrals`
- `commission.ts` — `recordCommission(paymentId)`, `recordClawback(paymentId)`, `confirmCommissions()` (lazy), `getPartnerEarnings(partnerId)` (aggregate query)
- `types.ts` — TypeScript types matching DB

### Webhook integration (`src/lib/billing/webhook.ts`)

Add to existing `dispatchEvent`:
- After `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED` upserts: call `recordCommission(paymentId)`
- After `PAYMENT_REFUNDED`: call `recordClawback(paymentId)`

Both calls are wrapped in try/catch — affiliate side-effect failures must NOT break webhook processing (webhook idempotency depends on the `subscription_events` row being inserted regardless of side-effects).

### Signup integration

Existing signup flow lives in `src/app/auth/callback/route.ts` (post-OAuth handler). For email/password signup, the `signupAction` server action.

In both, after the `profiles` row is created, call `attachReferral(profileId, cookies().get("pv_ref")?.value)`. Ignore failures (user shouldn't see anything go wrong if attribution fails).

After call: `cookies().delete("pv_ref")` regardless.

### Public page: `/parceiros`

`src/app/parceiros/page.tsx` — landing page, server component.

Sections:
- Hero: "Vire parceiro PrepaVAGA — 30% recorrente vitalício"
- "Pra quem é": recrutadores, career coaches, RH consultants, criadores de conteúdo de carreira
- "Como funciona": 4 steps (aplique → aprovamos → divulgue → receba mensalmente)
- FAQ: comissão, prazo de aprovação, como recebe pagamento, quem é elegível
- Form: display_name, bio (max 280), proposed code (validate format), pix_key, why (textarea, what audience)
- CTA: "Aplicar" → server action `applyAsAffiliate(formData)` → cria `affiliate_partners` row com `status='pending'` + cria/atualiza `profiles.pix_key`

Form requires authenticated user (redirects to /signup with `?next=/parceiros`). Reason: the partner IS a user; we need their `auth.users.id` for the FK.

### Authenticated pages

**`src/app/(app)/partner/page.tsx`** — Partner dashboard.

Server component. Reads `affiliate_partners` row for current user.
- If no row: render CTA "Você ainda não é parceiro. Aplique em /parceiros."
- If `status='pending'`: render "Sua aplicação está em análise. Resposta em até 7 dias."
- If `status='active'`:
  - Card: link único `https://prepavaga.com.br/?ref={CODE}` + Copy button (client component `<CopyButton>`)
  - Card KPIs: signups all-time, signups ativos pagantes, MRR atual gerado (sum dos pagamentos Pro ativos × 30%), total ganho all-time, pendente confirmação, a receber este mês
  - Tabela: histórico paginado de commissions (data, payment.kind, amount, status badge)
  - Card: dados de pagamento (read-only se já tem pix_key + edit dialog se quiser trocar)
- If `status='suspended'`: render "Sua conta de parceiro foi suspensa. Entre em contato: prepavaga@prepavaga.com.br"

**`src/app/admin/affiliates/page.tsx`** — Admin gestão.

Server component, gated by `requireAdmin()`.
- Tabs: Aplicações (status=pending) | Ativos | Suspensos | Pagamentos | Métricas
- Aplicações: tabela com display_name, code proposto, bio, why, audience size? (texto livre), botões "Aprovar" / "Negar" (delete row)
- Ativos: tabela com partner + signups + MRR gerado + total devido este mês + botão "Suspender"
- Pagamentos: tabela agrupada por partner com soma de comissões `confirmed AND paid_at IS NULL` + botão "Marcar como pago" → opens dialog pra inserir `paid_via` (Pix key auto-fill mas editável) → atualiza rows
- Métricas: KPIs globais (total commissions paid all-time, MRR comprometido com partners, top 5 partners)

### Server actions

- `src/app/parceiros/actions.ts` — `applyAsAffiliate(formData)`
- `src/app/(app)/partner/actions.ts` — `updatePixKey(formData)`
- `src/app/admin/affiliates/actions.ts` — `approvePartner(id)`, `denyPartner(id)`, `suspendPartner(id)`, `markCommissionsAsPaid(partnerId, ids[], paidVia)`

All gate via `requireAdmin()` ou `requirePartner()` ou `requireAuthed()`. Sem rate limit explícito — `applyAsAffiliate` é a única exposta sem auth check no path, e ela exige user logged-in.

### Components (`src/components/affiliate/`)

- `CodeBox.tsx` — display + copy button
- `EarningsCard.tsx` — KPI tile
- `PartnerForm.tsx` — application form (client, with code uniqueness check)
- `CommissionRow.tsx` — table row for history
- `ApprovalDialog.tsx` — admin confirm/deny

---

## Files touched (~15 files, ~700-1000 LOC)

| File | Nature | Approx LOC |
|---|---|---|
| `supabase/migrations/0016_affiliate_program.sql` | new | 80 |
| `middleware.ts` | modify | +20 |
| `src/lib/affiliate/code.ts` | new | 40 |
| `src/lib/affiliate/attribution.ts` | new | 80 |
| `src/lib/affiliate/commission.ts` | new | 150 |
| `src/lib/affiliate/types.ts` | new | 30 |
| `src/lib/billing/webhook.ts` | modify | +30 |
| `src/app/auth/callback/route.ts` | modify | +15 |
| `src/app/parceiros/page.tsx` | new | 180 |
| `src/app/parceiros/actions.ts` | new | 80 |
| `src/app/(app)/partner/page.tsx` | new | 200 |
| `src/app/(app)/partner/actions.ts` | new | 30 |
| `src/app/admin/affiliates/page.tsx` | new | 250 |
| `src/app/admin/affiliates/actions.ts` | new | 100 |
| `src/components/affiliate/CodeBox.tsx` | new | 40 |
| `src/components/affiliate/EarningsCard.tsx` | new | 30 |
| `src/components/affiliate/PartnerForm.tsx` | new | 120 |
| `src/components/affiliate/CommissionRow.tsx` | new | 25 |
| `src/components/affiliate/ApprovalDialog.tsx` | new | 60 |
| `src/lib/admin/auth.ts` | modify | +20 (add requirePartner) |
| Tests (vitest unit + RTL component) | new | ~200 across multiple files |

**Total: ~1700-1800 LOC including tests.** Larger than the 700-1000 estimate — adjusting upward as I sized files more carefully. Multi-day project.

---

## Testing

### Unit tests

- `code.ts`: `validateCode("ANA-COACH")` true, `validateCode("ana-coach")` false (lowercase), `validateCode("AB")` true (min 2), `validateCode("A")` false (too short)
- `attribution.ts`: 
  - skips when ref code not found
  - skips when partner.status != 'active'
  - skips when self-referral (partner.user_id == profile.id)
  - flags when same email domain
  - flags when same CPF
  - inserts attributively otherwise
- `commission.ts`:
  - `recordCommission`: skips when no referral; skips when partner suspended; idempotent on duplicate payment_id
  - `recordClawback`: marks status as 'clawback'; tolerates missing row (refund of payment that never had commission)
  - `confirmCommissions`: bumps only rows older than 7 days; only `pending` → `confirmed`
  - `getPartnerEarnings`: sums correctly across statuses, excludes clawback from totals

### Component tests (vitest + RTL)

- `<PartnerForm>`: validates code format inline, disables submit until valid, calls action on submit
- `<CodeBox>`: copy button copies the link to clipboard (mock navigator.clipboard)
- `<ApprovalDialog>`: confirm vs cancel, calls action only on confirm

### Integration / e2e

The full flow E2E is out of scope for v1 (Playwright auth tests are gated by staging Supabase secret per CLAUDE.md). Manual gate covers:
1. Apply via /parceiros (logged in) → row visible in admin pending
2. Approve via /admin/affiliates → status flips to active
3. Open /partner → see link, copy it
4. Open link in incognito, see cookie set
5. Sign up → /admin/affiliates shows new referral
6. Make payment (R$10 avulso, sandbox) → commission row created with status pending
7. Wait 7 days OR call confirmCommissions() in admin → status flips to confirmed
8. Mark as paid → status flips to paid
9. Refund the payment → status flips to clawback

---

## Risks & rollback

| Risk | Mitigation |
|---|---|
| Migration applied to prod and code uses pre-migration assumption | Migration is additive (new tables, new column with default). Old code keeps working. Roll forward, not back. |
| Cookie tracking blocked by user (privacy mode, ad blocker) | Falls back to no attribution; payments still work. Acceptable. |
| Asaas webhook fails to fire commission insert | Try/catch around the side-effect. Webhook still acks. Ledger has a small reconciliation hole — addressed by a "Reconcile commissions" admin action that scans payments without commissions and creates them retroactively. (Cut from v1 if time-pressed; add to deferrals.) |
| Partner with multiple referrals creates schema bloat | Indexes by `partner_id` keep queries fast. Tables don't grow faster than `profiles` × N where N is small. |
| Partner shares same Pix key as another user | Not enforced. `pix_key` on profiles is just a string. Founder spots accidentally on payout. |
| Founder forgets to mark commissions as paid → infinite "pending payment" | Lazy-load admin warning if any partner has >R$500 owed for >30 days. |
| Self-referral via different email + new account | Same CPF flag catches first instance; founder can decide. Same IP isn't tracked (browser tooling); skip. |
| Refund AFTER founder paid commission | Clawback row carries negative balance, deducted from next month's payout. Manual adjustment if too large. |
| Schema typo in production | Spec includes exact SQL. Reviewer agent verifies. |

Rollback steps if needed:
1. Revert code commits.
2. Migration is additive — leave the empty tables in place; they don't break anything.
3. If absolutely needed: `DROP TABLE affiliate_commissions, affiliate_referrals, affiliate_partners CASCADE;` and `ALTER TABLE profiles DROP COLUMN pix_key;` — but probably not necessary.

---

## Definition of done

1. Migration `0016_affiliate_program.sql` applied in production via Supabase MCP.
2. `/parceiros` public page renders, form validates, application creates row with `status='pending'`.
3. `/admin/affiliates` lets founder approve / suspend partners and mark commissions as paid.
4. `/partner` dashboard shows correct KPIs for active partner.
5. Visiting `prepavaga.com.br/?ref=TEST-CODE` sets cookie, redirects to clean URL, persists 90 days.
6. Signup with cookie present creates `affiliate_referrals` row.
7. Webhook for confirmed payment creates `affiliate_commissions` row with status pending.
8. Refund webhook flips commission to clawback.
9. After 7 days, `confirmCommissions()` flips pending→confirmed (verified via lazy call on admin page).
10. All 199 existing tests still pass; new ~30 tests added pass.
11. typecheck + build green.
12. Commits pushed to main; Railway deploys; smoke-test the flow in production with one real test partner (the founder).

---

## Out of scope — explicit deferrals (Spec 5.1+)

- Auto-serve tier (no founder approval)
- Multi-tier (Pro Affiliate at 40-50% for top performers)
- Asaas split automático (split payment direct from Asaas)
- E-mail notifications (commission earned, paid, partner approved)
- Marketing materials kit for partners
- Click tracking (only conversion tracking in v1)
- Sub-codes / campaigns under one partner
- Multi-currency
- A/B testing of /parceiros copy
- Reconciliation tool (find payments without commissions and backfill)
- Partner analytics: cohorts, conversion rate by source, time-to-pay
- Public partner directory (the bio column is there for this; UI deferred)
- Withdrawal request flow (partner clicks "request payout"; v1 is push from founder, v2 can be pull from partner)

---

## Next step after this spec is approved

Invoke `superpowers:writing-plans` to produce the step-by-step implementation plan.
