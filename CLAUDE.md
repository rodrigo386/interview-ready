# CLAUDE.md — PrepaVAGA / InterviewReady

Guia de contexto para o Claude trabalhar nesse repo. Atualizado em 2026-04-24.

---

## 1. O produto

**PrepaVAGA** (codinome interno: InterviewReady) é uma plataforma SaaS PT-BR que transforma uma descrição de vaga + CV em um kit de preparação personalizado para entrevistas (5 etapas: Visão geral, ATS, Perguntas básicas, Aprofundamento, Você pergunta).

- Tagline: "Walk into every interview like you already work there."
- Modelo: freemium (Free / Pro $19/mês / per-use $9)
- Idioma do conteúdo gerado: **PT-BR** (mesmo se CV/JD vierem em inglês)
- Spec completa: `ARCHITECTURE.md`
- App live no Railway, auto-deploy do `main` via GitHub integration (railway-app[bot])

---

## 2. Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15.5 (App Router, RSC, standalone output) |
| Runtime | Node 20 (Alpine no container Railway) |
| UI | React 19 + Tailwind v4 (`@import "tailwindcss"` + `@config "../../tailwind.config.ts"`) |
| Lang | TypeScript strict |
| DB / Auth / Storage | Supabase (project `reslmtzofwczxrswulca`) |
| AI — sections + CV rewrite | **Google Gemini** (`gemini-3.1-flash-lite-preview`) via `@google/generative-ai` |
| AI — ATS analysis + Company intel + web_search | **Anthropic Claude Sonnet 4.5** (`claude-sonnet-4-5`) via `@anthropic-ai/sdk` |
| File parse | `pdf-parse@2` (PDF), `mammoth` (DOCX) |
| PDF gen | `pdf-lib` |
| URL fetch | Jina Reader (`https://r.jina.ai/<URL>`) — free, no key, handles JS-rendered pages |
| Tests | Vitest (unit/component) + Playwright (e2e) |
| Deploy | Railway (Dockerfile, Node 20 Alpine, `node server.js`) |
| Hosting | Railway service `facccb47-595b-4fd5-8272-dd54354043be` |

### Env vars obrigatórias (Railway)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` — para ATS / company intel / web_search
- `GOOGLE_API_KEY` — **OBRIGATÓRIO** para sections + CV rewrite. Sem ele, geração quebra com `"GOOGLE_API_KEY is not set"`. Get em https://aistudio.google.com/apikey
- `MOCK_ANTHROPIC=1` — kill switch global de AI nos tests

---

## 3. Arquitetura do fluxo `/prep/[id]` — Opção A · Minimalista Progressivo

5 rotas dedicadas (não single-page com `?section=`):

```
/prep/[id]              → Tela 1 (Visão geral): FocusCard dinâmico + SkipCard + 6 PrepDetails cards + DeletePrep
/prep/[id]/ats          → Tela 2: Gauge SVG + AtsHero + DeltaBanner + 3 IssueRows + CV rewrite block
/prep/[id]/likely       → Tela 3: QuestionPager accent="orange" (perguntas básicas)
/prep/[id]/deep-dive    → Tela 4: QuestionPager accent="yellow" (aprofundamento)
/prep/[id]/ask          → Tela 5: SuccessBanner + QuestionPager accent="green" (você pergunta)
```

**Layout shell** em `src/app/prep/[id]/layout.tsx` (server) lê a sessão UMA vez, valida `prep_guide`, calcula `serverCompleted` (steps 1+2 do DB), e injeta:
- `PrepBreadcrumb` (← Voltar — vai pra `/dashboard` se na visão geral, pra `/prep/[id]` se em sub-rota)
- `PrepStepper` 5 segmentos (mobile colapsa labels, desktop mostra)
- `PrepSidebar` (lg+ apenas, sticky) — 5 itens com status dots verde/laranja/outline
- `<main>{children}</main>`

**Step state derivado:** server fornece steps 1-2 (`prep_guide` ready + `ats_status === 'complete'`); steps 3-5 vêm de `localStorage` (chave `prepavaga:steps:<sessionId>`). `PrepShellProvider` (client context) une os dois e expõe `markStepComplete(step)` que **atualiza state imediatamente + persiste** — same-tab updates funcionam (StorageEvent só dispara cross-tab).

