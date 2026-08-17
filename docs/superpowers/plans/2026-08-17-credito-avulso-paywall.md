# Crédito avulso e paywall — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aposentar a preparação grátis e o Pro mensal; a análise ATS vira o produto gratuito e a preparação completa passa a custar R$10 (ou pacotes de 3 por R$25 e 5 por R$40), com o paywall no botão que gera a preparação.

**Architecture:** `checkQuota` encolhe de cinco modos para dois (`credit` / `block`). `createPrep` para de disparar o pipeline e passa a rodar só a análise ATS; a geração completa fica atrás de `generateFullPrep`, que já existe e já cobra cota. O consumo de crédito migra de read-modify-write para uma função SQL atômica, no mesmo padrão que a migration 0013 já usa para creditar.

**Tech Stack:** Next.js 15.5 App Router (server actions), TypeScript strict, Supabase (Postgres + funções `SECURITY DEFINER`), Zod, Vitest, Asaas.

**Spec:** `docs/superpowers/specs/2026-08-16-credito-avulso-paywall-design.md`

## Global Constraints

- Todo texto voltado ao usuário em **PT-BR**.
- Branch `feat/...` ou `fix/...`; commits `tipo(escopo): descrição` em PT-BR com corpo explicando o porquê. Nunca editar direto em `main`.
- Rodar `pnpm test`, `pnpm typecheck`, `pnpm lint` e `pnpm build` antes do merge — o CI não bloqueia merge local.
- **Aplicar migration ANTES de deployar código que a referencia.** A ausência da 0020 derrubou todas as preps com 404.
- Preços: avulso **R$10** (1000 centavos), pacote de **3 por R$25** (2500), pacote de **5 por R$40** (4000).
- A quantidade comprada vem do `externalReference`, **nunca do valor pago**.
- **Nenhuma coluna é dropada neste projeto.** `preps_used_this_month`, `preps_reset_at`, `preps_this_billing_cycle` e `billing_cycle_started_at` param de ser lidas e escritas; a remoção física é do Projeto 2.
- A varredura de texto (Task 8) tem que ir no MESMO deploy que o gate novo, senão o site promete prep grátis que o produto recusa.

---

### Task 1: Migration 0024 — consumo atômico e crédito por quantidade

**Files:**
- Create: `supabase/migrations/0024_creditos_por_quantidade.sql`

**Interfaces:**
- Produces:
  - `public.consume_prep_credit(p_user_id uuid) returns boolean` — decrementa 1 crédito só se houver saldo; devolve `true` se consumiu, `false` se não havia.
  - `public.handle_payment_received(..., p_credits int default 1)` — credita `p_credits` em vez de 1 fixo.
  - `public.handle_payment_refunded(..., p_credits int default 1)` — estorna `p_credits`.

Hoje o crédito **entra** de forma atômica (`prep_credits + 1`, migration 0013) mas **sai** por read-modify-write no TypeScript (`prep_credits: billing.prep_credits - 1`). Com todo mundo passando pelo caminho pago, duas abas concorrentes leem o mesmo saldo e geram duas preps cobrando um crédito só.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0024_creditos_por_quantidade.sql
-- 1) Consumo atômico: o UPDATE condicional é o cadeado. Se afetar 0 linhas,
--    não havia saldo (ou outra transação levou o último crédito primeiro).
create or replace function public.consume_prep_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afetadas int;
begin
  update public.profiles
     set prep_credits = prep_credits - 1
   where id = p_user_id
     and prep_credits > 0;
  get diagnostics v_afetadas = row_count;
  return v_afetadas > 0;
end;
$$;

revoke all on function public.consume_prep_credit(uuid) from public, anon, authenticated;

-- 2) Creditar N em vez de 1.
--
-- ATENÇÃO: `CREATE OR REPLACE FUNCTION` com lista de argumentos DIFERENTE
-- cria uma SOBRECARGA nova, não substitui a antiga. Com DEFAULT, a chamada
-- de 8 argumentos que o webhook faz hoje viraria ambígua entre as duas e o
-- Postgres devolveria "function is not unique" — ou seja, TODO pagamento
-- confirmado falharia. Por isso a antiga é derrubada explicitamente.
drop function if exists public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date
);

