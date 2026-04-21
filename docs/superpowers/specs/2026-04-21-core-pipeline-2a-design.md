# Core Pipeline 2a (Skinny E2E) — Design Spec

**Sub-projeto #2a do InterviewReady.** Primeiro slice vertical do Core Pipeline. Objetivo: usuário autenticado cola CV + JD, recebe prep guide personalizado em ~30s.

**Stack decidido:** Next.js 15 Server Action + Claude Sonnet 4.6 + Supabase RLS + Tailwind dark theme.

**Sub-projetos futuros:**
- #2b: PDF/DOCX upload + Supabase Storage + parsing
- #2c: 3-stage pipeline (CV analyzer + company research via web_search + prep generator)
- #2d: ATS gap analyzer (Stage 0) + UI polish (animations, section nav highlights)

---

## 1. Arquitetura

- **Single Claude call** por prep. Sem multi-stage, sem tools. Prompt unificado entrega JSON estruturado.
- **Server Action síncrona** (`generateAndStorePrep`) faz chamada Claude, valida schema, persiste. Railway não tem timeout de serverless — seguro rodar 20-30s.
- **Persistência**: tabela `prep_sessions` com RLS. User só vê seus próprios preps.
- **Viewer**: Server Component busca a session, renderiza tabs + cards expansíveis (client component pra expand/collapse state).
- **Fallback estado `generating`**: se user fechar aba mid-gen e voltar, viewer renderiza skeleton + `<meta http-equiv="refresh" content="3">`. Mais simples que polling JS pra skinny thread.

### Decisões arquiteturais

**Por quê single Claude call em vez de 3 estágios?** Skinny thread entrega valor mais rápido. 3 estágios (CV analyzer → company research → prep generator) custa mais, demora mais, exige web_search tool config — tudo vira #2c quando a #2a estiver em produção.

**Por quê Server Action síncrona em vez de job queue?** Railway roda container always-on sem timeout. Server Action síncrona é 15 linhas de código; job queue (BullMQ/Inngest) é semana de infraestrutura. Se skinny thread virar gargalo em produção, migramos.

**Por quê JSON estruturado rich em vez de markdown plain?** Schema idêntico ao futuro polish. Viewer dá pra refinar iterativamente sem mudar contrato do prompt. React render de JSON é mais customizável que markdown.

**Por quê Sonnet 4.6 em vez de Haiku 4.5?** Qualidade de prep guide é o principal valor do produto. Haiku (~$0.05/prep) economiza, mas gera respostas mais genéricas. Sonnet 4.6 (~$0.15/prep) vale os $0.10 extras enquanto validamos o produto. Troca-se pra Haiku em produção depois que prompt estiver estável.

**Por quê auto-refresh meta tag em vez de JS polling?** 5 linhas a menos de código pra estado raro (user volta durante os 30s de geração). Se esse fluxo virar comum, troca pra polling ou Realtime.

---

## 2. Estrutura de arquivos

```
src/app/
├── prep/
│   ├── new/
│   │   ├── page.tsx             # server component com NewPrepForm
│   │   └── actions.ts           # generateAndStorePrep Server Action
│   └── [id]/
│       └── page.tsx             # viewer (server component)
└── dashboard/
    └── page.tsx                 # atualizar: lista prep_sessions + botão "New prep" real

src/components/prep/
├── NewPrepForm.tsx              # "use client" — form + loading state
├── PrepGuide.tsx                # server — renderiza tabs + cards a partir do JSON
├── PrepCard.tsx                 # "use client" — card expansível
├── PrepFailed.tsx               # UI de erro + botão delete
└── PrepSkeleton.tsx             # placeholder enquanto status=generating

src/lib/ai/
├── anthropic.ts                 # new Anthropic() singleton
├── prompts/
│   └── prep-generator.ts        # buildPrepPrompt(cv, jd, role, company)
└── schemas.ts                   # Zod schema + inferred types pro prep guide

supabase/migrations/
└── 0002_prep_sessions.sql       # nova tabela + RLS

tests/
├── unit/
│   └── prep-prompt.test.ts      # Vitest — schema validation + prompt builder
└── e2e/
    └── prep.spec.ts             # Playwright — happy path (Claude mocked)
```

---

## 3. Database — migration `0002_prep_sessions.sql`

```sql
CREATE TABLE public.prep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  cv_text TEXT NOT NULL,
  job_description TEXT NOT NULL,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'pt-br', 'es')),
  prep_guide JSONB,
  generation_status TEXT DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'generating', 'complete', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prep_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prep sessions"
  ON public.prep_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prep sessions"
  ON public.prep_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prep sessions"
  ON public.prep_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own prep sessions"
  ON public.prep_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_prep_sessions_user ON public.prep_sessions(user_id, created_at DESC);

-- Auto-update updated_at on UPDATE
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prep_sessions_touch_updated
  BEFORE UPDATE ON public.prep_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
```

