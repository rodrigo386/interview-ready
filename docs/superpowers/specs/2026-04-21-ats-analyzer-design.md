# ATS Gap Analyzer (#2d) — Design Spec

**Sub-projeto #2d do InterviewReady.** Opt-in (botão); gera análise de match entre CV e JD conforme ARCHITECTURE.md §14. Por design UX conforme §14: score circular, top fixes, keywords tier list.

## Context

Usuário acabou de gerar um prep guide em `/prep/[id]`. Ele agora tem uma segunda questão: "meu CV vai passar pelo ATS / AI screening dessa empresa?" O ATS Analyzer responde isso com: score 0-100, top 5 fixes priorizados com rewrites, keywords list por tier. Opt-in via botão pra não onerar geração principal.

## Escopo

**Entrega:** User em `/prep/[id]` vê banner "Run ATS Match" → clica → ~15s de skeleton → score + análise renderizam no topo da página. Persistido em `prep_sessions.ats_analysis` (JSONB).

**Manter intacto:** Foundation, Core Pipeline 2a (geração de 5 seções), dashboard, auth, deploy.

## Arquitetura

```
/prep/[id]
├─ Top (NOVO): AtsCtaCard OU AtsScoreCard (condicional em ats_status)
└─ PrepGuide (existente): 5 tabs com cards

Clique "Run ATS Match"
  ↓
Server Action runAtsAnalysis(sessionId)
  1. UPDATE ats_status='generating'
  2. buildAtsAnalyzerPrompt(cv, jd, role, company)
  3. generateAtsAnalysis via Anthropic tool_use (submit_ats_analysis)
  4. UPDATE ats_analysis=<result>, ats_status='complete'
  5. revalidatePath(/prep/[id])
```

Mesma arquitetura tool_use do #2a v2 (comprovadamente confiável).

## DB — Migration `0004_ats_analysis.sql`

```sql
ALTER TABLE public.prep_sessions
  ADD COLUMN ats_analysis JSONB,
  ADD COLUMN ats_status TEXT
    CHECK (ats_status IS NULL OR ats_status IN ('generating','complete','failed')),
  ADD COLUMN ats_error_message TEXT;
```

Sem nova tabela. Colunas nullable; rows antigas não afetadas.

## Schema Zod — `atsAnalysisSchema` em `src/lib/ai/schemas.ts`

```ts
export const atsKeywordSchema = z.object({
  keyword: z.string().min(1),
  found: z.boolean(),
  context: z.string().optional(),
});

export const atsFixSchema = z.object({
  priority: z.number().int().min(1).max(10),
  gap: z.string().min(1),
  original_cv_language: z.string(),
  jd_language: z.string().min(1),
  suggested_rewrite: z.string().min(20),
});

export const atsAnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  title_match: z.object({
    cv_title: z.string(),
    jd_title: z.string(),
    match_score: z.number().int().min(0).max(100),
  }),
  keyword_analysis: z.object({
    critical: z.array(atsKeywordSchema).min(0).max(30),
    high: z.array(atsKeywordSchema).min(0).max(40),
    medium: z.array(atsKeywordSchema).min(0).max(40),
  }),
  top_fixes: z.array(atsFixSchema).min(1).max(7),
  overall_assessment: z.string().min(30),
});
export type AtsAnalysis = z.infer<typeof atsAnalysisSchema>;
```

## Prompt — `src/lib/ai/prompts/ats-analyzer.ts`

System instrui Claude (via tool `submit_ats_analysis` com JSON schema espelhando Zod):
- Extrair keywords EXATAS do JD em 3 tiers:
  - **critical** (3x weight): título + key responsibilities + required qualifications
  - **high** (2x): responsibilities OR qualifications
  - **medium** (1x): mencionado 1x ou preferred
- Match literal contra CV (NÃO semântica — "digital transformation" ≠ "procurement transformation")
- `score` = weighted % de criticals encontrados
- `top_fixes`: 5 mais impactantes, com:
  - `original_cv_language`: frase atual do CV (ou "" se totalmente ausente)
  - `jd_language`: frase exata do JD
  - `suggested_rewrite`: bullet reescrito do CV incorporando a linguagem da JD
- `overall_assessment`: 2-3 frases de diagnóstico geral

User msg: CV + JD + role + company.

## Anthropic — `generateAtsAnalysis` em `src/lib/ai/anthropic.ts`