**`QuestionPager` (client)** recebe `pages: PagerPage[]` **pré-renderizadas** (JSX serializa cross RSC boundary, closures não — não passar `buildSections: fn` do server). Ao chegar na última pergunta, chama `markStepComplete` do context + `router.push(nextHref)`.

**Pipeline de geração** (`src/lib/ai/pipeline.ts`):
- Stage A: company research (Claude Sonnet + `web_search` server-side tool, multi-turn)
- Stage B: 5 chamadas paralelas de sections via Gemini Flash (likely/deep-dive/tricky/questions-to-ask/mindset)
- ATS analysis e CV rewrite são server actions separadas, disparadas pelo user na tela ATS

---

## 4. Componentes-chave (`src/components/prep/`)

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `PrepShellProvider` | client context | step state + `markStepComplete` |
| `PrepStepperBound` / `PrepStepper` | client | 5 segmentos com `role="progressbar"` |
| `PrepBreadcrumb` | client | back link contextual via `usePathname()` |
| `PrepSidebar` | client (lg+) | nav vertical com status dots |
| `Tela1Visual` | client | Header empresa + FocusCard + SkipCard + PrepDetails + zona de perigo |
| `PrepDetails` | client | 6 cards collapsible: JD, empresa, recrutador (placeholder), notícias, Glassdoor (placeholder), intel |
| `FocusCard` / `SkipCard` / `SuccessCard` | mixed | hero CTA + atalho + variante step-5-completo |
| `SuccessBanner` | server | banner verde topo da Tela 5 |
| `QuestionCard` / `QuestionPager` | client | card de pergunta com 3 accents + paginação |
| `Chip` / `Gauge` / `IssueRow` / `AtsHero` | server | átomos da Tela 2 |
| `JobDescriptionPicker` | client | toggle Colar texto / Enviar link (Jina Reader) |
| `CvPicker` | client | toggle existing CV / upload PDF/DOCX/TXT / paste |
| `NewPrepForm` | client | orquestra picker + submit createPrep |

Helpers em `src/lib/prep/`:
- `section-classifier.ts` — mapeia `PrepSection[]` AI → `{likely, deepDive, ask}` por keyword regex (PT/EN, acentos, snake_case) + fallback posicional
- `step-state.ts` — `computeServerCompleted`, `mergeCompleted`, `resolveCurrentStep`, `markStepComplete` (writeLocal), `readLocalCompleted`, `storageKey`
- `types.ts` — `StepNumber`, `Accent`, `STEP_LABELS`, `PrepShellData`

---

## 5. Design tokens (Tailwind config)

Novos tokens **paralelos** aos `brand-*` existentes (não tocar `brand-600` — landing/dashboard/UI compartilhada dependem dele):

| Token | Valor |
|---|---|
| `orange-{500,700,soft}` | `#F15A24` / `#D94818` / `#FFE7DC` |
| `green-{500,700,soft}` | `#2DB87F` / `#1F7A56` / `#E0F5EB` |
| `yellow-{500,700,soft}` | `#F5B800` / `#B08600` / `#FFF4D1` |
| `red-{500,soft}` | `#E54848` / `#FDE3E3` |
| `ink` / `ink-2` / `ink-3` | `#1A1A1A` / `#4A4A4A` / `#8A8A8A` |
| `line` | `#E8E8E8` |
| `borderRadius.pill` | `999px` |
| `boxShadow.prep` | `0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)` |

CSS vars em `globals.css`: `--prep-red/--prep-yellow/--prep-green` (consumidas via `var()` no Gauge.tsx). Bloco global `@media (prefers-reduced-motion: reduce)` honrado.

**Ciente:** `extend.colors.red = {DEFAULT,500,soft}` em Tailwind v4 + `@config` faz **MERGE** com defaults (não shadow) — verificado empiricamente. Os 32 usos de `red-700`/`red-300`/etc. existentes continuam funcionando.

---

## 6. Convenções e armadilhas conhecidas