create or replace function public.handle_payment_received(
  p_user_id        uuid,
  p_payment_id     text,
  p_kind           text,
  p_amount_cents   integer,
  p_billing_method text,
  p_paid_at        timestamptz,
  p_raw_payload    jsonb,
  p_next_due_date  date DEFAULT NULL,
  p_credits        integer DEFAULT 1
) returns void
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  INSERT INTO payments (
    user_id, asaas_payment_id, kind, amount_cents, status,
    billing_method, paid_at, raw_payload
  ) VALUES (
    p_user_id, p_payment_id, p_kind, p_amount_cents, 'received',
    p_billing_method, p_paid_at, p_raw_payload
  )
  ON CONFLICT (asaas_payment_id) DO UPDATE SET
    status         = EXCLUDED.status,
    amount_cents   = EXCLUDED.amount_cents,
    billing_method = EXCLUDED.billing_method,
    paid_at        = EXCLUDED.paid_at,
    raw_payload    = EXCLUDED.raw_payload;

  IF p_kind = 'pro_subscription' THEN
    UPDATE profiles
       SET tier = 'pro',
           subscription_status = 'active',
           subscription_renews_at = p_next_due_date
     WHERE id = p_user_id;
  ELSE
    -- prep_purchase: credita a quantidade comprada, atômico.
    UPDATE profiles
       SET prep_credits = COALESCE(prep_credits, 0) + p_credits
     WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date, integer
) TO service_role;

-- 3) Estornar N. Mesma armadilha de sobrecarga.
drop function if exists public.handle_payment_refunded(uuid, text, text);

