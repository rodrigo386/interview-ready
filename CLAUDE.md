# CLAUDE.md — PrepaVAGA / InterviewReady

Guia de contexto para o Claude trabalhar nesse repo. Atualizado em 2026-08-17.

## 0. Estado atual — produção ao vivo

PrepaVAGA está **em produção** desde 2026-04-27 em `https://prepavaga.com.br`. Todos os bloqueadores de go-live foram concluídos:

- ✅ Domínio custom (Cloudflare DNS + Railway Let's Encrypt + middleware 308 www→apex)
- ✅ Resend SMTP transacional + 4 templates PT-BR + Confirm email ON
- ✅ Asaas em produção (CNPJ PROAICIRCLE Ltda verificado, webhook ao vivo, validação end-to-end com R$10 cartão + estorno)
- ✅ Páginas legais (`/termos`, `/privacidade`, `/lgpd`)
- ✅ Rate limit Upstash · OG image dinâmico · Admin role + dashboard expandido
- ✅ Custom domain workflow (DNS-only, sem proxy laranja na Cloudflare — proxy quebra SSL do Railway)
- ✅ Programa de parceiros (30% recorrente vitalício, payout automático Pix via Asaas Transfer com saque mín R$100, anti-fraude self-referral por user/CPF/email, auto-clawback ao cancelar assinatura, emails transacionais via Resend)
- ✅ SEO: sitemap + robots + JSON-LD por artigo + Featured Articles na landing + IndexNow ping (Bing/Yandex/Seznam) via botão `/admin`
- ✅ Page-view analytics próprio (middleware → Supabase REST direto, dashboard `/admin` com 24h/7d/30d/all-time totais e únicos, bots filtrados por UA)

Próximas alavancas pós-launch: Sentry, Plausible, sitemap automático, welcome email.

---

## 1. O produto

**PrepaVAGA** (codinome interno: InterviewReady) é uma plataforma SaaS PT-BR que transforma uma descrição de vaga + CV em um kit de preparação personalizado para entrevistas (5 etapas: Visão geral, ATS, Perguntas básicas, Aprofundamento, Você pergunta).

- Tagline: "Walk into every interview like you already work there."
- Modelo (desde **2026-08-17**): crédito avulso pré-pago em BRL. **Não existe preparação grátis nem assinatura.** A **análise ATS é o produto gratuito** (inclusive sem cadastro, em `/analise-ats-gratis`); a **preparação completa custa 1 crédito**, vendido a **R$10 avulso**, **3 por R$25** ou **5 por R$40** (`PREP_SKUS` em `src/lib/billing/prices.ts`). O upload gera o paywall; o crédito destrava. CPF é coletado e validado no signup (obrigatório).
  - O que morreu junto: `tier=pro`, `subscription_status`, o free vitalício e o soft cap mensal. As colunas continuam no banco de propósito (ver §11), mas **`checkQuota` só olha `prep_credits`** — marcar alguém como Pro não destrava nada. Para compensar um cliente, conceda crédito (`admin_grant_prep_credits` / botão **+ Crédito** no `/admin/users`).
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
| AI — sections + ATS + CV rewrite | **Google Gemini** (`gemini-3.1-flash-lite`) via `@google/generative-ai`. Fallback chain → `gemini-3-flash-preview` → `gemini-3.1-pro-preview` (era → **Cerebras** até 2026-08-16, removido — ver §10) |
| AI — Company intel (com Google Search grounding) | **Google Gemini** (`gemini-3.1-flash-lite`) via `@google/generative-ai` |
| File parse | `pdf-parse@2` (PDF), `mammoth` (DOCX) |
| PDF gen | `pdf-lib` |
| URL fetch | Jina Reader (`https://r.jina.ai/<URL>`) — free, no key, handles JS-rendered pages |
| Email transacional | **Resend** REST direto (não SDK), templates HTML inline. Auth flow ainda usa SMTP do Supabase. |
| SEO ping | **IndexNow** REST → Bing/Yandex/Seznam, key file público em `/public/<KEY>.txt` |
| Page-view analytics | Middleware Edge → Supabase REST direto, tabela `page_views`, agregação no `/admin` |
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
- `/admin` — KPIs (`buildKpis` em `src/lib/admin/metrics.ts`, contagem variável) + 4 tabelas de atividade recente. **Não há mais card de MRR**: ele calculava `proActive × R$30` num produto sem assinatura, e o único `tier=pro` restante é a conta admin — receita recorrente que não existe é pior que nenhuma. Receita real = "Receita últimos 30d". "Créditos não consumidos" é o passivo: preparação já paga e ainda não entregue.
- `/admin/users` — tabela paginada (50/pág) com busca por e-mail + filtro Free/Pro + **botão Excluir** com confirmação. `deleteUserAction` em `src/app/admin/actions.ts` bloqueia self-delete e admin-on-admin (cascateia profile → preps → cvs → payments via FK).
- `/admin/metrics` — gráficos SVG puros (sem chart lib) com séries diárias para 7/30/90d: cadastros, preps geradas, receita R$, preps falhadas. `getHistoricalSeries()` em `src/lib/admin/timeseries.ts` faz bucketing diário via Map.
- `/admin/payments` — 100 transações mais recentes com filtro status + kind, total de receita confirmada.
- `/admin/preps` — 100 preps mais recentes com filtro de status, badges separados pra geração/ATS/intel/CV rewrite.
- `/admin/health` — 8 KPIs de falhas (amarelos quando >0) + listas de erros das 4 etapas de IA + preps travadas (>30min em pending/generating) + log de webhooks Asaas das últimas 24h.

**Charts**: `src/components/admin/charts.tsx` com `LineChart` + `BarChart` em SVG puro (grid 4-linha, axis labels, tooltips via `<title>`, brand-orange default). Sem dep nova no bundle.

**Helpers**: `requireAdmin()` em `src/lib/admin/auth.ts`, `getAdminOverview()` em `src/lib/admin/metrics.ts`, `getHistoricalSeries()` em `src/lib/admin/timeseries.ts`.

### Rate limiting

Server actions caras (createPrep, runAtsAnalysis, runCvRewrite, rerunCompanyIntel, fetchJdFromUrl) passam por `rateLimit()` em `src/lib/ratelimit.ts` (Upstash Ratelimit + Redis, sliding window). Limites por usuário: createPrep 3/h, ATS/CV/intel 10/h, fetchJd 30/h. Sem `UPSTASH_REDIS_REST_URL`+`UPSTASH_REDIS_REST_TOKEN`, o helper falha aberto (não bloqueia) — evita travar a app se Upstash cair. **Cuidado com a leitura disso:** falhar aberto significa que, sem as env vars, nenhum desses limites existe de fato. `LIMITS.anonAts` é a única com `failClosed: true`, porque é endpoint anônimo que gasta IA e liberar geral ali seria pior do que ficar fora do ar.

### ~~Soft cap mensal Pro~~ — removido em 2026-08-17

`PRO_MONTHLY_SOFT_CAP` não existe mais. Ele defendia contra o abuser de um plano ilimitado; com crédito pré-pago, **o próprio crédito é o teto** — não há como gerar mais preparações do que se pagou, então um segundo contador só criava caminho para negar serviço a quem pagou. `isNewBillingCycle()` e o erro `pro_soft_cap` foram removidos junto. As colunas `preps_this_billing_cycle` / `billing_cycle_started_at` (migration 0014) continuam no banco, sem leitor.

### Env vars obrigatórias (Railway)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_API_KEY` — **OBRIGATÓRIO** para todas as chamadas de IA (sections, ATS, company intel, CV rewrite, JD cleanup). Sem ele, geração quebra com `"GOOGLE_API_KEY is not set"`. Get em https://aistudio.google.com/apikey
- `ASAAS_API_KEY` — sandbox/prod API key do Asaas (formato `$aact_...`). Sem ele, todo checkout/cancel falha com `"ASAAS_API_KEY is not set"`.
- `ASAAS_WEBHOOK_TOKEN` — token arbitrário (recomendo 32 chars). Tem que bater com o header `asaas-access-token` configurado no painel Asaas.
- `ASAAS_BASE_URL` — `https://sandbox.asaas.com/api/v3` (sandbox) ou `https://api.asaas.com/v3` (prod). Tem default de sandbox no schema. **Não setar como string vazia** (Zod rejeita). **Em produção: usar `api.asaas.com/v3`.**
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — **na prática, obrigatórias.** Estavam descritas como "opcionais" e isso era enganoso: sem elas TODOS os limites do app ficam inertes, silenciosamente — incluindo `authLogin` (proteção contra credential stuffing), `authSignup` e `passwordReset`, além dos limites de IA. A única exceção é `LIMITS.anonAts`, que tem `failClosed: true` e por isso RECUSA tudo quando o Redis falta, em vez de liberar. Descoberto em 2026-08-17, quando a ferramenta ATS anônima subiu e foi a primeira coisa a falhar ruidosamente.
- `IP_HASH_SALT` — opcional, usada para o `ip_hash` de auditoria da ferramenta ATS anônima. Sem ela, `hashIp()` devolve `null` e a coluna grava `null` (melhor do que gravar um hash com salt público, que seria reversível por força bruta no espaço de IPv4). O limite por IP continua funcionando com o IP cru como chave.
- `ANON_ATS_DAILY_CAP` — opcional, padrão 200. Disjuntor de custo da ferramenta ATS anônima: teto global de análises por dia. Independe do Upstash.
- `RESEND_API_KEY` — opcional, **scope "Sending Access" apenas** (NÃO confundir com SMTP key do Supabase Auth). Habilita emails transacionais de parceiro (aprovação/rejeição/payout). Sem ele, `sendEmail()` loga warn e segue.
- `MOCK_ANTHROPIC=1` — kill switch global de AI nos tests (nome legado, vale para Gemini agora)

### Setup Asaas (sandbox)
1. Conta criada em sandbox.asaas.com → cadastrar **domínio do app** em "Minha Conta → Informações" (sem isso, Asaas rejeita 400)
2. Integrações → Chave de API → copiar pra `ASAAS_API_KEY`
3. Integrações → Webhooks → criar webhook:
   - URL: `https://<app>.up.railway.app/api/asaas/webhook`
   - Header customizado: `asaas-access-token` = mesmo valor de `ASAAS_WEBHOOK_TOKEN`
   - Eventos pagamento: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `SUBSCRIPTION_DELETED`
   - Eventos transfer (afiliados): `TRANSFER_DONE`, `TRANSFER_FAILED`, `TRANSFER_CANCELLED`, `TRANSFER_PENDING`, `TRANSFER_BANK_PROCESSING`
   - Status: **Ativo**
4. Cartões de teste sandbox: `4444444444444448` aprova, `4444444444444441` recusa

### Programa de parceiros

> ⏸️ **Front-end PAUSADO desde 2026-07-01** ("não vamos utilizar por enquanto"). As rotas públicas `/parceiros` e `/partner` redirecionam pra `/` (307 temporário em `next.config.ts`), o item "Programa de parceiros" saiu do `AvatarMenu`, `/sobre` não menciona mais, o IndexNow não pinga `/parceiros`, e a Section "Programa de parceiros" (KPIs pending/active/payable) saiu do `/admin` overview (`getPartnerStats` removido junto). **Backend intacto** (tabelas `affiliate_*`, webhook TRANSFER_*/clawback, atribuição `pv_ref` no middleware) — nada foi deletado. A rota `/admin/affiliates` **continua existindo mas sem link** (acessível por URL direta pra gerenciar dados existentes). **Reativar** = remover os 2 blocos de redirect no `next.config.ts` + restaurar o `<Link href="/parceiros">` no `AvatarMenu` + reintroduzir a Section + `getPartnerStats` no `/admin`. Commits `b79416a` + `35bdae5` + este. A doc abaixo descreve o comportamento quando estava/estiver ligado.

30% recorrente vitalício. Cliente paga R$30/mês → parceiro recebe R$9/mês enquanto cliente for Pro ativo. Saldo acumula até atingir **R$ 100,00** (`MIN_PAYOUT_CENTS = 10000` em `src/lib/affiliate/payout.ts`); a partir desse threshold o admin clica **"Pagar via Pix"** em `/admin/affiliates` e o sistema dispara Asaas Transfer pra chave do parceiro automaticamente.

**Fluxo do parceiro** (`/parceiros` → aplicação · `/partner` → painel):
- `/parceiros`: landing pública + form. Se user logado já tem `affiliate_partners` row, redirect server-side pra `/partner`.
- `/partner` (status-aware): pending → banner amarelo + ref code + próximos passos · suspended → distingue rejeitado (`approved_at IS NULL`) de banido · active → CodeBox + 7 cards earnings + barra progresso R$100 + Pix key card editável + histórico de comissões
- Anti-fraude na atribuição (`src/lib/affiliate/attribution.ts`):
  - **Block** mesmo `user_id`, mesmo CPF normalizado, email idêntico case-insensitive
  - **Flag** mesmo domínio APENAS se NÃO for genérico (gmail/outlook/etc whitelist em `GENERIC_EMAIL_DOMAINS`)
  - Dia 1 da janela de 7d: comissão fica `pending` · Após 7d: `confirmCommissions()` move pra `confirmed` · Pago: `paid` + `paid_at` + `paid_via=asaas_transfer:<id>` · Reembolsado/cancelado: `clawback`
- Auto-clawback: webhook `SUBSCRIPTION_DELETED` em `webhook.ts` marca todas as commissions ainda não pagas (`pending`+`confirmed`) do user como `clawback`. Já pagas (`paid`) ficam — sem reverter Pix.
- Webhook Asaas TRANSFER_*: atualiza `affiliate_payouts.status` em real-time. Se Transfer FALHA depois de marcarmos commissions como pagas, reverte `paid → confirmed` automaticamente pra admin retentar.

**Emails transacionais** (`src/lib/email/partner-emails.ts`):
- `sendPartnerApprovedEmail` (disparado por `approvePartner`)
- `sendPartnerRejectedEmail` (disparado por `denyPartner`)
- `sendPartnerPayoutSentEmail` (disparado por `payPartnerViaPix`, mascara chave Pix)
- Templates HTML inline mínimos. Falhas de envio NÃO bloqueiam a action principal (try/catch + console.warn). Sem `RESEND_API_KEY`, log "would have sent" e segue.

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

**Billing** (`src/components/billing/`): `UpgradeModal` (paywall em `quota_exceeded`), `CheckoutButton` (POST /api/billing/checkout, prompt CPF on 422), `PlanCard`, `BillingHistoryList`, `CancelSubscriptionDialog` (só para o assinante legado), `FreeTierBanner`, `CreditsBadge`, `PlanBadge` (mostra **saldo de créditos real** — antes anunciava um prep grátis que o gate não honra mais). Página `/pricing` mostra os 3 pacotes de crédito; não há mais plano mensal à venda.

Helpers em `src/lib/prep/`:
- `section-classifier.ts` — mapeia `PrepSection[]` AI → `{likely, deepDive, ask}` por keyword regex (PT/EN, acentos, snake_case) + fallback posicional
- `step-state.ts` — `computeServerCompleted`, `mergeCompleted`, `resolveCurrentStep`, `markStepComplete` (writeLocal), `readLocalCompleted`, `storageKey`
- `types.ts` — `StepNumber`, `Accent`, `STEP_LABELS`, `PrepShellData`

Helpers em `src/lib/billing/`:
- `asaas.ts` — REST client (`createCustomer`, `updateCustomer`, `createSubscription`, `createPayment`, `cancelSubscription`, `getPayment`). `import "server-only"`.
- `quota.ts` — `checkQuota(profile, isAdmin)` retorna `{ allowed, mode: 'credit' | 'block' }`. Só dois desfechos: tem crédito (ou é admin) e passa, ou não tem e apanha o paywall.
- `webhook.ts` — `verifyToken` (constant-time) + `dispatchEvent` (idempotente via UNIQUE asaas_event_id)
- `prices.ts` — `PREP_SKUS`: 1×R$10, 3×R$25, 5×R$40
- `ids.ts` — parser do `externalReference`, formato `prep:<uid>:<qty>:<nano>`. Formato legado de 3 partes (sem qty) resolve pra `qty: 1` — pagamentos antigos ainda chegam por webhook.
- `consume.ts` — `consumePrepCredit` / `refundPrepCredit`, wrappers dos RPCs `SECURITY DEFINER` (migration 0024). Ambos só têm `GRANT` pro `service_role`: **vão pelo admin client, nunca pelo client do usuário.**
- `credit-lifecycle.ts` — as regras de quando cobrar e quando devolver, derivadas de `credit_consumed_at`/`credit_refunded_at`: `isCreditOutstanding`, `shouldChargeRetry`, `shouldRefundOnDiscard`, `shouldRefundOnDelete`. **Toda decisão de dinheiro passa por aqui.** Quatro rodadas de correção na Task 4 vieram de tentar decidir isso sem um registro por sessão; a lição foi que o estado do crédito precisa ser um fato no banco, não uma inferência a partir do status da geração.
- `reconcile.ts` — safety net do webhook. Credita pela `qty` do `externalReference`, não `+1` fixo.
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

### Cerebras removido do fallback de IA (2026-08-16)
- Até 2026-08-16, quando `gemini-3.1-flash-lite` + `gemini-3-flash-preview` + `gemini-3.1-pro-preview` davam 503/timeout, `callGeminiWithRetry` caía pra Cerebras (free tier, OpenAI-compatible REST) como último recurso.
- **Removido, não consertado.** Os dois modelos que o código chamava (`qwen-3-235b-a22b-instruct-2507` e `llama3.1-8b`) sumiram do catálogo Cerebras — produção via HTTP 404 "Model does not exist or you do not have access to it" pros dois, confirmado também na doc oficial. Era a 3ª vez em 4 meses que o catálogo quebrava nesse repo (antes já tinha sido `gpt-oss-120b`). O modo de falha é silencioso por natureza (só aparece quando os 3 Geminis já falharam em sequência), então o risco de reintroduzir sem perceber que quebrou de novo é real.
- A cadeia de IA agora termina no último Gemini (`gemini-3.1-pro-preview`); se ele falhar, o erro original propaga pro caller em vez de cair num fallback morto. `src/lib/ai/cerebras.ts` foi apagado.

### Page-view analytics via client beacon (NÃO middleware)
- **Histórico:** tentei direct-REST do middleware (Edge não expõe `SUPABASE_SERVICE_ROLE_KEY` no Railway standalone → silent failure) e `runtime: 'nodejs'` no middleware (ignorado no Next 15.5 sem flag experimental).
- **Solução atual:** `<PageViewTracker />` em `src/components/PageViewTracker.tsx` é client component no root layout. `useEffect` + `usePathname()` dispara fetch pro `/api/track` em mount inicial + toda navegação client-side. `/api/track` roda em **Node runtime** com admin client (env sempre disponível).
- Cookie `pv_vid` (1 ano) gerado/lido client-side. Paths internos (/admin, /dashboard, /profile, /prep, /partner) filtrados client-side pra economizar round-trip.
- Trade-off: bots sem JS não contam — mas `isBot()` filtraria mesmo, então o número de "humanos" fica mais limpo.
- `/admin` tem section "Visitas ao site" com 4 KPIs (24h/7d/30d/all-time, totais + únicos) + diagnóstico expandível com últimos 5 rows raw + botão "Testar tracking" (insere via admin client direto, valida tabela/RLS isoladamente).
- Se `getPageViewMetrics()` retorna `{ ok: false, reason: "table_missing" }` (Postgres `42P01`), `/admin` mostra banner amarelo dizendo pra rodar migration 0018.

### SEO JSON-LD e OG image
- `/pricing` usa **só** `Service` JSON-LD (não `Product`). Schema Product exigia `aggregateRating` + `review` — sem reviews reais, fingir nota viola Google guidelines. Service comunica oferta sem exigir ratings.
- `/opengraph-image` (e `/twitter-image` futuro) estão no `robots.ts` PRIVATE_PATHS disallow + response header `X-Robots-Tag: noindex`. Sem isso, GSC marca como "Crawled - currently not indexed" porque a route é uma imagem (não landing page).
- `/sobre` existe pra fechar 404 do GSC (Google tinha indexed URL externa apontando lá) e reforçar E-E-A-T. JSON-LD `AboutPage` + `Organization`, 6 seções (por que existe, como funciona, quem está atrás, preço, privacidade, contato), linkado do footer LEGAL e do sitemap.

### Email transacional via Resend REST direto
- Sem SDK — fetch puro pra `https://api.resend.com/emails`. Footprint zero, fácil de mockar.
- From: `nao-responda@prepavaga.com.br` (apex, mesma do Supabase Auth SMTP). Reply-to: `prepavaga@prepavaga.com.br`.
- `sendEmail()` em `src/lib/email/send.ts` é graceful: sem `RESEND_API_KEY`, retorna `{ ok: false, reason: "no_api_key" }` + log warn. Callers nunca devem deixar falha de email quebrar a action principal.

---

## 7. Schema Supabase (resumo)

Tabelas em `public`:

- **`profiles`** (extends `auth.users`): id (uuid), full_name, email, preferred_language (en|pt-br|es), tier (free|pro|team), preps_used_this_month, preps_reset_at, **avatar_url, avatar_updated_at** (#27), **asaas_customer_id, asaas_subscription_id, subscription_status (active|overdue|canceled|expired|none), subscription_renews_at, prep_credits** (migration 0009), **cpf_cnpj** (migration 0010), **preps_this_billing_cycle, billing_cycle_started_at** (migration 0014), **address fields** (migration 0015), **is_admin** (migration 0011), **pix_key** (migration 0016, usado pra payouts de afiliado)
- **`cvs`**: id (uuid), user_id, file_name, file_path, file_size_bytes, mime_type, parsed_text, **display_name** (#27)
- **`prep_sessions`**: id (uuid), user_id, job_title, company_name, cv_text, cv_id (FK→cvs), job_description, language, prep_guide (jsonb), generation_status (pending|generating|complete|failed), error_message, ats_analysis (jsonb), ats_status (NULL|generating|complete|failed), ats_error_message, company_intel (jsonb), company_intel_status (pending|researching|complete|failed|skipped), company_intel_error, cv_rewrite (jsonb), cv_rewrite_status (pending|generating|complete|failed), cv_rewrite_error, **progress_step** (migration 0017, indica seção atual durante geração pra skeleton dinâmico), **salary_benchmark + salary_benchmark_status + salary_benchmark_error** (migration 0020, faixa salarial estimada pra vaga, gerada como Stage Salary no pipeline), **credit_consumed_at + credit_refunded_at** (migration 0024 — o registro por sessão de que o crédito foi cobrado/devolvido; é o que torna consumo e devolução idempotentes)
  - ⚠️ **`prep_sessions` tem GRANT por coluna desde a 0024.** `authenticated` perdeu `INSERT`/`UPDATE` na tabela inteira e só reganhou colunas nomeadas. `generation_status`, `error_message`, `prep_guide` e as duas de crédito ficaram **de fora**: com elas, qualquer pessoa logada marcava a própria prep entregue como `failed` pela anon key e pedia devolução. Quem precisa escrever nessas colunas usa o admin client com `.eq("user_id", …)` explícito. RLS não resolveria isso — RLS filtra linha, nunca coluna.
- **`payments`** (#37): id, user_id, asaas_payment_id (UNIQUE), kind (pro_subscription|prep_purchase), amount_cents, status (pending|confirmed|received|refunded|overdue|failed), billing_method, paid_at, raw_payload, created_at, **credits_granted + credits_granted_at + credits_revoked_at** (migration 0024 — idempotência *por pagamento*: o cartão emite `PAYMENT_CONFIRMED` **e** `PAYMENT_RECEIVED` pro mesmo pagamento, e sem esse carimbo o pacote de 5 era creditado duas vezes). RLS: user lê os próprios.
- **`subscription_events`** (#37): id, user_id (nullable — eventos TRANSFER_* não têm user), asaas_event_id (UNIQUE — chave de idempotência), event_type, asaas_subscription_id, asaas_payment_id, raw_payload, received_at. RLS: service-role only.
- **`affiliate_partners`** (migration 0016): id, user_id (FK auth.users), code (UNIQUE, A-Z0-9- 2-40), display_name, bio, status (pending|active|suspended), commission_rate_pct (default 30), notes, approved_at, approved_by, created_at. RLS: parceiro lê própria row. Distinção rejected×suspended via `approved_at IS NULL`.
- **`affiliate_referrals`** (migration 0016): profile_id (PK FK profiles, 1:1), partner_id, attributed_at, flagged_for_review, flag_reason. SEM SELECT policy (privacidade — usuário não sabe quem o indicou).
- **`affiliate_commissions`** (migration 0016): id, partner_id, payment_id (UNIQUE — idempotência), amount_cents, status (pending|confirmed|paid|clawback), confirmed_at, paid_at, paid_via (`asaas_transfer:<id>` quando automático), created_at. RLS: parceiro lê suas commissions.
- **`affiliate_payouts`** (migration 0019): id, partner_id, asaas_transfer_id (UNIQUE), amount_cents, pix_key + pix_key_type (CPF|CNPJ|EMAIL|PHONE|EVP), status (pending|processing|done|failed|cancelled), asaas_response (jsonb), error_message, triggered_by, created_at, completed_at. RLS: parceiro lê seus payouts (audit transparency).
- **`page_views`** (migration 0018): id, visitor_id (cookie pv_vid 1y), path, user_agent, is_bot, created_at. Server-write only (sem policy authenticated).

Storage buckets: `cvs` (privado, org-scoped por user_id), **`avatars`** (público, paths `{uid}/avatar.{ext}`). RLS ativado em todas tabelas.

---

## 8. Rotas API/server

| Rota | Método | Função |
|---|---|---|
| `/prep/new` | server action `createPrep` | gerar novo prep + **quota gate** (consome 1 crédito via `consumePrepCredit`, antes de inserir a linha) + duplicate JD detection |
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
| `/api/asaas/webhook` | POST | receiver — valida `asaas-access-token` → `dispatchEvent` idempotente. Trata PAYMENT_*, SUBSCRIPTION_DELETED (+ auto-clawback de commissions ainda não pagas), TRANSFER_* (atualiza affiliate_payouts.status; se falha após mark-paid, reverte commissions). |
| `/profile`, `/profile/cvs`, `/profile/account` | server | área de perfil (avatar + CVs + plano + senha + delete) |
| `/pricing` | server | pacotes de crédito: 1×R$10, 3×R$25, 5×R$40 |
| `/analise-ats-gratis` | server + action | ferramenta ATS anônima (sem cadastro). Resultado em `/analise-ats-gratis/resultado`, acesso por cookie `HttpOnly` — o token **nunca** vai na URL, porque dá acesso ao texto do CV. |
| `/prep/[id]` | server action `generateFullPrep` | destrava a preparação completa de uma prep reivindicada da ATS anônima. Consome crédito; é o irmão do `createPrep`, **não** do `retryPrep` (esse é caminho de recuperação e de propósito não cobra). |
| `/parceiros` | server | landing pública do programa de parceiros + form de aplicação. Server-side redirect → `/partner` se user já tem `affiliate_partners` row. |
| `/partner` | server | painel parceiro status-aware (pending/active/suspended/rejected). PayoutThresholdCard mostra barra R$X de R$100. |
| `/partner` | server action `updatePixKey` | edita pix_key no profile |
| `/admin/affiliates` | server | tabs: applications/active/suspended/metrics. Botão "Pagar via Pix" desabilitado abaixo de R$100, link "Marcar pago manualmente" como fallback |
| `/admin/affiliates` | server actions `approvePartner`/`denyPartner`/`suspendPartner` | dispara emails Resend |
| `/admin/affiliates` | server action `payPartnerViaPix` | guarda payout row → Asaas Transfer → marca commissions paid → email parceiro |
| `/admin/affiliates` | server action `markAllPayablePaid` | fluxo manual de fallback |
| `/admin` | server action `submitIndexNowAction` | submete URLs públicas pro IndexNow (Bing/Yandex/Seznam) via fetch direto |
| `/<INDEXNOW_KEY>.txt` | static (public/) | arquivo de verificação de domínio do IndexNow |
| `/sobre` | server (static) | página "Sobre a PrepaVaga" com JSON-LD AboutPage. Existe pra fechar 404 GSC e reforçar E-E-A-T. |
| `/api/track` | POST (Node runtime) | recebe `{ visitorId, path }` do `<PageViewTracker />` client beacon, insere via admin client. 204 sempre. |
| `/auth/confirm` | GET page + server action `confirmEmail` | destino dos links de email do Supabase (`?token_hash=...&type=signup`). Página clique-pra-confirmar: GET não consome o token (imune a prefetch de Outlook SafeLinks/Gmail); o clique (POST) chama `verifyOtp` por token_hash — funciona em navegador diferente do cadastro (sem PKCE). No sucesso de signup, dispara welcome email (`claimAndSendWelcomeEmail`, claim atômica; dashboard mantém fallback pra OAuth). Template do Supabase TEM que apontar pra cá — ver `docs/email-setup.md`. |

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

## 10. Histórico recente

Trabalho organizado por bloco temático, mais recente em cima. Detalhes específicos em `git log` — aqui só o "porquê" pra navegação.

**Agosto 2026 — crédito avulso + ATS anônima:**

| Bloco | O que entrou |
|---|---|
| **Modelo de cobrança trocado por inteiro (2026-08-17)** | Fim do free vitalício e da assinatura R$30; ATS vira o produto grátis, preparação completa passa a custar 1 crédito (R$10 / 3×R$25 / 5×R$40). 10 tasks + 2 correções, migration 0024. O caro não foi o preço, foi o **motor de crédito**: consumo e devolução precisam ser atômicos e idempotentes por sessão **e** por pagamento, com as colunas de dinheiro fora do alcance de escrita do cliente. A Task 4 levou 4 rodadas porque cada uma trocava "recebe de graça" por "paga duas vezes" — só fechou quando o estado do crédito virou fato no banco (`credit_consumed_at`/`credit_refunded_at`) em vez de inferência a partir do `generation_status`. |
| Ferramenta ATS anônima (`/analise-ats-gratis`, migration 0023) | Topo de funil sem cadastro: cola a vaga, envia o CV, recebe score + os primeiros ajustes; o resto destrava ao criar conta, e a análise é reivindicada pra prep. O token que dá acesso ao texto do CV viaja **só em cookie `HttpOnly`, nunca na URL**. `LIMITS.anonAts` é `failClosed: true` — foi ela que expôs, ruidosamente, que o Upstash não estava configurado e portanto **nenhum** rate limit do app existia de fato. |
| Revisão ampla pós-implementação | As revisões por task aprovaram quase tudo, corretamente — cada peça estava certa no próprio escopo. Os 5 defeitos que custariam dinheiro real (crédito `+1` ignorando a `qty`, grant não idempotente por pagamento, `deletePrep` destruindo crédito pendente, entrega parcial cobrando cheio, ordem de deploy) só apareceram na revisão que cruzou arquivos, e **todos viviam em arquivos que nenhuma task tinha razão pra abrir**. Padrão a repetir: depois de um plano multi-task, revisar as junções, não só as peças. |

| Bloco | O que saiu |
|---|---|
| Cerebras removido do fallback de IA (2026-08-16) | Os dois modelos que `tryCerebrasFallback` chamava (`qwen-3-235b-a22b-instruct-2507`, `llama3.1-8b`) sumiram do catálogo Cerebras — logs do Railway mostravam HTTP 404 "Model does not exist or you do not have access to it" pros dois, e a doc oficial confirma que nenhum existe mais. 3ª quebra de catálogo em 4 meses neste repo (antes: `gpt-oss-120b`). `src/lib/ai/cerebras.ts` apagado, cadeia de IA (`src/lib/ai/gemini.ts`) termina no último Gemini, e a ferramenta ATS anônima (`src/lib/anon-ats/analyze.ts`) chama só Gemini. |

**Maio 2026 — Sprint parceiros + SEO + analytics:**

| Bloco | O que entrou |
|---|---|
| Salary benchmark (#TODO, migration 0020) | 4ª card na Tela 1 do prep — `SalaryCard` mostra mín/mediana/máx em BRL + senioridade detectada + região + confidence. Gerada como Stage Salary no pipeline (entre A e B) via `generateSalaryBenchmark` em `src/lib/ai/gemini.ts` (Gemini 3.1 flash-lite com Google Search grounding + fallback ungrounded). Schema `salaryBenchmarkSchema` em `src/lib/ai/schemas.ts`. Sanitizer `sanitizeSalaryBenchmark` coerce R$ strings, centavos, números fora de escala. Rerun action `rerunSalaryBenchmark` igual ao padrão de company_intel. Grid de Tela1Visual passou de `lg:grid-cols-3` pra `md:grid-cols-2 lg:grid-cols-4`. |
| Analytics client beacon (#5978e3d) | Removeu tracking do middleware (Edge não expunha service-role key no Railway). `<PageViewTracker />` client component + `/api/track` Node route. Tracking confirmado funcionando após o switch. |
| SEO GSC fixes (#68f39fe) | Dropei `Product` JSON-LD do `/pricing` (exigia review + aggregateRating). `/opengraph-image` no robots disallow + X-Robots-Tag noindex. Nova página `/sobre` (AboutPage JSON-LD, 6 seções, linkada no footer + sitemap + IndexNow) pra fechar 404 do GSC. |
| Prep/new picker fix (#262b009) | Toggle "Colar texto · Enviar link" virou tab group em pill container com ícones (📋/🔗) — antes era 2 links pequenos separados por "·" e usuário não notava o link mode. |
| Affiliate Sprint 1 (#9a91b29) | Emails Resend (aprovado/rejeitado/payout), webhook TRANSFER_*, anti-fraude self-referral hardened (CPF + email idêntico → block; domínio corporativo → flag; gmail/outlook nunca flag), auto-clawback ao SUBSCRIPTION_DELETED |
| Payout Phase 1 (#44f6211) | Migration 0019 (`affiliate_payouts`), Asaas Transfer integration, `payPartnerViaPix` action, R$100 min threshold, PixKey type detection (CPF/CNPJ/EMAIL/PHONE/EVP), PayoutThresholdCard com barra progresso |
| SEO push (#1fd53ec, #219e987) | FeaturedArticles na landing (artigos a depth-1 da home pra ajudar indexação), IndexNow ping pra Bing/Yandex/Seznam via botão `/admin`, key file público em `/public/<KEY>.txt` |
| Analytics próprio (#ac429c8) | Migration 0018 (`page_views`), middleware Edge → Supabase REST direto (eliminou /api/track + fire-and-forget unreliable), `/admin` mostra 24h/7d/30d/all-time totais e únicos com fallback amarelo se tabela faltar |
| Partner UX (#6c679d5, #6e1dc1b) | `/parceiros` redirect → `/partner` se já aplicou, `/partner` status-aware (rejected×suspended via `approved_at`), AppHeader em `/parceiros` quando logado (era LandingNavbar e parecia "deslogado") |
| Header consistency (#a2d80b9, #c627fe8) | AppHeader em `/prep/[id]` e `/prep/new` (era inline + saía do shell). Redesign B do `/prep/new` (hero + 3 cards numerados + sticky CTA orange) |
| Affiliate program base (PR #16, migration 0016) | Tabelas `affiliate_partners` + `affiliate_referrals` + `affiliate_commissions`, ApprovalDialog, attribuição cookie pv_ref 90d, comissão 30% recorrente vitalícia, janela 7d pending→confirmed |
| AI fallback resilience (várias) | Cerebras como último recurso (`qwen-3-235b-a22b-instruct-2507` + `llama3.1-8b`), `gemini-3.1-flash-lite` GA + `gemini-3-flash-preview` + `gemini-3.1-pro-preview` chain, partial success policy MIN_SECTIONS_TO_SHIP=3, JSON_STRICT_SUFFIX + coerceCerebrasOutput pra schema adherence, max_output_tokens bumps (sections 12k, ATS 16k, CV 16k) |

**Abril 2026 — PRs #14-#42 (consolidado em git log):** Opção A redesign · migração toda IA pra Gemini · Profile area · Billing Asaas + paywall · CPF no signup · `/pricing` · custom domain `prepavaga.com.br` · Resend SMTP no Supabase Auth · Asaas produção · admin dashboard com 6 páginas · soft cap mensal Pro · RLS hardening (migration 0011) · admin perf indexes (0012) · webhook handlers atomic SECURITY DEFINER (0013) · profile address (0015).

---

## 11. Pendências / known gaps

### Dívida registrada do modelo de crédito (Projeto 2)

Nada aqui é bug ativo — é o que ficou conscientemente de fora quando o crédito avulso subiu em 2026-08-17.

- **Não existe reaper de prep travada em `generating`.** `isGenerationStale` (15min) faz a UI mostrar "Tentar novamente", e `shouldChargeRetry` garante que essa retentativa **não cobra de novo** enquanto o crédito estiver pendente — então ninguém paga duas vezes. Mas quem simplesmente abandona a prep fica sem o crédito de volta até excluir a prep (`shouldRefundOnDelete`). Uma rotina que devolva sozinha depois de N horas fecharia o ciclo.
- **Colunas de contagem legadas continuam no banco sem leitor:** `preps_used_this_month`, `preps_reset_at`, `preps_this_billing_cycle`, `billing_cycle_started_at`. Deixadas de propósito — dropar coluna e trocar comportamento no mesmo deploy é exatamente o que derrubou o produto na 0020. Remoção física é tarefa separada, depois de estabilizar.
- **`tier` / `subscription_status` sobrevivem só pro assinante legado** (hoje: a conta admin). Nenhum gate os lê.

### Outros

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
- **MCP Supabase frequentemente desconectado** nesta sessão (Anthropic-side). Quando precisar aplicar migration: cole o SQL no Supabase SQL Editor manualmente. CLI `supabase db push` não tá auth'd local (sem `SUPABASE_ACCESS_TOKEN`). DB password também não está no `.env.local`.
- **Migrations não aplicadas automaticamente:** o CI Supabase Preview tenta rodar mas falha por colisão; aplicação real precisa ser manual. Aplicadas em prod até o momento: 0018 (page_views), 0019 (affiliate_payouts), **0020 (`salary_benchmark` columns em prep_sessions) — aplicada 2026-06-01 via MCP**, **0023 (`anon_ats_analyses`)** e **0024 (créditos por quantidade) — aplicadas 2026-08-17 manualmente no SQL Editor**.
  - ⚠️ Armadilha da 0024, se precisar reaplicar: `CREATE OR REPLACE FUNCTION` com lista de argumentos diferente **cria uma sobrecarga, não substitui**. `handle_payment_received` ganhou um `p_credits integer DEFAULT 1`, e sem o `drop function if exists` da assinatura antiga o Postgres passa a ter as duas e o PostgREST responde `function is not unique`. A migration já traz os `drop` explícitos — não remova. ⚠️ Lição: a ausência da 0020 NÃO era só "Stage Salary falha silenciosamente" — `loadPrepSession` (`src/lib/prep/load-session.ts`) faz SELECT dessas colunas, então sem elas o SELECT inteiro dava erro → `loadPrepSession` retornava null → `/prep/[id]` chamava `notFound()` → **todo prep dava 404 após ser criado** (`createPrep` redirecionava ok porque só faz `.select("id")`). Regra geral: aplicar migration ANTES de deployar código que referencia colunas novas.
- **Env var nova pra setar no Railway:** `RESEND_API_KEY` (emails parceiro — sem ele só log warn). `CEREBRAS_API_KEY` não existe mais no schema — removida em 2026-08-16 junto com a integração (ver §6 "Cerebras removido do fallback de IA"); se ainda estiver setada no Railway, pode ser removida também, é inerte.
- **Eventos TRANSFER_* a habilitar no painel Asaas** pra webhook funcionar end-to-end: TRANSFER_DONE, TRANSFER_FAILED, TRANSFER_CANCELLED, TRANSFER_PENDING, TRANSFER_BANK_PROCESSING.
- **Saldo da conta Asaas:** `payPartnerViaPix` exige saldo na conta Asaas (alimentado pelos pagamentos recebidos). Cada Transfer Pix tem taxa ~R$1,99 deduzida do saldo (parceiro recebe valor cheio). Não saque tudo da conta Asaas antes do dia de pagar parceiros.
- **Edge middleware no Railway standalone**: env vars privadas (sem prefixo `NEXT_PUBLIC_`) NÃO chegam confiavelmente no Edge runtime. Sintoma: silent failure de qualquer fetch que use `SUPABASE_SERVICE_ROLE_KEY` ou similar a partir do middleware. Workaround: tira lógica que precisa de service-role do middleware e move pra API route Node (foi assim que page-view analytics passou pro client beacon). `runtime: 'nodejs'` no middleware config é silenciosamente ignorado em Next 15.5 sem `experimental.nodeMiddleware: true` — flag ainda não tem typings estáveis.

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
