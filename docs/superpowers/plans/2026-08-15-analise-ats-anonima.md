# Análise ATS anônima — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página pública onde qualquer pessoa cola uma vaga, envia o currículo e recebe na hora o score ATS mais o primeiro ajuste — e ao criar conta, essa análise migra sozinha, sem refazer nada.

**Architecture:** Server actions gravam numa tabela `anon_ats_analyses` acessível só por service-role, autorizada por um token opaco em cookie `HttpOnly`. A análise roda no Cerebras (free tier) com Gemini apenas no fallback de falha. A reivindicação acontece no envio do cadastro e **copia** a análise, nunca roda de novo.

**Tech Stack:** Next.js 15.5 App Router (RSC + server actions), TypeScript strict, Supabase (Postgres + RLS), Zod, Vitest, Upstash Ratelimit, `pdf-parse`/`mammoth`.

**Spec:** `docs/superpowers/specs/2026-08-15-analise-ats-anonima-design.md`

## Global Constraints

- Todo texto voltado ao usuário em **PT-BR**.
- Branch `feat/...`; commits `tipo(escopo): descrição` em PT-BR, corpo explicando o porquê. Nunca editar direto em `main`.
- Rodar `pnpm test`, `pnpm typecheck`, `pnpm lint` e `pnpm build` antes do merge — o CI não bloqueia merge local.
- **Aplicar a migration ANTES de deployar código que referencia as colunas novas** (a ausência da 0020 derrubou todas as preps com 404).
- O token **nunca** aparece em URL. Só cookie `HttpOnly`.
- A reivindicação **copia** `analysis`; nunca re-executa a IA.
- Não gravar o arquivo enviado — só o texto extraído.
- Arquivos com `import "server-only"` não podem ser importados por client component.

---

### Task 1: Migration da tabela + variável de teto diário

**Files:**
- Create: `supabase/migrations/0023_anon_ats_analyses.sql`
- Modify: `src/lib/env.ts`