### Server → Client RSC boundary
- **Funções não serializam.** Server pages NÃO podem passar `buildSections: (card) => [...]` para client components. JSX serializa — passa `pages: PagerPage[]` pré-renderizadas. Bug `digest 1599833247` foi exatamente isso (PR #22).

### PDF parsing (pdf-parse v2 + pdfjs-dist v5)
- pdfjs-dist v5 referencia `DOMMatrix`/`ImageData`/`Path2D` em load time. Sem `@napi-rs/canvas` em Node, parsing quebra com `ReferenceError: DOMMatrix is not defined`.
- **Solução adotada (PR #17):** stubs identity em `src/lib/files/dom-polyfill.ts`, instalados via `src/instrumentation.ts` (Next.js hook que roda 1× no boot do server, antes de qualquer rota). Para text-only extraction (`getText()`), matrix math identity preserva conteúdo do texto.
- Também tem fallback em `src/lib/files/parse.ts` que importa o polyfill antes de `pdf-parse`.

### Tailwind v4 schema gotchas
- `EnumStringSchema` da `@google/generative-ai` exige `format: "enum"` quando há `enum` no STRING type — TS rejeita sem isso.
- Cast `Schema` para evitar widening da union `SchemaType`.

### Server actions stale após redeploy
- `Failed to find Server Action <hash>`: cliente em sessão antiga referencia action ID que não existe no novo bundle. Hard refresh resolve. Não é um bug nosso — comportamento esperado do Next.js 15 com versionamento de actions.

### AI rate limits
- Anthropic Sonnet org limit: 30k input tokens/min. As 5 chamadas paralelas de sections em série batiam isso → **migrado para Gemini Flash** (PR #19, ajustado para `gemini-3.1-flash-lite-preview` em PR #21).
- CV rewrite também migrado para Gemini (PR #25).

### Schema limits
- Real Claude/Gemini responses excedem limites Zod restritivos. Histórico de bumps:
  - `companyIntel.strategic_context.max(600)` → `2000` (PR #22)
  - `cvRewrite.summary_of_changes.max(10)` → `40`, `preserved_facts.max(20)` → `60`, `markdown.max(12000)` → `20000` (PR #24)
- **Atualizar AMBOS:** Zod schema em `schemas.ts` E o JSON tool schema mirror em `anthropic.ts` — senão Claude é capado no wire level.

### Tailwind tokens / brand-600
- **NÃO trocar `brand-600` (`#EA580C`)** — landing/dashboard/UI compartilhada dependem. Sempre adicione tokens novos paralelos (`orange-*`, `green-*`, etc.).

### Duplicate prep detection
- `createPrep` server action hasheia (lowercase + collapse whitespace + SHA256) o JD recebido e compara com preps existentes do user. Match retorna `CreatePrepState.duplicate` em vez de gerar novo. UI renderiza panel amarelo com link "Abrir prep existente →". (PR #23)

---

## 7. Schema Supabase (resumo)

Tabelas em `public`:

- **`profiles`** (extends `auth.users`): id (uuid), full_name, email, preferred_language (en|pt-br|es), tier (free|pro|team), preps_used_this_month, preps_reset_at
- **`cvs`**: id (uuid), user_id, file_name, file_path, file_size_bytes, mime_type, parsed_text
- **`prep_sessions`**: id (uuid), user_id, job_title, company_name, cv_text, cv_id (FK→cvs), job_description, language, prep_guide (jsonb), generation_status (pending|generating|complete|failed), error_message, ats_analysis (jsonb), ats_status (NULL|generating|complete|failed), ats_error_message, company_intel (jsonb), company_intel_status (pending|researching|complete|failed|skipped), company_intel_error, cv_rewrite (jsonb), cv_rewrite_status (pending|generating|complete|failed), cv_rewrite_error

Storage bucket: `cvs` (org-scoped por user_id). RLS ativado em todas tabelas.

---

## 8. Rotas API/server

| Rota | Método | Função |
|---|---|---|
| `/prep/new` | server action `createPrep` | gerar novo prep (com duplicate JD detection) |
| `/prep/new` | server action `uploadCv` | upload + parse de PDF/DOCX/TXT |
| `/prep/new` | server action `fetchJdFromUrl` | extrai texto de URL via Jina Reader |
| `/prep/[id]/ats` | server action `runAtsAnalysis` | dispara ATS analysis (Sonnet) |
| `/prep/[id]/ats` | server action `runCvRewrite` | dispara CV rewrite (Gemini) |
| `/prep/[id]/cv-rewrite.docx` | GET route | DOCX do CV reescrito |
| `/prep/[id]/summary.pdf` | GET route | PDF resumo do prep (pdf-lib, A4) |
| `/prep/[id]` (delete) | server action `deletePrep` | remove prep |

---

## 9. Workflow de desenvolvimento

- **Branch convention:** `feat/...` ou `fix/...`. Não trabalhe direto em `main`.
- **Commits:** mensagem em PT-BR ou EN, padrão `tipo(escopo): descrição`. Bodies multi-linha explicando o **porquê**.
- **PRs:** sempre via `gh pr create`. Auto-merge não habilitado no repo — squash-merge manual via `gh pr merge $PR --squash --delete-branch`.
- **CI:** GitHub Actions roda typecheck + tests. Supabase Preview check roda migrations (frequentemente falha em rebases por `relation already exists` — não-blocker).
- **Deploy:** push pra `main` → railway-app[bot] auto-deploy em ~90s.
- **Logs Railway:** acesso interativo via `railway link` (não dá pra rodar CLI autônomo). User precisa colar logs no chat para debug remoto. Supabase logs (`mcp__claude_ai_Supabase__get_logs`) acessíveis via MCP.

### Testes locais
```bash
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest run (87 tests)
pnpm test:e2e           # playwright (precisa dev server rodando)
pnpm lint               # next lint (warnings pré-existentes em prompts/section-generator.ts)
pnpm build              # next build standalone
```

Vitest config: `environment: "node"` por default, jsdom só em `src/components/**/*.test.{ts,tsx}` via `environmentMatchGlobs`. `vitest.setup.ts` carrega `@testing-library/jest-dom` matchers.

---

## 10. Histórico recente (PRs #14-#25, abril 2026)

Em ordem cronológica, mais recente embaixo:

| PR | Descrição |
|---|---|
| #14 | **Opção A redesign** — 5 telas roteadas + PrepStepper + QuestionCard. Removeu JourneyArc/SectionTabs/ContinueCard/PrepOverview |
| #15 | Breadcrumb contextual (volta pra /prep/[id] em sub-rotas, não pro /dashboard) |
| #16 | Adiciona `@napi-rs/canvas` + `outputFileTracingIncludes` (não funcionou em Alpine) |
| #17 | **DOMMatrix polyfill** via `instrumentation.ts` — fix definitivo do PDF parsing |
| #18 | Sections para Haiku (workaround temporário do rate limit Sonnet) |
| #19 | Sections para **Gemini 2.5 Flash** (substitui #18) — adiciona `GOOGLE_API_KEY` env |
| #20 | **PrepSidebar** (lg+ apenas) — nav vertical com status dots |
| #21 | JD via URL (Jina Reader) + modelo `gemini-3.1-flash-lite-preview` |
| #22 | **PrepDetails** (6 cards na Tela 1) + JD textarea full text + fix RSC `buildSections` + bump `strategic_context.max(2000)` |
| #23 | Sections em **PT-BR** + stepper sync via context + **Export PDF real** (`pdf-lib` + `/summary.pdf`) + **duplicate JD detection** |
| #24 | Bump `cvRewriteSchema` limits (`summary_of_changes` 10→40, `preserved_facts` 20→60, `markdown` 12k→20k) — Zod + Anthropic JSON mirror |
| #25 | CV rewrite migrado para **Gemini Flash** (mesmo modelo das sections) |

---

## 11. Pendências / known gaps

- **Recrutador placeholder** em PrepDetails — não tem extração real ainda (regex no JD ou AI call)
- **Glassdoor placeholder** — exige integração externa (API paga ou scraping)
- **Export PDF resumo:** funciona mas o layout é minimalista (sem cores). Pode receber pass de design futuro.
- **`@napi-rs/canvas` warnings** continuam aparecendo no boot do Railway (cosmético — polyfill resolve o problema funcional).
- **`generateCvRewrite` em `anthropic.ts`** ficou unused após PR #25 — limpar em cleanup PR.
- **2 lint warnings** em `src/lib/ai/prompts/section-generator.ts` (`prepSectionSchema`, `z` unused) — pré-existentes, não bloqueantes.
- **E2E `prep-flow.spec.ts`** escafoldado mas precisa dev server rodando — não validado em CI.

---

## 12. Comandos úteis

```bash
# Dev local
pnpm dev

# Forçar deploy Railway (geralmente automático)
git push origin main

# Inspecionar Supabase
# (via MCP — list_projects, get_logs, list_tables, execute_sql)

# Ver deploy status
gh api repos/rodrigo386/interview-ready/deployments?per_page=2

# Mergear PR (auto-merge não habilitado)
gh pr merge $PR --squash --delete-branch
```
