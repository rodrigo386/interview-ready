# CLAUDE.md — PrepaVAGA / InterviewReady

Guia de contexto para o Claude trabalhar nesse repo. Atualizado em 2026-04-27.

## 0. Estado atual — produção ao vivo

PrepaVAGA está **em produção** desde 2026-04-27 em `https://prepavaga.com.br`. Todos os bloqueadores de go-live foram concluídos:

- ✅ Domínio custom (Cloudflare DNS + Railway Let's Encrypt + middleware 308 www→apex)
- ✅ Resend SMTP transacional + 4 templates PT-BR + Confirm email ON
- ✅ Asaas em produção (CNPJ PROAICIRCLE Ltda verificado, webhook ao vivo, validação end-to-end com R$10 cartão + estorno)
- ✅ Páginas legais (`/termos`, `/privacidade`, `/lgpd`)
- ✅ Rate limit Upstash · OG image dinâmico · Admin role + dashboard expandido
- ✅ Custom domain workflow (DNS-only, sem proxy laranja na Cloudflare — proxy quebra SSL do Railway)

Próximas alavancas são pós-launch (analytics, Sentry, sitemap, welcome email).

---

## 1. O produto

**PrepaVAGA** (codinome interno: InterviewReady) é uma plataforma SaaS PT-BR que transforma uma descrição de vaga + CV em um kit de preparação personalizado para entrevistas (5 etapas: Visão geral, ATS, Perguntas básicas, Aprofundamento, Você pergunta).

- Tagline: "Walk into every interview like you already work there."
- Modelo: freemium em BRL · **Free 1 prep grátis vitalícia (concedida no cadastro)** · **Pro R$30/mês ilimitado** (promo de lançamento, preço cheio R$50) · **Per-use R$10 = 1 prep avulso**. CPF é coletado e validado no signup (obrigatório).
- Gateway de pagamento: **Asaas** (sandbox + production), checkout hosted (PCI scope = zero)
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
| AI — sections + ATS + CV rewrite | **Google Gemini** (`gemini-3.1-flash-lite-preview`) via `@google/generative-ai` |
| AI — Company intel (com Google Search grounding) | **Google Gemini** (`gemini-3.1-flash-lite-preview`) via `@google/generative-ai` |
| File parse | `pdf-parse@2` (PDF), `mammoth` (DOCX) |
| PDF gen | `pdf-lib` |
| URL fetch | Jina Reader (`https://r.jina.ai/<URL>`) — free, no key, handles JS-rendered pages |
| Tests | Vitest (unit/component) + Playwright (e2e) |
| Deploy | Railway (Dockerfile, Node 20 Alpine, `node server.js`) |
| Hosting | Railway service `facccb47-595b-4fd5-8272-dd54354043be` |

### Runbooks de produção

Tarefas que são **só dashboard + env vars** (sem código) têm runbook próprio:

- **`docs/email-setup.md`** — Resend + Supabase Auth SMTP, com templates PT-BR prontos pra colar (Confirm signup, Magic Link, Reset Password, Change Email). Sem isso, default do Supabase é rate-limited (~3/h).
- **`docs/asaas-production.md`** — sandbox → produção: criar conta PJ no Asaas, KYB com docs do CNPJ 62.805.016/0001-29, gerar API key prod, configurar webhook prod, trocar `ASAAS_BASE_URL`+`ASAAS_API_KEY`+`ASAAS_WEBHOOK_TOKEN` no Railway, teste com cobrança real Pix/cartão.
- **`docs/custom-domain.md`** — Cloudflare DNS + Railway custom domain pra `prepavaga.com.br`: comprar no Registro.br, nameservers Cloudflare, CNAME apex+www apontando pra Railway (DNS only, sem proxy laranja), SSL auto via Let's Encrypt, redirect www→apex, atualizar `NEXT_PUBLIC_APP_URL` + Site URL Supabase + domínio Asaas, sitemap.ts + robots.ts opcionais.

### Admin

`profiles.is_admin = true` marca operadores. Admins (a) bypassam quota e reconcile, (b) ganham `tier=pro` + `subscription_status=active` permanentes (sem `asaas_subscription_id`), (c) veem o link "Admin ⚡" no AvatarMenu, (d) acessam `/admin` com sidebar nav (lg+) ou pill nav horizontal (mobile). Migration 0011 introduziu o flag e promoveu `rgoalves@gmail.com`.

**6 páginas:**
- `/admin` — KPIs (12 cards: total users, MRR, receita 30d, ativação, etc.) + 4 tabelas de atividade recente.
- `/admin/users` — tabela paginada (50/pág) com busca por e-mail + filtro Free/Pro + **botão Excluir** com confirmação. `deleteUserAction` em `src/app/admin/actions.ts` bloqueia self-delete e admin-on-admin (cascateia profile → preps → cvs → payments via FK).
- `/admin/metrics` — gráficos SVG puros (sem chart lib) com séries diárias para 7/30/90d: cadastros, preps geradas, receita R$, preps falhadas. `getHistoricalSeries()` em `src/lib/admin/timeseries.ts` faz bucketing diário via Map.
- `/admin/payments` — 100 transações mais recentes com filtro status + kind, total de receita confirmada.
- `/admin/preps` — 100 preps mais recentes com filtro de status, badges separados pra geração/ATS/intel/CV rewrite.
- `/admin/health` — 8 KPIs de falhas (amarelos quando >0) + listas de erros das 4 etapas de IA + preps travadas (>30min em pending/generating) + log de webhooks Asaas das últimas 24h.

**Charts**: `src/components/admin/charts.tsx` com `LineChart` + `BarChart` em SVG puro (grid 4-linha, axis labels, tooltips via `<title>`, brand-orange default). Sem dep nova no bundle.

**Helpers**: `requireAdmin()` em `src/lib/admin/auth.ts`, `getAdminOverview()` em `src/lib/admin/metrics.ts`, `getHistoricalSeries()` em `src/lib/admin/timeseries.ts`.

### Rate limiting

Server actions caras (createPrep, runAtsAnalysis, runCvRewrite, rerunCompanyIntel, fetchJdFromUrl) passam por `rateLimit()` em `src/lib/ratelimit.ts` (Upstash Ratelimit + Redis, sliding window). Limites por usuário: createPrep 3/h, ATS/CV/intel 10/h, fetchJd 30/h. Sem `UPSTASH_REDIS_REST_URL`+`UPSTASH_REDIS_REST_TOKEN`, o helper falha aberto (não bloqueia) — evita travar a app se Upstash cair.

### Env vars obrigatórias (Railway)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_API_KEY` — **OBRIGATÓRIO** para todas as chamadas de IA (sections, ATS, company intel, CV rewrite, JD cleanup). Sem ele, geração quebra com `"GOOGLE_API_KEY is not set"`. Get em https://aistudio.google.com/apikey
- `ASAAS_API_KEY` — sandbox/prod API key do Asaas (formato `$aact_...`). Sem ele, todo checkout/cancel falha com `"ASAAS_API_KEY is not set"`.
- `ASAAS_WEBHOOK_TOKEN` — token arbitrário (recomendo 32 chars). Tem que bater com o header `asaas-access-token` configurado no painel Asaas.
- `ASAAS_BASE_URL` — `https://sandbox.asaas.com/api/v3` (sandbox) ou `https://api.asaas.com/v3` (prod). Tem default de sandbox no schema. **Não setar como string vazia** (Zod rejeita). **Em produção: usar `api.asaas.com/v3`.**
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — opcionais. Habilitam rate limit em produção. Sem eles, o helper `rateLimit()` falha aberto (sem bloqueio).
- `MOCK_ANTHROPIC=1` — kill switch global de AI nos tests (nome legado, vale para Gemini agora)

### Setup Asaas (sandbox)
1. Conta criada em sandbox.asaas.com → cadastrar **domínio do app** em "Minha Conta → Informações" (sem isso, Asaas rejeita 400)
2. Integrações → Chave de API → copiar pra `ASAAS_API_KEY`
3. Integrações → Webhooks → criar webhook:
   - URL: `https://<app>.up.railway.app/api/asaas/webhook`
   - Header customizado: `asaas-access-token` = mesmo valor de `ASAAS_WEBHOOK_TOKEN`
   - Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `SUBSCRIPTION_DELETED` (mínimo)
   - Status: **Ativo**
4. Cartões de teste sandbox: `4444444444444448` aprova, `4444444444444441` recusa

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
- `PrepBreadcrumb` (← Voltar contextual + "Etapa N · <label>" no header)
- `PrepStepper` 5 segmentos **clicáveis** (cada segmento é Link pra rota da etapa, h-3 mobile / h-2 desktop, label sempre visível)
- `PrepSidebar` (lg+ apenas, sticky) — 5 itens com status dots verde/laranja/outline
- `MobileStepNav` (lg:hidden) — barra sticky no rodapé com 2 botões: "🏠 Visão geral" sempre visível em sub-rotas + "Próxima → <label>" / "✓ Concluído"
- `<main>{children}</main>` (com `pb-20 lg:pb-0` pra dar espaço ao mobile nav)

**Step state derivado:** server fornece steps 1-2 (`prep_guide` ready + `ats_status === 'complete'`); steps 3-5 vêm de `localStorage` (chave `prepavaga:steps:<sessionId>`). `PrepShellProvider` (client context) une os dois e expõe `markStepComplete(step)` que **atualiza state imediatamente + persiste** — same-tab updates funcionam (StorageEvent só dispara cross-tab).

**`QuestionPager` (client)** recebe `pages: PagerPage[]` **pré-renderizadas** (JSX serializa cross RSC boundary, closures não — não passar `buildSections: fn` do server). Ao chegar na última pergunta, chama `markStepComplete` do context + `router.push(nextHref)`.

**Pipeline de geração** (`src/lib/ai/pipeline.ts`):
- Stage A: company research via Gemini 3.1 Flash Lite Preview + `googleSearch` (single-call, JSON output via prompt — Gemini não permite grounding + responseSchema simultâneos). Antes era 2.5-flash mas chronic 503s forçaram a troca em 2026-04-29.
- Stage B: 5 chamadas paralelas de sections via Gemini 3.1 Flash Lite (likely/deep-dive/tricky/questions-to-ask/mindset)
- ATS analysis e CV rewrite são server actions separadas via Gemini 3.1 Flash Lite, disparadas pelo user na tela ATS

---

## 4. Componentes-chave (`src/components/prep/`)

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `PrepShellProvider` | client context | step state + `markStepComplete` |
| `PrepStepperBound` / `PrepStepper` | client | 5 segmentos clicáveis (Link p/ rota), `role="progressbar"` |
| `PrepBreadcrumb` | client | back link contextual + "Etapa N · <label>" |
| `PrepSidebar` | client (lg+) | nav vertical com status dots |
| `MobileStepNav` | client (lg:hidden) | barra sticky bottom com Visão geral + próxima |
| `Tela1Visual` | client | Header empresa + FocusCard + SkipCard + 3-card grid (CompanyCard/JobCard/IntelCard) + zona de perigo |
| `CompanyCard` | server | avatar com inicial + overview + chips "Vibe" + 2 notícias recentes + RerunIntelButton ghost |
| `JobCard` | client | resumo (1ª paragráfo) + "Ver descrição completa" expand → `JdRenderer` parsea bullets/headings |
| `IntelCard` | server | contexto estratégico + 3 pessoas-chave + 3 perguntas estratégicas |
| `JdRenderer` | universal | parser que detecta bullets (-/*/•/numerados) + headings (## / ALL CAPS / `:`) + paragráfos |
| `RerunIntelButton` | client | re-dispara Stage A on-demand via `rerunCompanyIntel` action |
| `FocusCard` / `SkipCard` / `SuccessCard` | mixed | hero CTA + atalho + variante step-5 (único botão Exportar PDF) |
| `SuccessBanner` | server | banner verde topo da Tela 5 com botão Exportar PDF |
| `QuestionCard` / `QuestionPager` | client | card de pergunta com 3 accents + paginação |
| `Chip` / `Gauge` / `IssueRow` / `AtsHero` | server | átomos da Tela 2 |
| `JobDescriptionPicker` | client | toggle Colar texto / Enviar link (Jina Reader + Gemini cleanup) |
| `CvPicker` | client | toggle existing CV / upload PDF/DOCX/TXT / paste |
| `NewPrepForm` | client | orquestra picker + submit createPrep + UpgradeModal em quota_exceeded |

**Profile area** (`src/components/profile/`): `ProfileShellProvider`, `ProfileTabs` (Perfil / CVs / Conta), `AvatarEditor`, `ProfileForm`, `CvList`/`CvRow`, `AccountSection`, `ChangePasswordDialog`, `DeleteAccountDialog`. Routes em `src/app/(app)/profile/`.

**Billing** (`src/components/billing/`): `UpgradeModal` (dual CTA, redireciona Pro pra `/pricing`), `CheckoutButton` (POST /api/billing/checkout, prompt CPF on 422), `PlanCard`, `BillingHistoryList`, `CancelSubscriptionDialog`, `FreeTierBanner` (link pra /pricing), `CreditsBadge`. Página `/pricing` mostra Pro com promo R$50 → R$30 + per-use R$10.

Helpers em `src/lib/prep/`:
- `section-classifier.ts` — mapeia `PrepSection[]` AI → `{likely, deepDive, ask}` por keyword regex (PT/EN, acentos, snake_case) + fallback posicional
- `step-state.ts` — `computeServerCompleted`, `mergeCompleted`, `resolveCurrentStep`, `markStepComplete` (writeLocal), `readLocalCompleted`, `storageKey`
- `types.ts` — `StepNumber`, `Accent`, `STEP_LABELS`, `PrepShellData`

Helpers em `src/lib/billing/`:
- `asaas.ts` — REST client (`createCustomer`, `updateCustomer`, `createSubscription`, `createPayment`, `cancelSubscription`, `getPayment`). `import "server-only"`.
- `quota.ts` — `checkQuota(profile, now)` retorna `{ allowed, mode: 'pro' | 'free' | 'credit' | 'reset' | 'block' }`
- `webhook.ts` — `verifyToken` (constant-time) + `dispatchEvent` (idempotente via UNIQUE asaas_event_id)
- `prices.ts` / `ids.ts` — constants + externalReference parser (`pro:uid` / `prep:uid:nano`)
- `types.ts` — Asaas + internal types

Helpers em `src/lib/profile/`: `gravatar.ts`, `avatar-url.ts`, `cv-merge.ts`, `types.ts`.

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
- Anthropic Sonnet org limit: 30k input tokens/min — não se aplica mais. Toda a IA agora roda no Gemini.
- Histórico: PR #19 migrou sections de Sonnet → Gemini Flash, PR #25 migrou CV rewrite, e a Sprint 1 (pós-PR #27) migrou ATS + company intel também. Anthropic SDK foi removido das deps.

### Schema limits
- Real Gemini responses excedem limites Zod restritivos. Histórico de bumps:
  - `companyIntel.strategic_context.max(600)` → `2000` (PR #22)
  - `cvRewrite.summary_of_changes.max(10)` → `40`, `preserved_facts.max(20)` → `60`, `markdown.max(12000)` → `20000` (PR #24)
  - `companyIntel.overview.max(600)` → `2000` (post-#26)
  - `companyIntel.questions_this_creates[*].max(200)` → `400` (PR #32)
- `source_url` em `recent_developments` foi **removido** do prompt e schema (PR #33) — Gemini grounding emite Vertex AI redirect URLs gigantes que quebravam o parser. `stripUrlFields()` no webhook faz cleanup defensivo se qualquer URL field aparecer.

### Gemini grounding (company intel)
- Gemini não permite `googleSearchRetrieval/googleSearch` + `responseSchema` na mesma call. Pedimos JSON via prompt e parseamos leniente.
- Cadeia de fallback: `googleSearch: {}` (Gemini 2.5+) → `googleSearchRetrieval: {}` (legacy 1.5) → ungrounded (training knowledge).
- `extractJsonObjects()` retorna TODOS os objetos JSON balanceados; tentamos cada candidato até passar Zod. Necessário porque Gemini às vezes emite múltiplos ```json blocks com citações entre.
- Re-run on-demand: `rerunCompanyIntel(sessionId)` em `src/app/prep/[id]/actions.ts` — botão "Pesquisar empresa" no CompanyCard/IntelCard quando intel é null/failed/skipped.

### PDF emoji crash (pdf-lib)
- pdf-lib's standard fonts (Helvetica) só suportam WinAnsi (≈ Latin-1 + CP1252). Emojis (`💬 🔍 🎯 ❓ 🧠`) nos `section.icon` quebravam `font.widthOfTextAtSize`. **Fix em `src/lib/files/prep-summary-pdf.ts`:** função `sanitize()` mapeia aspas curvas/em-dash/reticências pra ASCII e dropa qualquer codepoint > 0xFF. Aplicada em todo `drawText`. (PR #35)

### ATS determinism
- `temperature: 0` + `topK: 1` + `topP: 0` + rubric explícita (6 steps) no prompt. Score = `round((earned / max) * 90) + title_bonus`, weights critical=3 / high=2 / medium=1. Mesmo CV+JD = mesmo score. (PR #36)

### Tailwind tokens / brand-600
- **NÃO trocar `brand-600` (`#EA580C`)** — landing/dashboard/UI compartilhada dependem. Sempre adicione tokens novos paralelos (`orange-*`, `green-*`, etc.).

### Duplicate prep detection
- `createPrep` server action hasheia (lowercase + collapse whitespace + SHA256) o JD recebido e compara com preps existentes do user. Match retorna `CreatePrepState.duplicate` em vez de gerar novo. UI renderiza panel amarelo com link "Abrir prep existente →". (PR #23)

---

## 7. Schema Supabase (resumo)

Tabelas em `public`:

- **`profiles`** (extends `auth.users`): id (uuid), full_name, email, preferred_language (en|pt-br|es), tier (free|pro|team), preps_used_this_month, preps_reset_at, **avatar_url, avatar_updated_at** (#27), **asaas_customer_id, asaas_subscription_id, subscription_status (active|overdue|canceled|expired|none), subscription_renews_at, prep_credits** (migration 0009), **cpf_cnpj** (migration 0010)
- **`cvs`**: id (uuid), user_id, file_name, file_path, file_size_bytes, mime_type, parsed_text, **display_name** (#27)
- **`prep_sessions`**: id (uuid), user_id, job_title, company_name, cv_text, cv_id (FK→cvs), job_description, language, prep_guide (jsonb), generation_status (pending|generating|complete|failed), error_message, ats_analysis (jsonb), ats_status (NULL|generating|complete|failed), ats_error_message, company_intel (jsonb), company_intel_status (pending|researching|complete|failed|skipped), company_intel_error, cv_rewrite (jsonb), cv_rewrite_status (pending|generating|complete|failed), cv_rewrite_error
- **`payments`** (#37): id, user_id, asaas_payment_id (UNIQUE), kind (pro_subscription|prep_purchase), amount_cents, status (pending|confirmed|received|refunded|overdue|failed), billing_method, paid_at, raw_payload, created_at. RLS: user lê os próprios.
- **`subscription_events`** (#37): id, user_id, asaas_event_id (UNIQUE — chave de idempotência), event_type, asaas_subscription_id, asaas_payment_id, raw_payload, received_at. RLS: service-role only.

Storage buckets: `cvs` (privado, org-scoped por user_id), **`avatars`** (público, paths `{uid}/avatar.{ext}`). RLS ativado em todas tabelas.

---

## 8. Rotas API/server

| Rota | Método | Função |
|---|---|---|
| `/prep/new` | server action `createPrep` | gerar novo prep + **quota gate** (consome credit/free/reset) + duplicate JD detection |
| `/prep/new` | server action `uploadCv` | upload + parse de PDF/DOCX/TXT |
| `/prep/new` | server action `fetchJdFromUrl` | extrai texto via Jina Reader + cleanup Gemini (strip cookies/footer) |
| `/prep/[id]/ats` | server action `runAtsAnalysis` | dispara ATS analysis (Gemini, determinístico temp=0) |
| `/prep/[id]/ats` | server action `runCvRewrite` | dispara CV rewrite (Gemini) |
| `/prep/[id]` | server action `rerunCompanyIntel` | re-roda Stage A on-demand quando intel é null/failed |
| `/prep/[id]/cv-rewrite.docx` | GET route | DOCX do CV reescrito |
| `/prep/[id]/summary.pdf` | GET route | PDF resumo do prep (pdf-lib + sanitize emojis) |
| `/prep/[id]` (delete) | server action `deletePrep` | remove prep |
| `/api/cv/[id]/download` | GET route | signed URL redirect pra CV original (privado) |
| `/api/billing/checkout` | POST | cria customer/subscription/payment Asaas → retorna `checkoutUrl`. 422 `cpf_required` se profile.cpf_cnpj null e body sem cpfCnpj. |
| `/api/billing/cancel` | POST | cancela subscription Asaas + marca `canceled` localmente |
| `/api/asaas/webhook` | POST | receiver — valida `asaas-access-token` → `dispatchEvent` idempotente |
| `/profile`, `/profile/cvs`, `/profile/account` | server | área de perfil (avatar + CVs + plano + senha + delete) |
| `/pricing` | server | página de planos: Pro R$30 (promo) + per-use R$10 |

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

## 10. Histórico recente (PRs #14-#42, abril 2026)

Em ordem cronológica, mais recente embaixo:

| PR | Descrição |
|---|---|
| #14-#25 | (anteriores) Opção A redesign · DOM polyfill · migração sections/CV rewrite p/ Gemini · PrepSidebar · JD via URL · PrepDetails · PT-BR · Export PDF · duplicate JD · schema bumps |
| #27 | **Profile area** — `/profile` (Perfil/CVs/Conta), avatar (Gravatar fallback) + bucket `avatars`, CV mgmt unificado, change password, delete account via admin client. `(app)/` route group. Migration 0008. |
| #28 | **Toda IA migrada pra Gemini** — ATS + company intel saem do Anthropic Sonnet. `anthropic.ts` deletado, `@anthropic-ai/sdk` removido das deps, `ANTHROPIC_API_KEY` removido do env. Company intel via `googleSearch`+JSON-no-prompt. |
| #29 | **Visão geral redesign** — PrepDetails accordion → 3-card grid (CompanyCard/JobCard/IntelCard). Glassdoor + Recrutador removidos. |
| #30 | `rerunCompanyIntel` action + botão "Pesquisar empresa" + prompt focado em últimos 6 meses |
| #31 | Grounding fallback chain (`googleSearch` → `googleSearchRetrieval` → ungrounded) + JD parser com bullets/headings |
| #32 | Schema fixes: `companyIntel.overview` 600→2000 + `questions_this_creates` 200→400 + JD URL cleanup via Gemini |
| #33 | Strip `source_url` (Vertex redirect URLs gigantes quebravam parser) + `extractJsonObjects` retorna todos blocos + remove "A pesquisa não rodou" |
| #34 | Company intel **PT-BR** via prompt + simplifica banner prep completo (único botão Exportar PDF) |
| #35 | PDF emoji crash — `sanitize()` em `prep-summary-pdf.ts` |
| #36 | ATS determinístico — temp=0 + topK=1 + rubric explícita de 6 steps |
| #37 | **Billing & paywall (Asaas)** — Free 1/30d · Pro R$30/mês · Per-use R$10. Migration 0009 (profiles cols + payments + subscription_events). Hosted checkout, idempotent webhook, hard-block + dual-CTA modal no createPrep. |
| #38 | CPF migration 0010 + 422 cpf_required + prompt no checkout (Asaas exige cpfCnpj) |
| #39 | Stepper clicável + MobileStepNav (sticky bottom, 2 botões) + breadcrumb com step name |
| #40 | CPF no signup form + `asaas.updateCustomer` (PATCH cpfCnpj em customers existentes) |
| #41 | Mobile nav: "🏠 Visão geral" sempre visível em sub-rotas + segments stepper maiores (h-3) |
| #42 | Página `/pricing` (Pro R$50→R$30 promo + per-use R$10). FreeTierBanner + UpgradeModal Pro CTA agora vão pra /pricing. |

---

## 11. Pendências / known gaps

- ~~**Webhook Asaas pode não estar entregando.**~~ Resolvido em prod 2026-04-27. Webhook autenticando, `subscription_events` recebendo eventos. Reconcile (`src/lib/billing/reconcile.ts`) ainda existe como safety net caso o webhook caia.
- **Host canonical (prepavaga.com.br vs railway.app):** o app respeita `x-forwarded-host` em `auth/callback/route.ts` e `api/billing/checkout/route.ts` — qualquer redirect/successUrl usa o host real da request, não o env var. Isso significa que o app continua funcionando se acessado via outro domínio que aponte pro Railway (útil em testes).
- **Cloudflare proxy laranja quebra SSL:** os 2 CNAMEs (apex `@` e `www`) PRECISAM ficar **DNS only** (cinza), porque Railway emite seu próprio cert via Let's Encrypt. Proxy ON na Cloudflare causa erro 526 / loop.
- **Redirect www→apex** é feito em `middleware.ts` com 308 (não Cloudflare Redirect Rules — essas exigem proxy ON). Header `x-forwarded-host` lido primeiro.
- **Resend sender DEVE ser apex** (`nao-responda@prepavaga.com.br`), NÃO subdomínio (`@send.prepavaga.com.br`). API key restrita ao apex rejeita o subdomínio com 550. Documentado em `docs/email-setup.md`.
- **Recrutador placeholder** removido na PR #29; Glassdoor também (não há API pública sustentável).
- **Export PDF resumo:** layout minimalista (sem cores).
- **`@napi-rs/canvas` warnings** continuam no boot Railway (cosmético — polyfill resolve).
- **2 lint warnings** em `src/lib/ai/prompts/section-generator.ts` — pré-existentes.
- **E2E em CI**: smoke tests (`tests/e2e/smoke/`) rodam sempre via GitHub Actions e cobrem páginas públicas (landing, signup, login, /termos, /privacidade, /lgpd, /icon.svg, /opengraph-image). Auth flow tests (`tests/e2e/auth-required/`) só rodam quando `STAGING_SUPABASE_URL` é setada como GitHub secret — projeto Supabase staging precisa ter email confirmation **OFF**. Especificações: `pnpm test:e2e:smoke` ou `pnpm test:e2e:auth`. Test fixtures usam CPF `12345678909` (formato válido, não precisa ser real).
- **`server-only` package** não está no `node_modules` real (Next 15 não re-exporta). Vitest aliasa pra stub vazio (`vitest.server-only-stub.ts`). Production funciona porque Next bundler resolve antes.

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