create or replace function public.handle_payment_refunded(
  p_user_id    uuid,
  p_payment_id text,
  p_kind       text,
  p_credits    integer DEFAULT 1
) returns void
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  UPDATE payments
     SET status = 'refunded'
   WHERE asaas_payment_id = p_payment_id;

  IF p_kind = 'pro_subscription' THEN
    UPDATE profiles
       SET tier = 'free',
           subscription_status = 'expired'
     WHERE id = p_user_id;
  ELSIF p_kind = 'prep_purchase' THEN
    UPDATE profiles
       SET prep_credits = GREATEST(0, COALESCE(prep_credits, 0) - p_credits)
     WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_refunded(uuid, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_payment_refunded(uuid, text, text, integer)
  TO service_role;
```

Os corpos acima são cópia verbatim da migration 0013, com uma única alteração em cada: `+ 1` virou `+ p_credits` e `- 1` virou `- p_credits`. Não reescreva o resto — a idempotência por `ON CONFLICT (asaas_payment_id)` precisa continuar idêntica.

- [ ] **Step 2: Conferir que as sobrecargas antigas não sobraram**

Abra `supabase/migrations/0013_webhook_handlers_atomic.sql` e confirme que as assinaturas nos dois `drop function if exists` batem exatamente com as declaradas lá. Uma assinatura errada no `drop` faz o `drop` não achar nada, a função antiga sobreviver, e o webhook quebrar com "function is not unique" no primeiro pagamento.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0024_creditos_por_quantidade.sql
git commit -m "feat(billing): consumo atômico de crédito e crédito por quantidade

O crédito já entrava atômico (0013) mas saía por read-modify-write no TS.
Com todo mundo passando pelo caminho pago, duas abas concorrentes leem o
mesmo saldo e geram duas preps cobrando um crédito só."
```

- [ ] **Step 4: Avisar que a migration precisa ser aplicada**

Esta migration NÃO pode ser aplicada por você. Registre no relatório que ela é pré-requisito do deploy e que as Tasks 4 e 6 dependem dela em produção.

---

### Task 2: Preços dos pacotes e `externalReference` com quantidade

**Files:**
- Modify: `src/lib/billing/prices.ts`, `src/lib/billing/ids.ts`
- Test: `src/lib/billing/ids.test.ts`, `src/lib/billing/prices.test.ts`

**Interfaces:**
- Produces:
  - `PREP_SKUS: readonly [{ qty: 1; cents: 1000 }, { qty: 3; cents: 2500 }, { qty: 5; cents: 4000 }]`
  - `findSku(qty: number): { qty: number; cents: number } | null`
  - `ExternalReference` ganha `{ kind: "prep_purchase"; userId: string; qty: number; nano: string }`
  - `buildExternalReference` gera `prep:<uid>:<qty>:<nano>`
  - `parseExternalReference` aceita o formato novo e trata o antigo (3 partes) como `qty: 1`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/billing/ids.test.ts
import { describe, it, expect } from "vitest";
import { buildExternalReference, parseExternalReference } from "./ids";

describe("externalReference de compra de prep", () => {
  it("carrega a quantidade", () => {
    const raw = buildExternalReference({
      kind: "prep_purchase", userId: "u1", qty: 3, nano: "abc",
    });
    expect(raw).toBe("prep:u1:3:abc");
  });

  it("faz o round-trip", () => {
    const parsed = parseExternalReference("prep:u1:5:xyz");
    expect(parsed).toEqual({ kind: "prep_purchase", userId: "u1", qty: 5, nano: "xyz" });
  });

  // Pagamento criado antes do deploy chega no webhook depois dele.
  it("trata o formato antigo como 1 crédito", () => {
    const parsed = parseExternalReference("prep:u1:abc");
    expect(parsed).toEqual({ kind: "prep_purchase", userId: "u1", qty: 1, nano: "abc" });
  });

  it("recusa quantidade que não é número", () => {
    expect(parseExternalReference("prep:u1:tres:abc")).toBeNull();
  });

  it("recusa quantidade fora dos SKUs", () => {
    expect(parseExternalReference("prep:u1:99:abc")).toBeNull();
  });

  it("continua entendendo a assinatura antiga", () => {
    expect(parseExternalReference("pro:u1")).toEqual({
      kind: "pro_subscription", userId: "u1",
    });
  });
});
```

```ts
// src/lib/billing/prices.test.ts
import { describe, it, expect } from "vitest";
import { PREP_SKUS, findSku, brlLabel } from "./prices";

describe("PREP_SKUS", () => {
  it("tem os três pacotes com os preços da spec", () => {
    expect(PREP_SKUS.map((s) => [s.qty, s.cents])).toEqual([[1, 1000], [3, 2500], [5, 4000]]);
  });

  it("findSku acha por quantidade", () => {
    expect(findSku(3)).toEqual({ qty: 3, cents: 2500 });
  });

  it("findSku devolve null pra quantidade inexistente", () => {
    expect(findSku(4)).toBeNull();
  });

  it("o desconto cresce com o pacote", () => {
    const unit = (s: { qty: number; cents: number }) => s.cents / s.qty;
    expect(unit(PREP_SKUS[1])).toBeLessThan(unit(PREP_SKUS[0]));
    expect(unit(PREP_SKUS[2])).toBeLessThan(unit(PREP_SKUS[1]));
  });

  it("formata em BRL", () => {
    expect(brlLabel(2500).replace(/ /g, " ")).toBe("R$ 25,00");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/lib/billing/ids.test.ts src/lib/billing/prices.test.ts`
Expected: FAIL — `PREP_SKUS` e `findSku` não existem; o build/parse ignora `qty`.

- [ ] **Step 3: Implementar**

Em `src/lib/billing/prices.ts`, acrescentar (mantendo `PRO_AMOUNT_CENTS` e `PER_USE_AMOUNT_CENTS`, ainda usados pelo código legado de assinatura):

```ts
/**
 * SKUs de compra de preparação. A quantidade viaja no externalReference,
 * nunca inferida do valor pago — casar por valor quebraria em qualquer
 * promoção ou ajuste de preço.
 */
export const PREP_SKUS = [
  { qty: 1, cents: 1000 },
  { qty: 3, cents: 2500 },
  { qty: 5, cents: 4000 },
] as const;

export function findSku(qty: number): { qty: number; cents: number } | null {
  return PREP_SKUS.find((s) => s.qty === qty) ?? null;
}
```

Em `src/lib/billing/ids.ts`:

```ts
import { findSku } from "./prices";

export type ExternalReference =
  | { kind: "pro_subscription"; userId: string }
  | { kind: "prep_purchase"; userId: string; qty: number; nano: string };

export function buildExternalReference(input: ExternalReference): string {
  if (input.kind === "pro_subscription") return `pro:${input.userId}`;
  return `prep:${input.userId}:${input.qty}:${input.nano}`;
}

export function parseExternalReference(raw: string | null | undefined): ExternalReference | null {
  if (!raw) return null;
  const parts = raw.split(":");

  if (parts[0] === "pro" && parts.length === 2 && parts[1]) {
    return { kind: "pro_subscription", userId: parts[1] };
  }

  // Formato antigo `prep:<uid>:<nano>`: pagamento criado antes do deploy que
  // chega no webhook depois dele. Vale 1 crédito.
  if (parts[0] === "prep" && parts.length === 3 && parts[1] && parts[2]) {
    return { kind: "prep_purchase", userId: parts[1], qty: 1, nano: parts[2] };
  }

  if (parts[0] === "prep" && parts.length === 4 && parts[1] && parts[2] && parts[3]) {
    const qty = Number(parts[2]);
    if (!Number.isInteger(qty) || !findSku(qty)) return null;
    return { kind: "prep_purchase", userId: parts[1], qty, nano: parts[3] };
  }

  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/lib/billing/ && pnpm typecheck`
Expected: PASS. O typecheck vai apontar os call sites de `buildExternalReference` que ainda não passam `qty` — anote quais são; a Task 6 conserta.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/prices.ts src/lib/billing/ids.ts src/lib/billing/ids.test.ts src/lib/billing/prices.test.ts
git commit -m "feat(billing): SKUs de pacote e quantidade no externalReference

A quantidade viaja no externalReference porque casar por valor pago
quebraria em qualquer promoção. Formato antigo de 3 partes vale 1 crédito,
para não perder pagamento em trânsito no deploy."
```

---

### Task 3: `checkQuota` com dois modos

**Files:**
- Modify: `src/lib/billing/quota.ts`
- Test: `src/lib/billing/quota.test.ts` (existe — reescrever os casos obsoletos)

**Interfaces:**
- Consumes: nada
- Produces:
  - `type ProfileBilling = { prep_credits: number }`
  - `type QuotaCheck = { allowed: true; mode: "credit" } | { allowed: false; mode: "block" }`
  - `checkQuota(p: ProfileBilling, isAdmin: boolean): QuotaCheck`

Note a mudança de assinatura: o segundo parâmetro deixa de ser `Date` (não há mais reset por ciclo) e passa a ser `isAdmin`, porque o bypass de admin hoje está espalhado nos call sites.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/billing/quota.test.ts — substituir o conteúdo
import { describe, it, expect } from "vitest";
import { checkQuota } from "./quota";

describe("checkQuota", () => {
  it("libera com saldo", () => {
    expect(checkQuota({ prep_credits: 1 }, false)).toEqual({ allowed: true, mode: "credit" });
  });

  it("bloqueia com saldo zero", () => {
    expect(checkQuota({ prep_credits: 0 }, false)).toEqual({ allowed: false, mode: "block" });
  });

  // Não deveria acontecer (CHECK prep_credits >= 0), mas negativo não pode liberar.
  it("bloqueia com saldo negativo", () => {
    expect(checkQuota({ prep_credits: -1 }, false)).toEqual({ allowed: false, mode: "block" });
  });

  it("admin passa mesmo sem saldo", () => {
    expect(checkQuota({ prep_credits: 0 }, true)).toEqual({ allowed: true, mode: "credit" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/lib/billing/quota.test.ts`
Expected: FAIL — a assinatura atual recebe `Date` e o tipo `ProfileBilling` exige seis campos.

- [ ] **Step 3: Implementar**

Substituir o conteúdo de `src/lib/billing/quota.ts`:

```ts
export type ProfileBilling = {
  prep_credits: number;
};

export type QuotaCheck =
  | { allowed: true; mode: "credit" }
  | { allowed: false; mode: "block" };

/**
 * Modelo pós-2026-08-17: não existe preparação grátis nem assinatura. Gerar
 * a preparação completa consome 1 crédito; a análise ATS é gratuita e não
 * passa por aqui.
 *
 * As colunas `preps_used_this_month`, `preps_reset_at`,
 * `preps_this_billing_cycle` e `billing_cycle_started_at` deixaram de ser
 * lidas. Elas continuam no banco de propósito — dropar coluna e trocar
 * comportamento no mesmo deploy é o padrão que já derrubou este produto
 * (migration 0020). A remoção física é do Projeto 2.
 */
export function checkQuota(p: ProfileBilling, isAdmin: boolean): QuotaCheck {
  if (isAdmin) return { allowed: true, mode: "credit" };
  if (p.prep_credits > 0) return { allowed: true, mode: "credit" };
  return { allowed: false, mode: "block" };
}
```

Remover `PRO_MONTHLY_SOFT_CAP` e `isNewBillingCycle`. O typecheck vai apontar quem os importa — anote; as Tasks 4 e 5 consertam.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/lib/billing/quota.test.ts`
Expected: PASS (4 testes). O `pnpm typecheck` ainda falha nos call sites — esperado nesta etapa.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/quota.ts src/lib/billing/quota.test.ts
git commit -m "feat(billing): checkQuota de cinco modos para dois

Sem prep grátis e sem assinatura, sobram credit e block. Sai o soft cap
mensal, o reset preguiçoso por ciclo e as ramificações de tier. As colunas
de contagem ficam no banco de propósito — remoção física é do Projeto 2."
```

---

### Task 4: Consumo atômico nos dois call sites

**Files:**
- Modify: `src/app/prep/new/actions.ts:60-90,161-195`, `src/app/prep/[id]/full-prep-actions.ts:74-168`
- Create: `src/lib/billing/consume.ts`
- Test: `src/lib/billing/consume.test.ts`

**Interfaces:**
- Consumes: `checkQuota(p, isAdmin)` (Task 3); `consume_prep_credit` (Task 1)
- Produces: `consumePrepCredit(supabase, userId, isAdmin): Promise<boolean>` — `true` quando pode seguir

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/billing/consume.test.ts
import { describe, it, expect, vi } from "vitest";
import { consumePrepCredit } from "./consume";

const fakeSb = (rpcResult: { data: unknown; error: unknown }) =>
  ({ rpc: vi.fn(async () => rpcResult) }) as never;

describe("consumePrepCredit", () => {
  it("segue quando a função devolve true", async () => {
    const sb = fakeSb({ data: true, error: null });
    expect(await consumePrepCredit(sb, "u1", false)).toBe(true);
  });

  it("barra quando a função devolve false (sem saldo)", async () => {
    const sb = fakeSb({ data: false, error: null });
    expect(await consumePrepCredit(sb, "u1", false)).toBe(false);
  });

  it("barra quando o RPC erra — falhar fechado, não dar prep de graça", async () => {
    const sb = fakeSb({ data: null, error: { message: "boom" } });
    expect(await consumePrepCredit(sb, "u1", false)).toBe(false);
  });

  it("admin passa sem tocar no RPC", async () => {
    const sb = { rpc: vi.fn() } as never;
    expect(await consumePrepCredit(sb, "u1", true)).toBe(true);
    expect((sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/lib/billing/consume.test.ts`
Expected: FAIL — "Failed to load url ./consume".

- [ ] **Step 3: Implementar o helper**

```ts
// src/lib/billing/consume.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Consome 1 crédito de forma atômica. O UPDATE condicional dentro de
 * `consume_prep_credit` (migration 0024) é o cadeado: duas abas concorrentes
 * com 1 crédito só geram uma prep.
 *
 * Falha do RPC barra a geração. Liberar em caso de erro entregaria a
 * preparação completa de graça, que é justamente o que o gate existe pra
 * impedir.
 */
export async function consumePrepCredit(
  supabase: SupabaseClient,
  userId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const { data, error } = await supabase.rpc("consume_prep_credit", {
    p_user_id: userId,
  });
  if (error) {
    console.warn(`[billing] consume_prep_credit falhou: ${error.message}`);
    return false;
  }
  return data === true;
}
```

- [ ] **Step 4: Trocar os dois call sites**

Em `src/app/prep/[id]/full-prep-actions.ts`: substituir o bloco de leitura de billing (as seis colunas) por leitura de `prep_credits, is_admin`, trocar `checkQuota(billing, now)` por `checkQuota({ prep_credits }, is_admin)`, e substituir todo o bloco de consumo por modo (`quota.mode === "credit"` / `"pro"` / else) por uma chamada a `consumePrepCredit`. Se ela devolver `false`, retornar `{ error: "quota_exceeded" }` sem gerar.

O mesmo em `src/app/prep/new/actions.ts`. **Atenção:** o `retryPrep` no mesmo arquivo NÃO consome cota e deve continuar assim — ele regenera algo já pago.

Remover os retornos de `"pro_soft_cap"` dos dois arquivos e o tratamento dele na UI que o consome.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm vitest run src/lib/billing/ && pnpm typecheck`
Expected: PASS nos testes; typecheck limpo nesses dois arquivos.

- [ ] **Step 6: Devolver o crédito quando a geração falha**

A spec exige que o crédito volte em toda falha do pipeline — senão a pessoa paga e não recebe. Escreva primeiro o teste:

```ts
// acrescentar em src/lib/billing/consume.test.ts
import { refundPrepCredit } from "./consume";

describe("refundPrepCredit", () => {
  it("devolve o crédito consumido", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await refundPrepCredit({ rpc } as never, "u1", false);
    expect(rpc).toHaveBeenCalledWith("refund_prep_credit", { p_user_id: "u1" });
  });

  it("não devolve nada pra admin, que não consumiu", async () => {
    const rpc = vi.fn();
    await refundPrepCredit({ rpc } as never, "u1", true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não lança quando o RPC erra", async () => {
    const rpc = vi.fn(async () => ({ error: { message: "boom" } }));
    await expect(refundPrepCredit({ rpc } as never, "u1", false)).resolves.toBeUndefined();
  });
});
```

Rode e veja falhar. Depois acrescente à migration 0024 (Task 1, mesmo arquivo — ela ainda não foi aplicada):

```sql
create or replace function public.refund_prep_credit(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set prep_credits = prep_credits + 1 where id = p_user_id;
$$;

revoke all on function public.refund_prep_credit(uuid) from public, anon, authenticated;
grant execute on function public.refund_prep_credit(uuid) to service_role;
```

E em `src/lib/billing/consume.ts`:

```ts
/**
 * Devolve o crédito quando a geração falha. Nunca lança: já estamos no
 * caminho de erro, e uma exceção aqui esconderia a falha original.
 */
export async function refundPrepCredit(
  supabase: SupabaseClient,
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  if (isAdmin) return;
  const { error } = await supabase.rpc("refund_prep_credit", { p_user_id: userId });
  if (error) {
    console.warn(
      `[billing] refund_prep_credit falhou pro usuário ${userId}: ${error.message}`,
    );
  }
}
```

Ligue no tratamento de erro da geração: em `src/app/prep/[id]/full-prep-actions.ts` e em `src/app/prep/new/actions.ts`, o `runGenerationInBackground` marca `generation_status: "failed"` no catch — chame `refundPrepCredit` no mesmo ponto, passando o `userId` e o `isAdmin` da sessão. **Não** devolva crédito no `retryPrep`, que não consumiu nenhum.

Rode `pnpm vitest run src/lib/billing/` e confirme que passa.

- [ ] **Step 7: Commit**

```bash
git add src/lib/billing/consume.ts src/lib/billing/consume.test.ts supabase/migrations/0024_creditos_por_quantidade.sql "src/app/prep/new/actions.ts" "src/app/prep/[id]/full-prep-actions.ts"
git commit -m "feat(billing): consumo atômico de crédito e devolução em falha

Read-modify-write deixava duas abas concorrentes gerarem duas preps com um
crédito só. Falha do RPC barra a geração: liberar entregaria a preparação
completa de graça. E toda falha de pipeline devolve o crédito, senão a
pessoa paga e não recebe."
```

---

### Task 5: `createPrep` roda só o ATS

**Files:**
- Modify: `src/app/prep/new/actions.ts` (bloco final, hoje chama `runGenerationInBackground`)
- Create: `src/lib/prep/run-ats.ts`
- Modify: `src/app/prep/[id]/ats-actions.ts` (passa a reusar o helper)
- Test: `src/lib/prep/run-ats.test.ts`

**Interfaces:**
- Consumes: `buildAtsAnalyzerPrompt`, `generateAtsAnalysis`, `atsAnalysisSchema`
- Produces: `runAtsForSession(sessionId: string, deps?: RunAtsDeps): Promise<void>` — grava `ats_analysis` + `ats_status` na sessão; nunca lança

Hoje `runAtsAnalysis` é server action com auth e rate limit embutidos, então não dá pra chamar de dentro do `createPrep`. Extraia o miolo.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/prep/run-ats.test.ts
import { describe, it, expect, vi } from "vitest";
import { runAtsForSession } from "./run-ats";

const sessao = {
  id: "s1", cv_text: "Analista de RH com 8 anos.", job_description: "Gerente de RH.",
  job_title: "Gerente de RH", company_name: "Acme",
};
const analise = {
  score: 70,
  title_match: { cv_title: "a", jd_title: "b", match_score: 40 },
  keyword_analysis: { critical: [], high: [], medium: [] },
  top_fixes: [],
  overall_assessment: "Avaliação suficientemente longa pra passar no schema Zod.",
};

describe("runAtsForSession", () => {
  it("grava a análise e marca complete", async () => {
    const update = vi.fn(async () => ({ error: null }));
    await runAtsForSession("s1", {
      loadSession: async () => sessao,
      analyze: async () => analise as never,
      updateSession: update,
    });
    expect(update.mock.calls.at(-1)?.[1]).toMatchObject({ ats_status: "complete" });
  });

  it("marca failed com mensagem PT-BR quando a IA falha", async () => {
    const update = vi.fn(async () => ({ error: null }));
    await runAtsForSession("s1", {
      loadSession: async () => sessao,
      analyze: async () => { throw new Error("503"); },
      updateSession: update,
    });
    const ultimo = update.mock.calls.at(-1)?.[1] as { ats_status: string; ats_error_message: string };
    expect(ultimo.ats_status).toBe("failed");
    expect(ultimo.ats_error_message).toMatch(/[çãáéí]/);
  });

  it("não lança quando a sessão não existe", async () => {
    await expect(
      runAtsForSession("inexistente", {
        loadSession: async () => null,
        analyze: vi.fn(),
        updateSession: vi.fn(async () => ({ error: null })),
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/lib/prep/run-ats.test.ts`
Expected: FAIL — "Failed to load url ./run-ats".

- [ ] **Step 3: Implementar**

Crie `src/lib/prep/run-ats.ts` com `import "server-only"`, o tipo `RunAtsDeps` com os três membros usados no teste (`loadSession`, `analyze`, `updateSession`), defaults reais usando `createAdminClient` + `buildAtsAnalyzerPrompt` + `generateAtsAnalysis`, e a função `runAtsForSession` que: marca `ats_status: "generating"`, roda, e grava `complete` com a análise ou `failed` com mensagem em PT-BR. Envolva tudo em try/catch — a função nunca lança, porque é chamada em background.

- [ ] **Step 4: Ligar no `createPrep`**

Em `src/app/prep/new/actions.ts`, substituir a chamada final `void runGenerationInBackground(session.id)` por `void runAtsForSession(session.id)`. A sessão passa a nascer com `generation_status: "pending"` e `prep_guide: null` — que é exatamente a assinatura que `shouldOfferFullPrep` já reconhece, então o CTA de gerar a preparação aparece sozinho.

**Não remova** `runGenerationInBackground`: ela continua sendo usada por `retryPrep` e por `generateFullPrep`.

Faça `src/app/prep/[id]/ats-actions.ts` reusar `runAtsForSession` em vez de duplicar a lógica, mantendo auth e rate limit onde estão.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm vitest run src/lib/prep/ && pnpm typecheck && pnpm build`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/prep/run-ats.ts src/lib/prep/run-ats.test.ts "src/app/prep/new/actions.ts" "src/app/prep/[id]/ats-actions.ts"
git commit -m "feat(prep): createPrep roda só o ATS, a preparação fica atrás do paywall

A pessoa vê o score antes de qualquer cobrança. A sessão nasce com a mesma
assinatura que shouldOfferFullPrep já reconhece, então o CTA de gerar a
preparação completa aparece sozinho."
```

---

### Task 6: Checkout com pacotes e webhook creditando N

**Files:**
- Modify: `src/app/api/billing/checkout/route.ts`, `src/lib/billing/webhook.ts`
- Test: `src/lib/billing/webhook.test.ts` (existe — acrescentar)

**Interfaces:**
- Consumes: `PREP_SKUS`, `findSku`, `buildExternalReference`, `parseExternalReference` (Task 2); `handle_payment_received(..., p_credits)` (Task 1)

- [ ] **Step 1: Escrever o teste que falha**

```ts
// acrescentar em src/lib/billing/webhook.test.ts
describe("crédito por quantidade", () => {
  it("passa p_credits igual à quantidade do externalReference", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await dispatchEvent(
      eventoPagamentoRecebido({ externalReference: "prep:u1:3:abc", value: 25 }),
      { rpc } as never,
    );
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_credits: 3 });
  });

  it("formato antigo credita 1", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await dispatchEvent(
      eventoPagamentoRecebido({ externalReference: "prep:u1:abc", value: 10 }),
      { rpc } as never,
    );
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_credits: 1 });
  });
});
```

Adapte os nomes dos helpers (`dispatchEvent`, construtor de evento) aos que já existem no arquivo de teste — leia-o antes de escrever.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/lib/billing/webhook.test.ts`
Expected: FAIL — `p_credits` não é passado.

- [ ] **Step 3: Implementar**

Em `src/lib/billing/webhook.ts`, no `handlePaymentReceived`, passar `p_credits: ref.kind === "prep_purchase" ? ref.qty : 1` no `rpc`. Fazer o mesmo em `handlePaymentRefunded`.

Em `src/app/api/billing/checkout/route.ts`: o body Zod ganha `qty: z.number().int().optional()` para `prep_purchase`. Validar com `findSku(qty ?? 1)`; quantidade inválida devolve 400 com mensagem em PT-BR. O `value` do `createPayment` passa a vir do SKU (`sku.cents / 100`), não de `PER_USE_AMOUNT_CENTS`. O `buildExternalReference` passa `qty`. A descrição da cobrança menciona a quantidade em PT-BR.

**Não toque** no ramo `pro_subscription` — ele vira inalcançável quando a `/pricing` deixar de oferecê-lo (Task 7), mas o código fica de pé para estorno de pagamento antigo.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/lib/billing/ && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/webhook.ts "src/app/api/billing/checkout/route.ts" src/lib/billing/webhook.test.ts
git commit -m "feat(billing): checkout com pacotes e webhook creditando a quantidade

O valor cobrado vem do SKU e a quantidade creditada vem do externalReference
— nunca inferida do valor pago."
```

---

### Task 7: `/pricing` com um preço e três pacotes

**Files:**
- Modify: `src/app/pricing/page.tsx`, `src/components/billing/PlanCard.tsx`, `src/components/billing/CheckoutButton.tsx`
- Test: `src/components/billing/CheckoutButton.test.tsx` (criar se não existir)

**Interfaces:**
- Consumes: `PREP_SKUS`, `brlLabel` (Task 2); `/api/billing/checkout` com `qty` (Task 6)

- [ ] **Step 1: Reescrever a página**

A `/pricing` passa a mostrar: a análise ATS como gratuita (com link para `/analise-ats-gratis`) e os três SKUs de preparação. Sem tabela comparativa e sem menção a assinatura, Pro ou "preparação grátis". O JSON-LD `Service` existente continua — só atualize o preço para 10.

O `CheckoutButton` passa a receber `qty` e mandá-lo no POST.

- [ ] **Step 2: Escrever teste do botão**

```tsx
// src/components/billing/CheckoutButton.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CheckoutButton } from "./CheckoutButton";

afterEach(() => vi.restoreAllMocks());

describe("CheckoutButton", () => {
  it("manda a quantidade escolhida no POST", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ checkoutUrl: "https://x" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckoutButton qty={3} label="Comprar 3" />);
    fireEvent.click(screen.getByRole("button", { name: /comprar 3/i }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ kind: "prep_purchase", qty: 3 });
  });
});
```

Adapte as props ao componente real — leia-o antes.

- [ ] **Step 3: Rodar, implementar, rodar**

Run: `pnpm vitest run src/components/billing/ && pnpm build`
Expected: PASS e build gerando `/pricing`.

- [ ] **Step 4: Commit**

```bash
git add src/app/pricing "src/components/billing"
git commit -m "feat(pricing): um preço e três pacotes, sem assinatura

A análise ATS aparece como gratuita e a preparação completa como o produto
pago. Sai a tabela comparativa e toda menção a Pro."
```

---

### Task 8: Varredura de texto

**Files:**
- Modify: `src/components/landing/Hero.tsx`, `src/components/landing/FinalCta.tsx`, `src/components/blog/ArticleInlineCta.tsx`, `src/app/artigos/[slug]/page.tsx`, `src/components/anon-ats/AnonAtsForm.tsx`, `src/components/anon-ats/LockedFix.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/layout.tsx`

**Interfaces:** nenhuma — é texto.

Esta task tem que ir no MESMO deploy que as anteriores. Se o gate novo subir e um lugar continuar prometendo prep grátis, a pessoa cadastra esperando algo que não vem.

- [ ] **Step 1: Encontrar todas as ocorrências**

Run: `grep -rniE "gr[aá]tis|gratuit|primeira prepara|sem cartão" src/app src/components --include=*.tsx --include=*.ts`

Liste cada resultado no relatório e classifique: (a) promete prep grátis → tem que mudar; (b) fala da análise ATS gratuita → continua verdadeiro; (c) outro contexto.

- [ ] **Step 2: Reescrever as do grupo (a)**

A mensagem nova, em todo lugar: a análise ATS é grátis, a preparação completa custa R$10. Mantenha o tom de cada superfície — não cole a mesma frase nos oito arquivos.

Atenção especial ao `LockedFix.tsx`, que hoje diz "Crie sua conta grátis pra ver todos os ajustes": criar conta continua sendo grátis, mas ver os ajustes passa a exigir crédito. A frase precisa parar de prometer o que não entrega.

- [ ] **Step 3: Verificar que nada ficou para trás**

Run: `grep -rniE "primeira prepara(ção|cao) gr[aá]tis|prepara(ção|cao) gr[aá]tis|1 prep gr" src/`
Expected: nenhuma saída.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat(copy): remove a promessa de preparação grátis

Tem que ir no mesmo deploy do gate novo: se um lugar continuar prometendo
prep grátis, a pessoa cadastra esperando algo que o produto recusa."
```

---

### Task 9: Eventos de funil do checkout

**Files:**
- Modify: `src/lib/analytics/events.ts`, `src/components/billing/CheckoutButton.tsx`, `src/lib/billing/webhook.ts`

**Interfaces:**
- Consumes: `FunnelEventMap` (padrão existente)
- Produces: `checkout_iniciado: { qty: number; cents: number }`, `checkout_confirmado: { qty: number; cents: number }`

Sem estes eventos, três das quatro métricas de sucesso da spec ficam inapuráveis e a decisão de manter ou matar os pacotes vira palpite.

- [ ] **Step 1: Acrescentar ao mapa**

Siga o padrão dos eventos existentes em `src/lib/analytics/events.ts`, incluindo o comentário de uma linha explicando cada campo.

- [ ] **Step 2: Emitir**

`checkout_iniciado` no `CheckoutButton`, antes do POST. `checkout_confirmado` no `handlePaymentReceived` do webhook, apenas quando `ref.kind === "prep_purchase"`. Use `trackServer` no webhook (o padrão do repo) e envolva em try/catch — telemetria não pode quebrar o processamento do pagamento.

- [ ] **Step 3: Verificar**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: tudo verde.

- [ ] **Step 4: Commit**

```bash
git add src/lib/analytics/events.ts "src/components/billing/CheckoutButton.tsx" src/lib/billing/webhook.ts
git commit -m "feat(analytics): eventos de checkout iniciado e confirmado

Sem eles, três das quatro métricas de sucesso da spec ficam inapuráveis e a
decisão sobre os pacotes viraria palpite."
```

---

## Verificação final antes de considerar pronto

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` — todos verdes
- [ ] Migration 0024 aplicada em produção **antes** do deploy
- [ ] `grep -rniE "prepara(ção|cao) gr[aá]tis" src/` não retorna nada
- [ ] Fluxo manual: criar prep → ver score ATS sem pagar → clicar em gerar → cair no checkout → pagar → voltar com crédito → gerar
- [ ] Comprar pacote de 3 credita exatamente 3
- [ ] Com 1 crédito, duas abas clicando em gerar ao mesmo tempo produzem **uma** prep e consomem **um** crédito
- [ ] Falha do pipeline devolve o crédito
- [ ] O assinante existente foi tratado: assinatura cancelada no Asaas e 3 créditos concedidos

## Migração manual do assinante (fazer junto com o deploy)

```sql
-- Substituir <UID> pelo id do único perfil com asaas_subscription_id não nulo.
update public.profiles
   set prep_credits = prep_credits + 3,
       asaas_subscription_id = null,
       subscription_status = 'canceled',
       tier = 'free'
 where id = '<UID>';
```

Cancelar a assinatura no painel do Asaas **antes** de rodar isto, para não gerar cobrança nova.