Colunas Stripe e freemium (tier, preps_used_this_month) já existem em `profiles` desde a Foundation — não mudam aqui. `cvs` e `mock_interviews` entram em #2b e #4 respectivamente.

---

## 4. Schema do output Claude (Zod)

`src/lib/ai/schemas.ts`:

```ts
import { z } from "zod";

export const prepCardSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  key_points: z.array(z.string()).min(1).max(8),
  sample_answer: z.string().min(50),
  tips: z.string(),
  confidence_level: z.enum(["low", "medium", "high"]),
  references_cv: z.array(z.string()),
});

export const prepSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  icon: z.string().min(1).max(4),
  summary: z.string(),
  cards: z.array(prepCardSchema).min(1).max(10),
});

export const prepGuideSchema = z.object({
  meta: z.object({
    role: z.string(),
    company: z.string(),
    estimated_prep_time_minutes: z.number().int().min(10).max(180),
  }),
  sections: z.array(prepSectionSchema).min(3).max(7),
});

export type PrepGuide = z.infer<typeof prepGuideSchema>;
export type PrepSection = z.infer<typeof prepSectionSchema>;
export type PrepCard = z.infer<typeof prepCardSchema>;
```

---

## 5. Prompt — `src/lib/ai/prompts/prep-generator.ts`

```ts
export function buildPrepPrompt(params: {
  cvText: string;
  jdText: string;
  jobTitle: string;
  companyName: string;
}) {
  const { cvText, jdText, jobTitle, companyName } = params;

  const schemaInline = `{
  "meta": {
    "role": "string",
    "company": "string",
    "estimated_prep_time_minutes": number (10-180)
  },
  "sections": [
    {
      "id": "kebab-case-id",
      "title": "string",
      "icon": "string (single emoji)",
      "summary": "string (one-line description of what this section covers)",
      "cards": [
        {
          "id": "kebab-case-id",
          "question": "string (likely interview question)",
          "key_points": ["3-5 bullet points the candidate should hit in their answer"],
          "sample_answer": "string (a complete, natural-sounding scripted answer the candidate can practice, using THEIR SPECIFIC experience and metrics)",
          "tips": "string (1-2 sentences of delivery advice)",
          "confidence_level": "low" | "medium" | "high",
          "references_cv": ["list of specific CV items this answer draws from — project names, companies, metrics, role titles"]
        }
      ]
    }
  ]
}`;

  return {
    system: `You are an elite interview coach preparing a candidate for a specific role at a specific company. Your job: analyze the candidate's CV + the target JD, then produce a hyper-personalized prep guide as JSON.

Your output MUST match this JSON schema exactly (no markdown fences, no preamble, no trailing commentary — pure JSON):

${schemaInline}

Generate 4-5 sections covering these themes (use these exact titles):
- "Likely Questions" — core behavioral + role-fit questions
- "Deep Dive Questions" — technical/domain questions specific to the role
- "Tricky Questions" — difficult, unexpected, or stress-test questions
- "Questions to Ask the Interviewer" — strategic, research-signaling questions
- "Mindset & Tips" — framing + soft skills + delivery guidance

4-6 cards per section.

CRITICAL RULES:
- NEVER generic advice. EVERY sample_answer must reference the candidate's SPECIFIC experience: company names, project titles, metrics, team sizes, dates.
- ALWAYS connect CV experience to JD requirements.
- sample_answer is a COMPLETE scripted answer (multiple sentences, natural speech cadence), not bullet points.
- key_points are the checklist the candidate mentally reviews before answering.
- confidence_level reflects how strongly the candidate's CV supports the answer: "high" = strong CV evidence, "medium" = some relevant experience, "low" = weak CV fit, answer with care.
- references_cv lists concrete CV items the answer uses (e.g., "Bayer 2019-2022 digital procurement transformation", "$500M addressable spend").
- All content in English.
- Return ONLY the JSON object. No markdown code fences. No explanation before or after.`,

    user: `CANDIDATE CV:
${cvText}

TARGET JOB DESCRIPTION:
${jdText}

TARGET ROLE: ${jobTitle}
TARGET COMPANY: ${companyName}

Generate the prep guide now.`,
  };
}
```

---

## 6. Server Action — `src/app/prep/new/actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildPrepPrompt } from "@/lib/ai/prompts/prep-generator";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { env } from "@/lib/env";

const formSchema = z.object({
  jobTitle: z.string().min(2).max(120),
  companyName: z.string().min(2).max(120),
  cvText: z.string().min(200, "CV must be at least 200 characters"),
  jobDescription: z.string().min(200, "JD must be at least 200 characters"),
});

export type CreatePrepState = { error?: string };