**Interfaces:**
- Consumes: nada
- Produces: tabela `anon_ats_analyses`; `env.ANON_ATS_DAILY_CAP: number` (default 200)

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0023_anon_ats_analyses.sql
-- Análises ATS feitas sem cadastro. Acesso só por service-role: o token em
-- cookie HttpOnly é a autorização, validada em server action.
create table if not exists public.anon_ats_analyses (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  cv_text text not null,
  job_description text not null,
  job_title text,
  company_name text,
  analysis jsonb,
  status text not null default 'pending',
  error_message text,
  model_used text,
  ip_hash text,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists anon_ats_analyses_token_idx
  on public.anon_ats_analyses (token);
create index if not exists anon_ats_analyses_created_at_idx
  on public.anon_ats_analyses (created_at desc);

alter table public.anon_ats_analyses enable row level security;
-- Nenhuma policy: nem anon nem authenticated leem esta tabela diretamente.
```

- [ ] **Step 2: Aplicar no Supabase**

Colar o SQL no SQL Editor do projeto `reslmtzofwczxrswulca` e executar. Depois verificar:

```sql
select count(*) from public.anon_ats_analyses;
```

Expected: retorna `0` sem erro. Se der `42P01`, a migration não foi aplicada.

- [ ] **Step 3: Adicionar a variável de ambiente**

Em `src/lib/env.ts`, dentro do schema Zod, junto das outras opcionais:

```ts
  // Disjuntor de custo da ferramenta ATS anônima: máximo de análises por
  // dia no total. Estourou, a página convida a criar conta em vez de rodar.
  ANON_ATS_DAILY_CAP: z.coerce.number().int().positive().default(200),
```

- [ ] **Step 4: Verificar que o typecheck passa**

Run: `pnpm typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0023_anon_ats_analyses.sql src/lib/env.ts
git commit -m "feat(anon-ats): migration 0023 + teto diário configurável

Tabela anon_ats_analyses sem policy de RLS — o token em cookie HttpOnly é a
autorização, validada em server action com admin client. ANON_ATS_DAILY_CAP
é o disjuntor de custo (padrão 200/dia)."
```

---

### Task 2: `rateLimit` com opção de falhar fechado

**Files:**
- Modify: `src/lib/ratelimit.ts:6-17` (tipo), `:56-73` (função), `:86` (LIMITS)
- Test: `src/lib/ratelimit.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `RateLimitConfig.failClosed?: boolean`; `LIMITS.anonAts` = `{ key: "anonAts", limit: 3, windowSeconds: 3600, failClosed: true }`

Hoje `rateLimit()` libera quando o Upstash não está configurado ou falha. Isso é seguro em ação que exige login; num endpoint anônimo com chamada de IA seria porta aberta.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/ratelimit.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Sem UPSTASH_* no ambiente de teste, getLimiter() devolve null — é
// exatamente o cenário "Upstash indisponível".
vi.mock("@/lib/env", () => ({
  env: { UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined },
}));

const { rateLimit } = await import("./ratelimit");

describe("rateLimit sem Upstash", () => {
  it("libera por padrão (falha aberta)", async () => {
    const r = await rateLimit("ip:1.2.3.4", {
      key: "teste", limit: 3, windowSeconds: 3600,
    });
    expect(r.success).toBe(true);
  });

  it("bloqueia quando failClosed está ligado", async () => {
    const r = await rateLimit("ip:1.2.3.4", {
      key: "testeEstrito", limit: 3, windowSeconds: 3600, failClosed: true,
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm vitest run src/lib/ratelimit.test.ts`
Expected: FAIL — o segundo teste recebe `success: true`.

- [ ] **Step 3: Implementar**

Em `src/lib/ratelimit.ts`, adicionar ao tipo:

```ts
export type RateLimitConfig = {
  key: string;
  limit: number;
  windowSeconds: number;
  /**
   * Quando true, indisponibilidade do Upstash BLOQUEIA em vez de liberar.
   * Usar em endpoint anônimo com chamada de IA, onde falhar aberto vira
   * barra livre. O padrão (false) mantém o comportamento das ações logadas.
   */
  failClosed?: boolean;
};
```

Trocar o early-return de `rateLimit`:

```ts
  const limiter = getLimiter(config);
  if (!limiter) {
    return config.failClosed
      ? { success: false, remaining: 0, reset: 0 }
      : { success: true, remaining: config.limit, reset: 0 };
  }
```

E o `catch`:

```ts
  } catch (err) {
    console.warn(
      `[ratelimit] Upstash error, failing ${config.failClosed ? "closed" : "open"}:`,
      err,
    );
    return config.failClosed
      ? { success: false, remaining: 0, reset: 0 }
      : { success: true, remaining: config.limit, reset: 0 };
  }
```

Adicionar em `LIMITS`:

```ts
  // Ferramenta ATS anônima: 3/hora por IP e falha fechada.
  anonAts: { key: "anonAts", limit: 3, windowSeconds: 3600, failClosed: true },
```

- [ ] **Step 4: Rodar os testes**

Run: `pnpm vitest run src/lib/ratelimit.test.ts && pnpm typecheck`
Expected: PASS, typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ratelimit.ts src/lib/ratelimit.test.ts
git commit -m "feat(ratelimit): opção failClosed para endpoint anônimo

O helper libera quando o Upstash cai, o que é seguro em ação logada mas
seria barra livre de chamadas de IA num endpoint sem cadastro."
```

---

### Task 3: Helpers puros — entrada, expiração e mapeamento da reivindicação

**Files:**
- Create: `src/lib/anon-ats/core.ts`
- Test: `src/lib/anon-ats/core.test.ts`

**Interfaces:**
- Consumes: `AtsAnalysis` de `@/lib/ai/schemas`
- Produces:
  - `MAX_CV_CHARS = 20000`, `MAX_JD_CHARS = 20000`
  - `normalizeAnonInput(input: { cvText: string; jobDescription: string; jobTitle?: string; companyName?: string }): { ok: true; value: NormalizedAnonInput } | { ok: false; error: string }`
  - `type NormalizedAnonInput = { cvText: string; jobDescription: string; jobTitle: string; companyName: string }`
  - `isExpired(expiresAt: string, now?: Date): boolean`
  - `expiresAtFrom(created: Date): string`
  - `anonAnalysisToPrepSession(row, userId): PrepSessionInsert`
  - `type PrepSessionInsert`

Sem `server-only`: a normalização também roda no cliente para feedback imediato.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/anon-ats/core.test.ts
import { describe, it, expect } from "vitest";
import {
  normalizeAnonInput,
  isExpired,
  expiresAtFrom,
  anonAnalysisToPrepSession,
  MAX_CV_CHARS,
} from "./core";

const cv = "Analista de RH com 8 anos de experiência em recrutamento.";
const jd = "Buscamos Gerente de RH generalista com foco em cultura.";

describe("normalizeAnonInput", () => {
  it("aceita entrada válida e apara espaços", () => {
    const r = normalizeAnonInput({ cvText: `  ${cv}  `, jobDescription: jd });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cvText).toBe(cv);
  });

  it("recusa currículo vazio", () => {
    const r = normalizeAnonInput({ cvText: "   ", jobDescription: jd });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/currículo/i);
  });

  it("recusa vaga vazia", () => {
    const r = normalizeAnonInput({ cvText: cv, jobDescription: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/vaga/i);
  });

  it("recusa currículo curto demais pra ser um CV", () => {
    const r = normalizeAnonInput({ cvText: "meu cv", jobDescription: jd });
    expect(r.ok).toBe(false);
  });

  it("corta currículo gigante no limite", () => {
    const r = normalizeAnonInput({
      cvText: "a".repeat(MAX_CV_CHARS + 5000),
      jobDescription: jd,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cvText.length).toBe(MAX_CV_CHARS);
  });

  it("usa rótulos neutros quando vaga e empresa não vêm", () => {
    const r = normalizeAnonInput({ cvText: cv, jobDescription: jd });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.jobTitle).toBe("esta vaga");
      expect(r.value.companyName).toBe("a empresa");
    }
  });
});

describe("isExpired", () => {
  const agora = new Date("2026-08-15T12:00:00Z");

  it("considera expirada uma linha com prazo no passado", () => {
    expect(isExpired("2026-08-14T12:00:00Z", agora)).toBe(true);
  });

  it("mantém válida uma linha dentro do prazo", () => {
    expect(isExpired("2026-08-20T12:00:00Z", agora)).toBe(false);
  });

  it("expiresAtFrom devolve 7 dias à frente", () => {
    expect(expiresAtFrom(agora)).toBe(new Date("2026-08-22T12:00:00Z").toISOString());
  });
});

describe("anonAnalysisToPrepSession", () => {
  const analysis = { score: 62, top_fixes: [] } as never;
  const row = {
    cv_text: cv,
    job_description: jd,
    job_title: "Gerente de RH",
    company_name: "Acme",
    analysis,
  };

  it("nasce com o ATS pronto e a prep por gerar", () => {
    const insert = anonAnalysisToPrepSession(row, "user-1");
    expect(insert.user_id).toBe("user-1");
    expect(insert.ats_status).toBe("complete");
    expect(insert.ats_analysis).toBe(analysis);
    expect(insert.generation_status).toBe("pending");
    expect(insert.prep_guide).toBeNull();
  });

  it("preserva o texto original sem re-executar nada", () => {
    const insert = anonAnalysisToPrepSession(row, "user-1");
    expect(insert.cv_text).toBe(cv);
    expect(insert.job_description).toBe(jd);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/lib/anon-ats/core.test.ts`
Expected: FAIL — "Failed to load url ./core".

- [ ] **Step 3: Implementar**

```ts
// src/lib/anon-ats/core.ts
import type { AtsAnalysis } from "@/lib/ai/schemas";

export const MAX_CV_CHARS = 20_000;
export const MAX_JD_CHARS = 20_000;
const MIN_CV_CHARS = 40;
const EXPIRY_DAYS = 7;

export type NormalizedAnonInput = {
  cvText: string;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
};

export function normalizeAnonInput(input: {
  cvText: string;
  jobDescription: string;
  jobTitle?: string;
  companyName?: string;
}):
  | { ok: true; value: NormalizedAnonInput }
  | { ok: false; error: string } {
  const cvText = (input.cvText ?? "").trim().slice(0, MAX_CV_CHARS);
  const jobDescription = (input.jobDescription ?? "").trim().slice(0, MAX_JD_CHARS);

  if (!cvText) return { ok: false, error: "Envie ou cole o seu currículo." };
  if (cvText.length < MIN_CV_CHARS) {
    return {
      ok: false,
      error: "O texto do currículo ficou curto demais. Confira o arquivo e tente de novo.",
    };
  }
  if (!jobDescription) {
    return { ok: false, error: "Cole a descrição da vaga." };
  }

  return {
    ok: true,
    value: {
      cvText,
      jobDescription,
      // Rótulos neutros: o prompt de ATS exige os dois campos, e o anônimo
      // não preenche nenhum deles.
      jobTitle: (input.jobTitle ?? "").trim() || "esta vaga",
      companyName: (input.companyName ?? "").trim() || "a empresa",
    },
  };
}

export function expiresAtFrom(created: Date): string {
  return new Date(created.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Expiração avaliada na leitura — não depende de cron. */
export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() < now.getTime();
}

export type PrepSessionInsert = {
  user_id: string;
  cv_text: string;
  job_description: string;
  job_title: string;
  company_name: string;
  language: string;
  prep_guide: null;
  generation_status: "pending";
  ats_analysis: AtsAnalysis;
  ats_status: "complete";
};

/**
 * Copia a análise anônima para dentro da conta. NUNCA re-executa a IA: o
 * lado anônimo roda em Cerebras e o logado em Gemini, então rodar de novo
 * mudaria a nota entre "antes" e "depois" do cadastro — e a nota é a isca.
 */
export function anonAnalysisToPrepSession(
  row: {
    cv_text: string;
    job_description: string;
    job_title: string | null;
    company_name: string | null;
    analysis: AtsAnalysis;
  },
  userId: string,
): PrepSessionInsert {
  return {
    user_id: userId,
    cv_text: row.cv_text,
    job_description: row.job_description,
    job_title: row.job_title ?? "esta vaga",
    company_name: row.company_name ?? "a empresa",
    language: "pt-br",
    prep_guide: null,
    generation_status: "pending",
    ats_analysis: row.analysis,
    ats_status: "complete",
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/lib/anon-ats/core.test.ts`
Expected: PASS (13 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/anon-ats/core.ts src/lib/anon-ats/core.test.ts
git commit -m "feat(anon-ats): helpers puros de entrada, expiração e reivindicação

anonAnalysisToPrepSession copia a análise em vez de re-executar: o anônimo
roda em Cerebras e o logado em Gemini, e rodar de novo faria a nota mudar
entre os dois lados do cadastro."
```

---

### Task 4: Motor de análise — Cerebras primeiro, Gemini no fallback

**Files:**
- Create: `src/lib/anon-ats/analyze.ts`
- Test: `src/lib/anon-ats/analyze.test.ts`

**Interfaces:**
- Consumes: `normalizeAnonInput`/`NormalizedAnonInput` (Task 3); `buildAtsAnalyzerPrompt` de `@/lib/ai/prompts/ats-analyzer`; `callCerebrasJson` de `@/lib/ai/cerebras`; `generateAtsAnalysis` de `@/lib/ai/gemini`; `atsAnalysisSchema` de `@/lib/ai/schemas`
- Produces: `analyzeAnonAts(input: NormalizedAnonInput, deps?: AnalyzeDeps): Promise<{ ok: true; analysis: AtsAnalysis; modelUsed: "cerebras" | "gemini" } | { ok: false; error: string }>`; `type AnalyzeDeps`

Dependências injetáveis para o teste rodar sem rede.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/anon-ats/analyze.test.ts
import { describe, it, expect, vi } from "vitest";
import { analyzeAnonAts } from "./analyze";

const input = {
  cvText: "Analista de RH com 8 anos de experiência em recrutamento e seleção.",
  jobDescription: "Gerente de RH generalista, foco em cultura e desempenho.",
  jobTitle: "esta vaga",
  companyName: "a empresa",
};

const valido = {
  score: 62,
  title_match: { cv_title: "Analista de RH", jd_title: "Gerente de RH", match_score: 40 },
  keyword_analysis: { critical: [], high: [], medium: [] },
  top_fixes: [],
  overall_assessment:
    "O currículo cobre parte dos termos da vaga, mas falta vocabulário de gestão.",
};

describe("analyzeAnonAts", () => {
  it("usa o Cerebras quando ele responde válido, sem tocar no Gemini", async () => {
    const gemini = vi.fn();
    const r = await analyzeAnonAts(input, {
      callCerebras: async () => ({ ok: true, text: JSON.stringify(valido), modelId: "qwen" }),
      callGemini: gemini,
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.modelUsed).toBe("cerebras");
    expect(gemini).not.toHaveBeenCalled();
  });

  it("cai pro Gemini quando o Cerebras devolve JSON fora do schema", async () => {
    const r = await analyzeAnonAts(input, {
      callCerebras: async () => ({ ok: true, text: '{"score":"muito alto"}', modelId: "qwen" }),
      callGemini: async () => valido as never,
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.modelUsed).toBe("gemini");
  });

  it("cai pro Gemini quando o Cerebras está indisponível", async () => {
    const r = await analyzeAnonAts(input, {
      callCerebras: async () => ({ ok: false, reason: "all_failed" as const }),
      callGemini: async () => valido as never,
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.modelUsed).toBe("gemini");
  });

  it("devolve erro em PT-BR quando os dois falham", async () => {
    const r = await analyzeAnonAts(input, {
      callCerebras: async () => ({ ok: false, reason: "all_failed" as const }),
      callGemini: async () => {
        throw new Error("503 overloaded");
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tente/i);
  });

  it("aceita top_fixes vazio — CV que casa perfeitamente", async () => {
    const r = await analyzeAnonAts(input, {
      callCerebras: async () => ({
        ok: true,
        text: JSON.stringify({ ...valido, score: 94, top_fixes: [] }),
        modelId: "qwen",
      }),
      callGemini: vi.fn(),
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.analysis.top_fixes).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/lib/anon-ats/analyze.test.ts`
Expected: FAIL — "Failed to load url ./analyze".

- [ ] **Step 3: Implementar**

```ts
// src/lib/anon-ats/analyze.ts
import "server-only";
import { buildAtsAnalyzerPrompt } from "@/lib/ai/prompts/ats-analyzer";
import { callCerebrasJson, type CerebrasResult } from "@/lib/ai/cerebras";
import { generateAtsAnalysis } from "@/lib/ai/gemini";
import { atsAnalysisSchema, type AtsAnalysis } from "@/lib/ai/schemas";
import type { NormalizedAnonInput } from "./core";

export type AnalyzeDeps = {
  callCerebras: (opts: {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    maxTokens: number;
    label: string;
  }) => Promise<CerebrasResult>;
  callGemini: (params: { system: string; user: string }) => Promise<AtsAnalysis>;
};

const DEFAULT_DEPS: AnalyzeDeps = {
  callCerebras: callCerebrasJson,
  callGemini: generateAtsAnalysis,
};

const ERRO_GENERICO =
  "Não conseguimos analisar agora. Tente de novo em alguns minutos.";

/**
 * Cerebras (free tier) primeiro; Gemini (pago) só quando o Cerebras falha ou
 * devolve algo fora do schema. O custo pago acontece na fração que falha e
 * continua limitado pelos tetos de IP e diário aplicados antes daqui.
 */
export async function analyzeAnonAts(
  input: NormalizedAnonInput,
  deps: AnalyzeDeps = DEFAULT_DEPS,
): Promise<
  | { ok: true; analysis: AtsAnalysis; modelUsed: "cerebras" | "gemini" }
  | { ok: false; error: string }
> {
  const { system, user } = buildAtsAnalyzerPrompt({
    cvText: input.cvText,
    jdText: input.jobDescription,
    jobTitle: input.jobTitle,
    companyName: input.companyName,
  });

  const cerebras = await deps.callCerebras({
    systemPrompt: system,
    userPrompt: user,
    temperature: 0,
    maxTokens: 16_000,
    label: "anon-ats",
  }).catch(() => ({ ok: false, reason: "all_failed" }) as CerebrasResult);

  if (cerebras.ok) {
    const parsed = safeParseAnalysis(cerebras.text);
    if (parsed) return { ok: true, analysis: parsed, modelUsed: "cerebras" };
    console.warn("[anon-ats] Cerebras fora do schema, caindo pro Gemini");
  }

  try {
    const analysis = await deps.callGemini({ system, user });
    return { ok: true, analysis, modelUsed: "gemini" };
  } catch (err) {
    console.warn("[anon-ats] Gemini também falhou:", err);
    return { ok: false, error: ERRO_GENERICO };
  }
}

/** Qwen às vezes embrulha o JSON em prosa ou cercas de markdown. */
function safeParseAnalysis(text: string): AtsAnalysis | null {
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1]);
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (braced) candidates.push(braced);

  for (const c of candidates) {
    try {
      const parsed = atsAnalysisSchema.safeParse(JSON.parse(c));
      if (parsed.success) return parsed.data;
    } catch {
      // tenta o próximo candidato
    }
  }
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/lib/anon-ats/analyze.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/anon-ats/analyze.ts src/lib/anon-ats/analyze.test.ts
git commit -m "feat(anon-ats): motor Cerebras com Gemini no fallback

Free tier atende o caso normal; o Gemini pago entra só quando o Cerebras
falha ou devolve fora do schema, e continua limitado pelos tetos."
```

---

### Task 5: Repositório + teto diário + server action

**Files:**
- Create: `src/lib/anon-ats/repo.ts`, `src/app/analise-ats-gratis/actions.ts`
- Test: `src/lib/anon-ats/repo.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `createAdminClient` de `@/lib/supabase/admin`; `rateLimit`/`LIMITS` de `@/lib/ratelimit`
- Produces:
  - `isOverDailyCap(count: number, cap: number): boolean`
  - `hashIp(ip: string): string`
  - `ANON_COOKIE = "pv_anon_ats"`
  - `insertAnonAnalysis(...)`, `getAnonAnalysisByToken(token)` (retorna `null` se expirada)
  - action `runAnonAtsAnalysis(formData: FormData): Promise<{ error: string } | never>` (redireciona no sucesso)

- [ ] **Step 1: Escrever os testes puros que falham**

```ts
// src/lib/anon-ats/repo.test.ts
import { describe, it, expect } from "vitest";
import { isOverDailyCap, hashIp, ANON_COOKIE } from "./repo";

describe("isOverDailyCap", () => {
  it("libera abaixo do teto", () => {
    expect(isOverDailyCap(199, 200)).toBe(false);
  });
  it("bloqueia no teto", () => {
    expect(isOverDailyCap(200, 200)).toBe(true);
  });
  it("bloqueia acima do teto", () => {
    expect(isOverDailyCap(201, 200)).toBe(true);
  });
});

describe("hashIp", () => {
  it("é estável para o mesmo IP", () => {
    expect(hashIp("1.2.3.4")).toBe(hashIp("1.2.3.4"));
  });
  it("difere entre IPs", () => {
    expect(hashIp("1.2.3.4")).not.toBe(hashIp("1.2.3.5"));
  });
  it("não contém o IP original", () => {
    expect(hashIp("1.2.3.4")).not.toContain("1.2.3.4");
  });
});

describe("ANON_COOKIE", () => {
  it("tem nome estável", () => {
    expect(ANON_COOKIE).toBe("pv_anon_ats");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/lib/anon-ats/repo.test.ts`
Expected: FAIL — "Failed to load url ./repo".

- [ ] **Step 3: Implementar o repositório**

```ts
// src/lib/anon-ats/repo.ts
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AtsAnalysis } from "@/lib/ai/schemas";
import { expiresAtFrom, isExpired } from "./core";

export const ANON_COOKIE = "pv_anon_ats";
const TABLE = "anon_ats_analyses";

export function isOverDailyCap(count: number, cap: number): boolean {
  return count >= cap;
}

/** SHA-256 com salt: permite auditar abuso sem guardar o IP em si. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`prepavaga:${ip}`).digest("hex").slice(0, 32);
}

export function newToken(): string {
  return randomUUID();
}

export async function countAnalysesLast24h(): Promise<number> {
  const sb = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await sb
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  // Erro de leitura conta como teto atingido: falhar fechado também aqui.
  if (error) return Number.MAX_SAFE_INTEGER;
  return count ?? 0;
}

export async function insertAnonAnalysis(row: {
  token: string;
  cvText: string;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  analysis: AtsAnalysis;
  modelUsed: "cerebras" | "gemini";
  ipHash: string;
}): Promise<boolean> {
  const sb = createAdminClient();
  const { error } = await sb.from(TABLE).insert({
    token: row.token,
    cv_text: row.cvText,
    job_description: row.jobDescription,
    job_title: row.jobTitle,
    company_name: row.companyName,
    analysis: row.analysis,
    status: "complete",
    model_used: row.modelUsed,
    ip_hash: row.ipHash,
    expires_at: expiresAtFrom(new Date()),
  });
  if (error) {
    console.warn(`[anon-ats] insert falhou: ${error.code} ${error.message}`);
    return false;
  }
  return true;
}

export type AnonAnalysisRow = {
  id: string;
  cv_text: string;
  job_description: string;
  job_title: string | null;
  company_name: string | null;
  analysis: AtsAnalysis;
  model_used: string | null;
  claimed_by: string | null;
  expires_at: string;
};

/** Retorna null quando a linha não existe OU já expirou. */
export async function getAnonAnalysisByToken(
  token: string,
): Promise<AnonAnalysisRow | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(
      "id, cv_text, job_description, job_title, company_name, analysis, model_used, claimed_by, expires_at",
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as AnonAnalysisRow;
  if (isExpired(row.expires_at)) return null;
  return row;
}

export async function markClaimed(token: string, userId: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from(TABLE)
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq("token", token)
    .is("claimed_by", null);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/lib/anon-ats/repo.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Implementar a server action**

```ts
// src/app/analise-ats-gratis/actions.ts
"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { parseCvFile } from "@/lib/files/parse";
import { normalizeAnonInput } from "@/lib/anon-ats/core";
import { analyzeAnonAts } from "@/lib/anon-ats/analyze";
import {
  ANON_COOKIE,
  countAnalysesLast24h,
  hashIp,
  insertAnonAnalysis,
  isOverDailyCap,
  newToken,
} from "@/lib/anon-ats/repo";

const CONVITE_CADASTRO =
  "Muitas análises gratuitas agora. Crie sua conta grátis pra continuar sem espera.";

export async function runAnonAtsAnalysis(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";

  // Guarda 1: limite por IP, falhando FECHADO.
  const rl = await rateLimit(`anonAts:${hashIp(ip)}`, LIMITS.anonAts);
  if (!rl.success) return { error: CONVITE_CADASTRO };

  // Guarda 2: disjuntor global de custo.
  if (isOverDailyCap(await countAnalysesLast24h(), env.ANON_ATS_DAILY_CAP)) {
    return { error: CONVITE_CADASTRO };
  }

  // Guarda 3: tamanho e forma da entrada.
  let cvText = String(formData.get("cvText") ?? "");
  const file = formData.get("cvFile");
  if (file instanceof File && file.size > 0) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseCvFile(buffer, file.type);
      cvText = parsed.text;
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Não conseguimos ler esse arquivo.",
      };
    }
  }

  const normalized = normalizeAnonInput({
    cvText,
    jobDescription: String(formData.get("jobDescription") ?? ""),
  });
  if (!normalized.ok) return { error: normalized.error };

  const result = await analyzeAnonAts(normalized.value);
  if (!result.ok) return { error: result.error };

  const token = newToken();
  const saved = await insertAnonAnalysis({
    token,
    cvText: normalized.value.cvText,
    jobDescription: normalized.value.jobDescription,
    jobTitle: normalized.value.jobTitle,
    companyName: normalized.value.companyName,
    analysis: result.analysis,
    modelUsed: result.modelUsed,
    ipHash: hashIp(ip),
  });
  if (!saved) {
    return { error: "Não conseguimos guardar sua análise. Tente de novo." };
  }

  // HttpOnly: o token dá acesso ao texto do CV e nunca pode ir pra URL.
  (await cookies()).set(ANON_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  redirect("/analise-ats-gratis/resultado");
}
```

- [ ] **Step 6: Verificar typecheck e build**

Run: `pnpm typecheck && pnpm build`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/anon-ats/repo.ts src/lib/anon-ats/repo.test.ts src/app/analise-ats-gratis/actions.ts
git commit -m "feat(anon-ats): repositório, guardas e server action

Limite por IP falha fechado, teto diário funciona como disjuntor de custo, e
erro de leitura da contagem também conta como teto atingido. Token vai só em
cookie HttpOnly — em URL vazaria por Referer, histórico e log."
```

---

### Task 6: Página pública com o formulário

**Files:**
- Create: `src/app/analise-ats-gratis/page.tsx`, `src/components/anon-ats/AnonAtsForm.tsx`

**Interfaces:**
- Consumes: `runAnonAtsAnalysis` (Task 5)
- Produces: rota `/analise-ats-gratis`

- [ ] **Step 1: Criar o formulário (client)**

```tsx
// src/components/anon-ats/AnonAtsForm.tsx
"use client";

import { useActionState } from "react";
import { runAnonAtsAnalysis } from "@/app/analise-ats-gratis/actions";
import { PendingButton } from "@/components/prep/PendingButton";

export function AnonAtsForm() {
  const [state, action] = useActionState(runAnonAtsAnalysis, null);

  return (
    <form action={action} className="space-y-6">
      <div>
        <label htmlFor="jobDescription" className="text-sm font-bold text-ink">
          1. Cole a descrição da vaga
        </label>
        <textarea
          id="jobDescription"
          name="jobDescription"
          rows={8}
          required
          placeholder="Cole aqui o texto completo da vaga que você quer disputar."
          className="mt-2 w-full rounded-lg border border-line p-3 text-[15px] text-ink"
        />
      </div>

      <div>
        <label htmlFor="cvFile" className="text-sm font-bold text-ink">
          2. Envie seu currículo
        </label>
        <input
          id="cvFile"
          name="cvFile"
          type="file"
          accept=".pdf,.docx,.txt"
          className="mt-2 block w-full text-sm text-ink-2"
        />
        <p className="mt-2 text-xs text-ink-3">
          PDF, DOCX ou TXT. O arquivo é lido e descartado — não guardamos ele.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-orange-700">
            Prefiro colar o texto
          </summary>
          <textarea
            name="cvText"
            rows={8}
            placeholder="Cole aqui o conteúdo do seu currículo."
            className="mt-2 w-full rounded-lg border border-line p-3 text-[15px] text-ink"
          />
        </details>
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-lg bg-red-soft px-4 py-3 text-sm text-red-500">
          {state.error}
        </p>
      ) : null}

      <PendingButton
        idleLabel="Analisar meu currículo grátis →"
        pendingLabel="Analisando…"
        variant="primary"
      />
      <p className="text-xs text-ink-3">
        Sem cadastro e sem cartão. Você vê seu score na hora.
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Criar a página (server)**

```tsx
// src/app/analise-ats-gratis/page.tsx
import type { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { AnonAtsForm } from "@/components/anon-ats/AnonAtsForm";

export const metadata: Metadata = {
  title: "Análise ATS grátis do currículo — sem cadastro",
  description:
    "Cole a vaga, envie seu currículo e veja na hora o score ATS e o ajuste que mais te barra. Sem cadastro, sem cartão.",
  alternates: { canonical: "/analise-ats-gratis" },
};

export default function AnaliseAtsGratisPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Análise ATS grátis — PrepaVaga",
            applicationCategory: "BusinessApplication",
            inLanguage: "pt-BR",
            offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
          }),
        }}
      />
      <LandingNavbar />
      <main className="bg-bg">
        <div className="mx-auto max-w-2xl px-6 py-14">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
            Seu currículo passa no filtro ATS dessa vaga?
          </h1>
          <p className="mt-4 text-base leading-[1.55] text-ink-2 md:text-lg">
            A maioria dos currículos é cortada por software antes de qualquer
            pessoa ler. Descubra seu score em menos de um minuto — sem criar conta.
          </p>
          <div className="mt-10">
            <AnonAtsForm />
          </div>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
```

- [ ] **Step 3: Verificar que a página sobe**

Run: `pnpm build`
Expected: build lista `/analise-ats-gratis` entre as rotas.

- [ ] **Step 4: Commit**

```bash
git add src/app/analise-ats-gratis/page.tsx src/components/anon-ats/AnonAtsForm.tsx
git commit -m "feat(anon-ats): página pública com formulário

Vaga + CV sem cadastro. Deixa explícito que o arquivo é descartado."
```

---

### Task 7: Página de resultado com revelação parcial

**Files:**
- Create: `src/app/analise-ats-gratis/resultado/page.tsx`, `src/components/anon-ats/LockedFix.tsx`
- Test: `src/components/anon-ats/LockedFix.test.tsx`

**Interfaces:**
- Consumes: `getAnonAnalysisByToken`, `ANON_COOKIE` (Task 5); `Gauge` e `IssueRow` de `@/components/prep/`
- Produces: rota `/analise-ats-gratis/resultado`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// src/components/anon-ats/LockedFix.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LockedFix } from "./LockedFix";

describe("LockedFix", () => {
  it("mostra quantos ajustes faltam sem revelar o conteúdo", () => {
    render(<LockedFix remaining={4} />);
    expect(screen.getByText(/mais 4 ajustes/i)).toBeInTheDocument();
  });

  it("usa singular quando falta um só", () => {
    render(<LockedFix remaining={1} />);
    expect(screen.getByText(/mais 1 ajuste\b/i)).toBeInTheDocument();
  });

  it("não renderiza nada quando não há ajuste escondido", () => {
    const { container } = render(<LockedFix remaining={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/components/anon-ats/LockedFix.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o componente**

```tsx
// src/components/anon-ats/LockedFix.tsx
import Link from "next/link";

/**
 * O gancho é ver que existe mais coisa. Nunca renderizar o texto real dos
 * ajustes escondidos — nem borrado por CSS, que continua no HTML.
 */
export function LockedFix({ remaining }: { remaining: number }) {
  if (remaining <= 0) return null;
  const plural = remaining === 1 ? "ajuste" : "ajustes";

  return (
    <div className="rounded-lg border-2 border-dashed border-line bg-white p-5 text-center">
      <p className="text-sm font-bold text-ink">
        🔒 Mais {remaining} {plural} esperando
      </p>
      <p className="mt-1 text-sm text-ink-2">
        Crie sua conta grátis pra ver todos os ajustes e o currículo reescrito.
        Sua análise já fica salva — você não precisa colar nada de novo.
      </p>
      <Link
        href="/signup"
        className="mt-4 inline-flex rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
      >
        Ver todos os ajustes grátis →
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/components/anon-ats/LockedFix.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Implementar a página de resultado**

```tsx
// src/app/analise-ats-gratis/resultado/page.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Gauge } from "@/components/prep/Gauge";
import { IssueRow } from "@/components/prep/IssueRow";
import { LockedFix } from "@/components/anon-ats/LockedFix";
import { ANON_COOKIE, getAnonAnalysisByToken } from "@/lib/anon-ats/repo";

export const metadata: Metadata = {
  title: "Seu score ATS",
  robots: { index: false, follow: false },
};

export default async function ResultadoPage() {
  const token = (await cookies()).get(ANON_COOKIE)?.value;
  if (!token) redirect("/analise-ats-gratis");

  const row = await getAnonAnalysisByToken(token);
  if (!row) redirect("/analise-ats-gratis");

  const { analysis } = row;
  const [primeiro, ...escondidos] = analysis.top_fixes;
  const encontrados = [
    ...analysis.keyword_analysis.critical,
    ...analysis.keyword_analysis.high,
  ].filter((k) => k.found).length;

  return (
    <>
      <LandingNavbar />
      <main className="bg-bg">
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-14">
          <section className="rounded-lg bg-white p-6 shadow-prep">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <Gauge value={analysis.score} />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-ink">
                  Seu score ATS é {analysis.score}
                </h1>
                <p className="mt-2 text-[15px] leading-6 text-ink-2">
                  {analysis.overall_assessment}
                </p>
                <p className="mt-2 text-sm text-ink-3">
                  {encontrados} termos importantes da vaga já aparecem no seu currículo.
                </p>
              </div>
            </div>
          </section>

          {primeiro ? (
            <section className="rounded-lg border border-line bg-white p-5 shadow-prep">
              <h2 className="mb-3 text-sm font-bold text-ink">
                O ajuste que mais te barra
              </h2>
              <ul className="space-y-2">
                <IssueRow
                  severity="critical"
                  number={primeiro.priority}
                  title={primeiro.gap}
                  description={primeiro.jd_language}
                  impact="+12 pts"
                />
              </ul>
              <p className="mt-3 rounded-md bg-green-soft px-4 py-3 text-sm text-ink">
                <strong>Como escrever:</strong> {primeiro.suggested_rewrite}
              </p>
            </section>
          ) : (
            <section className="rounded-lg border-l-4 border-green-500 bg-green-soft px-5 py-4">
              <h2 className="text-sm font-bold text-green-700">
                Nenhum ajuste necessário
              </h2>
              <p className="mt-1 text-[15px] leading-6 text-ink">
                Seu currículo já cobre os termos-chave dessa vaga. Crie sua conta
                pra preparar as respostas da entrevista.
              </p>
            </section>
          )}

          <LockedFix remaining={escondidos.length} />
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
```

- [ ] **Step 6: Verificar build e typecheck**

Run: `pnpm typecheck && pnpm build`
Expected: sem erros; `/analise-ats-gratis/resultado` aparece nas rotas.

- [ ] **Step 7: Commit**

```bash
git add src/app/analise-ats-gratis/resultado/page.tsx src/components/anon-ats/LockedFix.tsx src/components/anon-ats/LockedFix.test.tsx
git commit -m "feat(anon-ats): resultado com score liberado e resto atrás do cadastro

Os ajustes escondidos nunca entram no HTML — borrar por CSS deixaria o texto
disponível em 'ver código-fonte'. noindex: é resultado pessoal."
```

---

### Task 8: Layout de prep tolera `prep_guide` nulo

**Files:**
- Modify: `src/app/prep/[id]/layout.tsx`
- Test: `src/lib/prep/step-state.test.ts` (arquivo existente — acrescentar)

**Interfaces:**
- Consumes: `computeServerCompleted` de `@/lib/prep/step-state`
- Produces: `/prep/[id]` e `/prep/[id]/ats` carregam com `prep_guide` nulo

Uma prep reivindicada nasce só com ATS. Hoje isso quebra em **dois** pontos, ambos confirmados por leitura do código:

1. `src/lib/prep/step-state.ts:9` — `if (input.guideReady && input.atsComplete) out.push(2)`. A etapa 2 exige a 1, então uma prep com ATS pronto e sem guide não marca nada.
2. `src/app/prep/[id]/layout.tsx:140-147` — `prepGuideSchema.safeParse` falhando renderiza `<PrepFailed>`, ou seja, a pessoa reivindicaria a análise e cairia numa tela de erro.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// acrescentar em src/lib/prep/step-state.test.ts
describe("prep reivindicada da ferramenta anônima", () => {
  it("marca a etapa 2 concluída mesmo sem prep_guide", () => {
    const completed = computeServerCompleted({
      guideReady: false,
      atsComplete: true,
    });
    expect(completed).toContain(2);
    expect(completed).not.toContain(1);
  });

  it("mantém as duas quando o guide existe", () => {
    expect(computeServerCompleted({ guideReady: true, atsComplete: true })).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/lib/prep/step-state.test.ts`
Expected: FAIL no primeiro teste — `computeServerCompleted` devolve `[]` porque a etapa 2 hoje depende de `guideReady`.

- [ ] **Step 3: Implementar**

Em `src/lib/prep/step-state.ts`, desacoplar a etapa 2 da 1:

```ts
export function computeServerCompleted(input: {
  guideReady: boolean;
  atsComplete: boolean;
}): StepNumber[] {
  const out: StepNumber[] = [];
  if (input.guideReady) out.push(1);
  // Independente da etapa 1: prep vinda da ferramenta anônima chega com ATS
  // pronto e sem prep_guide.
  if (input.atsComplete) out.push(2);
  return out;
}
```

Em `src/app/prep/[id]/layout.tsx`, substituir o bloco das linhas 140-152. `<PrepFailed>` deve continuar aparecendo quando o guide está **corrompido**, mas não quando ele está legitimamente **ausente**:

```tsx
  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  const guideReady = parsed.success;

  // prep_guide nulo é estado válido: prep reivindicada da ferramenta anônima
  // só tem ATS até a pessoa gerar a preparação completa. Guide presente mas
  // corrompido continua sendo erro de verdade.
  if (!guideReady && session.prep_guide !== null) {
    return (
      <>
        {headerEl}
        <PrepFailed id={session.id} errorMessage="Stored guide is malformed." />
      </>
    );
  }

  const atsComplete = session.ats_status === "complete";
  const serverCompleted = computeServerCompleted({ guideReady, atsComplete });
```

Nas linhas seguintes, `parsed.data.meta.company` e `parsed.data.meta.role` passam a precisar de fallback, porque `parsed` pode não ter `data`:

```tsx
        company={guideReady ? parsed.data.meta.company : session.company_name}
        role={guideReady ? parsed.data.meta.role : session.job_title}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/lib/prep/step-state.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prep/step-state.ts src/lib/prep/step-state.test.ts src/app/prep/[id]/layout.tsx
git commit -m "fix(prep): shell tolera prep_guide nulo

Prep vinda da ferramenta anônima chega só com ATS. Sem isso a rota daria
404 — o mesmo padrão que derrubou todas as preps quando faltou a 0020."
```

---

### Task 9: Reivindicação no cadastro

**Files:**
- Create: `src/lib/anon-ats/claim.ts`
- Modify: a server action de signup (`src/app/(auth)/signup/actions.ts`) — localizar com `grep -rn "signUp" src/app`
- Test: `src/lib/anon-ats/claim.test.ts`

**Interfaces:**
- Consumes: `getAnonAnalysisByToken`, `markClaimed` (Task 5); `anonAnalysisToPrepSession` (Task 3)
- Produces: `claimAnonAnalysis(token: string, userId: string): Promise<string | null>` (devolve o `prep_session.id` criado, ou null)

Acontece **no envio do cadastro**, não na confirmação do e-mail: o `/auth/confirm` funciona em navegador diferente de propósito, e lá o cookie não existe.

- [ ] **Step 1: Escrever o teste de idempotência que falha**

```ts
// src/lib/anon-ats/claim.test.ts
import { describe, it, expect, vi } from "vitest";
import { claimAnonAnalysis } from "./claim";

const row = {
  id: "anon-1",
  cv_text: "Analista de RH com 8 anos de experiência.",
  job_description: "Gerente de RH generalista.",
  job_title: "Gerente de RH",
  company_name: "Acme",
  analysis: { score: 62, top_fixes: [] } as never,
  model_used: "cerebras",
  claimed_by: null,
  expires_at: "2099-01-01T00:00:00Z",
};

describe("claimAnonAnalysis", () => {
  it("cria a prep e marca a linha como reivindicada", async () => {
    const insertPrep = vi.fn(async () => "prep-1");
    const mark = vi.fn(async () => undefined);

    const id = await claimAnonAnalysis("tok", "user-1", {
      getRow: async () => row,
      insertPrep,
      markClaimed: mark,
    });

    expect(id).toBe("prep-1");
    expect(mark).toHaveBeenCalledWith("tok", "user-1");
    expect(insertPrep.mock.calls[0][0].ats_status).toBe("complete");
  });

  it("não cria segunda prep para token já reivindicado", async () => {
    const insertPrep = vi.fn(async () => "prep-2");

    const id = await claimAnonAnalysis("tok", "user-1", {
      getRow: async () => ({ ...row, claimed_by: "outro-user" }),
      insertPrep,
      markClaimed: async () => undefined,
    });

    expect(id).toBeNull();
    expect(insertPrep).not.toHaveBeenCalled();
  });

  it("devolve null quando a análise expirou ou não existe", async () => {
    const id = await claimAnonAnalysis("tok", "user-1", {
      getRow: async () => null,
      insertPrep: vi.fn(),
      markClaimed: vi.fn(),
    });
    expect(id).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/lib/anon-ats/claim.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// src/lib/anon-ats/claim.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { anonAnalysisToPrepSession, type PrepSessionInsert } from "./core";
import {
  getAnonAnalysisByToken,
  markClaimed as markClaimedDefault,
  type AnonAnalysisRow,
} from "./repo";

export type ClaimDeps = {
  getRow: (token: string) => Promise<AnonAnalysisRow | null>;
  insertPrep: (insert: PrepSessionInsert) => Promise<string | null>;
  markClaimed: (token: string, userId: string) => Promise<void>;
};

const DEFAULT_DEPS: ClaimDeps = {
  getRow: getAnonAnalysisByToken,
  insertPrep: async (insert) => {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("prep_sessions")
      .insert(insert)
      .select("id")
      .single();
    if (error || !data) {
      console.warn(`[anon-ats] claim insert falhou: ${error?.message}`);
      return null;
    }
    return (data as { id: string }).id;
  },
  markClaimed: markClaimedDefault,
};

/**
 * Copia a análise anônima para dentro da conta. Idempotente: token já
 * reivindicado devolve null em vez de criar uma segunda prep.
 */
export async function claimAnonAnalysis(
  token: string,
  userId: string,
  deps: ClaimDeps = DEFAULT_DEPS,
): Promise<string | null> {
  const row = await deps.getRow(token);
  if (!row) return null;
  if (row.claimed_by) return null;

  const prepId = await deps.insertPrep(anonAnalysisToPrepSession(row, userId));
  if (!prepId) return null;

  await deps.markClaimed(token, userId);
  return prepId;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/lib/anon-ats/claim.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Ligar no cadastro**

Localizar a action de signup: `grep -rn "signUp(" src/app`. Depois do usuário ser criado com sucesso e antes do redirect, acrescentar:

```ts
  const anonToken = (await cookies()).get(ANON_COOKIE)?.value;
  if (anonToken && signUpData.user) {
    // Falha aqui nunca pode quebrar o cadastro — é um bônus, não requisito.
    try {
      await claimAnonAnalysis(anonToken, signUpData.user.id);
    } catch (err) {
      console.warn("[anon-ats] claim no signup falhou:", err);
    }
  }
```

- [ ] **Step 6: Verificar tudo**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add src/lib/anon-ats/claim.ts src/lib/anon-ats/claim.test.ts src/app
git commit -m "feat(anon-ats): reivindicação da análise no cadastro

No envio do cadastro, não na confirmação: /auth/confirm funciona em outro
navegador de propósito, e lá o cookie do token não existe. Idempotente e
nunca quebra o cadastro se falhar."
```

---

### Task 10: Descoberta — links internos, sitemap e rótulo honesto do rerun

**Files:**
- Modify: `src/app/sitemap.ts`, `src/components/landing/` (hero ou seção de CTA), `src/app/artigos/[slug]/page.tsx`, `src/app/prep/[id]/ats/page.tsx`

**Interfaces:**
- Consumes: rota `/analise-ats-gratis` (Task 6)
- Produces: a ferramenta fica alcançável e indexável

- [ ] **Step 1: Adicionar ao sitemap**

Em `src/app/sitemap.ts`, incluir `/analise-ats-gratis` na lista de rotas públicas com `priority: 0.9` (é o ativo linkável, prioridade acima dos artigos).

- [ ] **Step 2: Linkar do cluster ATS**

No CTA de rodapé de `src/app/artigos/[slug]/page.tsx`, quando `ctaVariant === "ats"`, trocar o destino primário de `/signup` para `/analise-ats-gratis` — o leitor desses artigos está pensando no currículo e a ferramenta entrega valor sem parede.

- [ ] **Step 3: Linkar da home**

Adicionar um link secundário para `/analise-ats-gratis` junto ao CTA principal da landing, com texto "Testar meu currículo sem criar conta".

- [ ] **Step 4: Rótulo honesto do rerun**

Em `src/app/prep/[id]/ats/page.tsx`, quando a prep veio da ferramenta anônima, o botão "↻ Rerodar análise" muda para "Refazer com análise completa" — ele usa Gemini e a nota vai mudar em relação à que a pessoa viu antes de criar conta.

- [ ] **Step 5: Smoke test e2e da página pública**

Acrescentar em `tests/e2e/smoke/` (o projeto `smoke` roda sempre no CI):

```ts
test("a ferramenta ATS anônima carrega e não vaza análise", async ({ page }) => {
  const res = await page.goto("/analise-ats-gratis");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Sem cookie de token, o resultado redireciona pra ferramenta.
  await page.goto("/analise-ats-gratis/resultado");
  await expect(page).toHaveURL(/\/analise-ats-gratis$/);
});
```

Run: `pnpm test:e2e:smoke`
Expected: PASS.

- [ ] **Step 6: Verificar**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: tudo verde; `/analise-ats-gratis` no `sitemap.xml` gerado.

- [ ] **Step 6: Commit e merge**

```bash
git add -A
git commit -m "feat(anon-ats): descoberta da ferramenta e rótulo honesto do rerun

Sitemap, link da home e do cluster ATS. O botão de rerodar avisa que a nota
pode mudar: ele roda Gemini e a análise original veio do Cerebras."
```

Depois: `pnpm build` limpo → merge em `main` → confirmar o deploy pelo SHA na API de deployments do GitHub → submeter `/analise-ats-gratis` ao IndexNow pelo botão do `/admin`.

---

## Verificação final antes de considerar pronto

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` — todos verdes
- [ ] Migration 0023 aplicada em produção **antes** do deploy
- [ ] Curl no endpoint público confirma que o HTML do resultado **não contém** o texto dos ajustes escondidos
- [ ] Fluxo manual completo: analisar anônimo → criar conta → cair na prep com o ATS pronto e **a mesma nota**
- [ ] Depois de reivindicar, o perfil ainda tem a preparação grátis vitalícia disponível (`profiles.preps_used_this_month` intocado) — a análise anônima não pode consumir a quota
- [ ] Cookie `pv_anon_ats` marcado `HttpOnly` no navegador
- [ ] `ANON_ATS_DAILY_CAP` e `CEREBRAS_API_KEY` configurados no Railway

---

**Nota (2026-08-17):** este plano descreve e foi executado com o Cerebras como motor primário da análise anônima (Task 4 acima). O Cerebras foi removido em 2026-08-16 — os dois modelos que o código chamava (`qwen-3-235b-a22b-instruct-2507`, `llama3.1-8b`) sumiram do catálogo, confirmado por HTTP 404 em produção para os dois. `CEREBRAS_API_KEY` não precisa mais ser configurada no Railway. Este documento fica como registro histórico da decisão tomada em 2026-08-15, não editado além desta nota. Detalhes da remoção em `CLAUDE.md` §10 e em `docs/superpowers/specs/2026-08-15-analise-ats-anonima-design.md`.