Padrão `tool_use` idêntico ao `generateSection`:
- Model: `claude-sonnet-4-5`
- `max_tokens: 3500`
- `tool_choice: { type: "tool", name: "submit_ats_analysis" }`
- Timeout 120s
- `MOCK_ATS_ANALYSIS` fixture quando `MOCK_ANTHROPIC=1` (score 73, 5 fixes, ~15 keywords total)
- Log `[anthropic] ats completed in Xms`
- Retorna `AtsAnalysis` validado

## Server Action — `src/app/prep/[id]/ats-actions.ts`

```ts
"use server";
export async function runAtsAnalysis(sessionId: string) {
  // auth + RLS check via Supabase
  // load session (cv_text, job_description, job_title, company_name)
  // verify session.ats_status is null or 'failed' (idempotent against double-click)
  // UPDATE ats_status='generating'
  // try: generateAtsAnalysis → UPDATE ats_analysis, ats_status='complete'
  // catch: UPDATE ats_status='failed', ats_error_message
  // revalidatePath(`/prep/${sessionId}`)
}
```

Inline sync (igual createPrep), ~10-20s. Sem retry automático (botão re-run se `ats_status === 'failed'`).

## UI Components

### `AtsCtaCard.tsx` (server component)
Banner no topo de `/prep/[id]` quando `ats_status === null`:
- Título: "Check your ATS match"
- Subtítulo: 2 linhas explicando ATS + que cola rewrite suggestions
- Botão "Run ATS Match" (`<form action={runAtsAnalysisAction}>`)
- Enquanto `ats_status === 'generating'`: PendingButton style (spinner + texto)

### `AtsScoreCard.tsx` (server component)
Quando `ats_status === 'complete'`:
- **Circular progress** SVG com score (cor: red-500 <40, amber-500 40-70, emerald-500 >70)
- Title match badge
- `overall_assessment` em parágrafo
- Grid/list de **top_fixes** — cada um um mini-card expansível com priority badge, original vs JD side-by-side, suggested_rewrite
- Link "View keyword list" → expande `AtsKeywordsList`

### `AtsKeywordsList.tsx` (client, expansível)
3 colunas: Critical / High / Medium. Cada keyword com ✓ found ou ✗ missing. Hover mostra `context` se presente.

### `AtsFailed.tsx` (server)
Quando `ats_status === 'failed'`: mensagem + botão re-run + `ats_error_message` em `<pre>`.

### `/prep/[id]/page.tsx` alterações
No topo, antes do `<PrepGuide>`, renderiza condicionalmente um dos 4 estados (null → CTA, generating → skeleton, complete → ScoreCard, failed → Failed).

## E2E test — `tests/e2e/ats.spec.ts`

Com `MOCK_ANTHROPIC=1`:
1. Signup + create prep (reutiliza flow do prep.spec)
2. Landing no `/prep/[id]` → vê AtsCtaCard com botão "Run ATS Match"
3. Click botão → aguarda score aparecer
4. Assert score badge visível (ex: "73")
5. Assert pelo menos 1 top fix visível
6. Expand keyword list → assert "critical" header

## Tratamento de erros

| Cenário | Comportamento |
|---|---|
| Claude API fail | UPDATE ats_status=failed + ats_error_message; UI mostra AtsFailed |
| Zod validation fail | Mesmo — treat as generic failure |
| User double-click CTA | Server Action guard: se status já 'generating', no-op |
| User navega away | Action roda até fim (same as createPrep) |
| API key missing | Exceção com mensagem clara "ANTHROPIC_API_KEY not set" |

## Definition of Done

1. Migration 0004 aplicada local + prod
2. User logado vê `/prep/[id]` com CTA banner "Run ATS Match"
3. Click → ~15-20s skeleton → AtsScoreCard renderiza
4. Score numerado + cor correta (vermelho/amarelo/verde)
5. 5 top fixes visíveis com original/JD/rewrite
6. Keywords list expandível com 3 tiers
7. Failed state: re-run funciona
8. E2E passa com MOCK_ANTHROPIC=1
9. Tag `ats-analyzer-2d-v1` após smoke prod

## Fora de escopo

- **Tier gating** (free limita a 3 fixes; pro libera tudo) — #3 freemium gate
- **Auto-gerar CV otimizado** ("Generate ATS-optimized CV" rewrites whole CV) — #2d-v2
- **Dashboard badge** com score — nice-to-have; se sobrar, adiciono
- **Re-run automático** em failure (1 retry + backoff) — #2d-v2
- **PT-BR/ES** — #5 polish
- **Score histórico** (ver como mudou ao longo do tempo) — backlog

## Estimativa

~10 arquivos novos/modificados, ~2-4h de execução via subagents. Custo Claude: ~$0.03-0.05 por análise (1 call, 3500 max_tokens).