export async function createPrep(
  _prev: CreatePrepState,
  formData: FormData,
): Promise<CreatePrepState> {
  const parsed = formSchema.safeParse({
    jobTitle: formData.get("jobTitle"),
    companyName: formData.get("companyName"),
    cvText: formData.get("cvText"),
    jobDescription: formData.get("jobDescription"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Insert pending session first so viewer has a row to show if user navigates
  const { data: session, error: insertError } = await supabase
    .from("prep_sessions")
    .insert({
      user_id: user.id,
      job_title: parsed.data.jobTitle,
      company_name: parsed.data.companyName,
      cv_text: parsed.data.cvText,
      job_description: parsed.data.jobDescription,
      generation_status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !session) {
    console.error("[createPrep] insert failed:", insertError);
    return { error: "Could not save your prep session. Please try again." };
  }

  // Kick off generation (synchronous — we await it)
  try {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");

    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const { system, user: userMsg } = buildPrepPrompt({
      cvText: parsed.data.cvText,
      jdText: parsed.data.jobDescription,
      jobTitle: parsed.data.jobTitle,
      companyName: parsed.data.companyName,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: userMsg }],
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    // Tolerant extraction: strip code fences if the model added them
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const parsedJson = JSON.parse(jsonText);
    const validated = prepGuideSchema.parse(parsedJson);

    await supabase
      .from("prep_sessions")
      .update({
        prep_guide: validated,
        generation_status: "complete",
      })
      .eq("id", session.id);
  } catch (err) {
    console.error("[createPrep] generation failed:", err);
    await supabase
      .from("prep_sessions")
      .update({
        generation_status: "failed",
        error_message:
          err instanceof Error ? err.message.slice(0, 500) : "Unknown error",
      })
      .eq("id", session.id);
  }

  redirect(`/prep/${session.id}`);
}
```

---

## 7. Componentes UI

### NewPrepForm (client)

Form dark-themed com:
- `companyName` input
- `jobTitle` input
- `cvText` textarea (min 10 rows, monospace-ish font pra copy-paste)
- `jobDescription` textarea (min 10 rows)
- Submit button

Usa `useActionState` pra loading state: durante pending, button disabled + texto "Generating your prep... about 30 seconds". Inline error acima do button se Server Action retornar `{ error }`.

### PrepGuide (server component)

- Header com company + role + "Prep for <company>" + data
- Tabs horizontal scroll (cada tab = section com icon + title)
- Cards da section ativa abaixo
- Responsive: mobile = stacked, desktop = tabs

Estado da tab ativa = query param `?section=<id>` (SSR-friendly, shareable links).

### PrepCard (client, expandable)

Collapsed: pergunta + confidence_level badge + "Expand ↓".

Expanded:
- **Key points** (bullet list)
- **Sample answer** (prose, render com `whitespace-pre-wrap`)
- **Tips** (italic card)
- **References from your CV** (chip tags)

Click pra toggle. `useState` local. Section nav hook: se `?card=<id>` na URL, abre aquele card automaticamente.

### PrepFailed

Se session.status=`failed`:
- Ícone warning + texto "We couldn't generate your prep."
- `error_message` em mono (se houver)
- Botão "Delete and try again" → Server Action `deleteFailedPrep` → DELETE + redirect `/prep/new`

### PrepSkeleton

Se session.status=`generating`:
- Placeholder de header + 3 seções skeleton + texto "Generating your prep guide..."
- `<meta http-equiv="refresh" content="3">` no `<head>` pro auto-refresh.
- Nota curta: "This takes ~30 seconds. You can close and come back later."

---

## 8. Dashboard update

`src/app/dashboard/page.tsx`:

```tsx
// server component
const { data: sessions } = await supabase
  .from("prep_sessions")
  .select("id, company_name, job_title, generation_status, created_at")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(20);
```

Se lista vazia: empty state (o atual) + botão "Create your first prep" → `<Link href="/prep/new">`.
Se há sessions: grid de cards (um por session) com company + role + status badge + data + link pra `/prep/[id]`.

---

## 9. Env vars novas

`src/lib/env.ts` adiciona:

```ts
ANTHROPIC_API_KEY: z.string().min(1).optional(),
```

Optional no boot (build-time), mas o Server Action valida e falha se ausente em runtime.

Railway Variables: `ANTHROPIC_API_KEY` = (chave real).
GitHub Secret: `STAGING_ANTHROPIC_API_KEY` pra CI (pode ser chave separada de dev com quota baixa, OU a mesma do prod se comfort).

`.env.example` documenta.

---

## 10. Tratamento de erros

| Cenário | Comportamento |
|---------|---------------|
| ANTHROPIC_API_KEY faltando | Server Action detecta, seta status `failed` com mensagem clara |
| Claude API 429 (rate limit) | 1 retry com backoff 5s; se falhar, status `failed` |
| Claude API 5xx | Mesmo — 1 retry, depois `failed` |
| Response não-JSON | `JSON.parse` joga; catch seta `failed` com primeiros 500 chars salvos |
| Response JSON inválido (falha schema Zod) | `parse` joga ZodError; catch seta `failed` |
| Network timeout | `AbortController` com 90s limit; `failed` se atingir |
| User fecha aba mid-gen | Server Action roda até fim em background (Server Actions em Next 15 sobrevivem à navegação); row eventualmente vira `complete` ou `failed` |
| User acessa `/prep/[id]` dele mesmo mas status=generating | Skeleton + auto-refresh 3s |
| User acessa `/prep/[id]` de outro user | RLS bloqueia SELECT → 404 |

---

## 11. Testes

### Unit (Vitest)

`tests/unit/prep-prompt.test.ts`:
1. `buildPrepPrompt` inclui CV + JD + role + company no user message
2. Schema Zod: prep guide válido passa; faltando `meta.role` falha
3. Schema Zod: card com `key_points: []` (vazio) falha
4. Schema Zod: seção com 0 cards falha

### E2E (Playwright)

`tests/e2e/prep.spec.ts`:

Happy path com Claude **mockado** via env var. Env `MOCK_ANTHROPIC=1` faz `anthropic.ts` retornar fixture pré-canned:

```ts
// src/lib/ai/anthropic.ts
export function getAnthropic() {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return {
      messages: {
        create: async () => ({
          content: [{ type: "text", text: JSON.stringify(MOCK_PREP_GUIDE) }],
        }),
      },
    } as unknown as Anthropic;
  }
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}
```

Teste:
1. Signup via Playwright (reusa padrão do foundation auth.spec)
2. Navega `/prep/new`
3. Preenche 4 campos com textos válidos
4. Submit → aguarda redirect `/prep/[id]`
5. Assert heading "Prep for E2E Co" visível
6. Assert pelo menos uma section tab + um card renderizados

CI env: `MOCK_ANTHROPIC=1` no GitHub Actions workflow.

---

## 12. Deploy checklist

1. Migration `0002_prep_sessions.sql` rodada no Supabase prod (via SQL Editor no dashboard)
2. Migration rodada no Supabase local (via `supabase db reset`)
3. `ANTHROPIC_API_KEY` setada em Railway Variables
4. `STAGING_ANTHROPIC_API_KEY` setada em GitHub Secrets (ou usa a mesma)
5. CI workflow atualizado: env `MOCK_ANTHROPIC: "1"` na job de teste
6. Deploy Railway passa; `/prep/new` acessível em produção
7. Smoke manual em produção: criar 1 prep, validar que renderiza

---

## 13. Fora de escopo

- Upload PDF/DOCX → #2b (pdf-parse, mammoth, Supabase Storage, bucket `cvs`)
- Tabela `cvs` (quando houver upload, pra cachear parsed text) → #2b
- 3-stage pipeline + web_search → #2c
- ATS gap analyzer (Stage 0) → #2d
- PT-BR / ES prompts → #5 polish
- Stripe / freemium gate → #3
- PDF export do prep guide → #5
- Share link público → backlog
- Edit/delete prep session → delete já implícito no error handling; edit é out of scope
- Real-time progress (streaming) → considera se UX for insatisfatória

---

## 14. Definition of Done

1. User autenticado em produção (https://interview-ready-production.up.railway.app) vai em `/prep/new`
2. Preenche `companyName`, `jobTitle`, `cvText` (200+ chars), `jobDescription` (200+ chars)
3. Clica submit; vê loading state no form por ~20-40s
4. É redirecionado pra `/prep/[id]` com prep guide renderizado
5. Guide tem 4-5 sections, 4-6 cards por section, com emojis nas tabs
6. Cards expandem mostrando key_points + sample_answer + tips + references_cv
7. `/dashboard` lista a session criada com status `complete`, link pra revisitar
8. Session `failed` renderiza error UI + botão delete funcional
9. RLS: user A não consegue ler `/prep/<id-do-user-B>` (retorna 404)
10. CI passa: lint + typecheck + build + vitest + playwright E2E (com `MOCK_ANTHROPIC=1`)
11. Migration `0002` aplicada em prod sem erro
12. Tag `core-pipeline-2a-v1` após verificação manual em prod

Estimativa: ~10-15 arquivos novos, ~3-5h de execução via subagentes.

Risco principal: Claude retornar JSON com formatação que não passa no schema estrito (ex.: seção com 2 cards em vez dos 4 mínimos). Mitigação: prompt é claro sobre mínimos, Zod catch retorna `failed` limpo com raw_text salvo pra debug, user pode deletar e tentar de novo.
