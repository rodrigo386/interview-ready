# Foundation — Design Spec

**Sub-projeto #1 do InterviewReady.** Entrega auth funcional, dashboard vazio, e deploy rodando. Base para todos os outros sub-projetos.

**Stack decidido:** Next.js 14 App Router (TS) + Supabase (PG+Auth+Storage) + Railway (Docker) + GitHub Actions CI.

**Sub-projetos posteriores** (fora deste spec): #2 Core Pipeline, #3 Freemium Gate, #4 Mock Interview, #5 Polish & Launch.

---

## 1. Arquitetura

- **Framework:** Next.js 14 App Router, TypeScript strict.
- **Auth + DB:** Supabase com `@supabase/ssr` (cookie-based sessions, server-side).
- **Styling:** Tailwind CSS. Paleta: `zinc-950` background, `violet-500` accent. Dark theme por padrão.
- **Package manager:** pnpm.
- **Node:** 20 LTS.
- **Deploy:** Railway, containerized (Dockerfile). Auto-deploy on push to `main`.
- **CI:** GitHub Actions em cada PR — lint + typecheck + build + vitest + playwright smoke. Sem deploy pelo CI; Railway observa o branch.
- **i18n:** `next-intl` com scaffold, só mensagens EN nesta fase. PT-BR/ES entram no Phase 5.

### Decisões arquiteturais

**Por quê email/senha + Google OAuth em vez de só magic link?** Escolha explícita do usuário — cobre dois mundos, melhor conversão.

**Por quê Railway em vez de Vercel?** Pipeline de IA futuro (sub-projeto #2) leva 30-60s por request. Vercel serverless tem limite de 300s no plano Pro, mas com cold starts e arquitetura serverless traz complexidade. Railway roda container always-on, sem limite de timeout, modelo mental mais simples.

**Por quê `@supabase/ssr` em vez de Auth.js (NextAuth)?** Auth.js forçaria abandonar o RLS baseado em `auth.uid()` do Supabase — o principal mecanismo de segurança. Com Auth.js precisaríamos passar user_id manual em toda query, duplicando responsabilidade.

**Por quê Supabase Auth UI custom em vez do `<Auth />` pronto?** Controle total de design e menos peso de bundle. Um form com 3 handlers é pouco trabalho e destrava customização no Polish.

---

## 2. Estrutura de arquivos

```
interview-ready/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .env.example
├── .gitignore
├── Dockerfile
├── README.md
├── next.config.ts
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── middleware.ts
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 0001_initial.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # landing minimal (CTA → /signup)
│   │   ├── globals.css
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── signup/
│   │   │       └── page.tsx
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts       # OAuth code → session exchange
│   │   └── dashboard/
│   │       ├── layout.tsx         # auth-gated, logout button
│   │       └── page.tsx           # empty state → "Create your first prep" (CTA desabilitado, vem em #2)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # browser client (NEXT_PUBLIC_* vars)
│   │   │   ├── server.ts          # server client (cookies + service role onde precisar)
│   │   │   └── middleware.ts      # session refresh helper
│   │   └── env.ts                 # Zod-validated env vars, fail-fast no boot
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   └── Input.tsx
│   │   └── auth/
│   │       ├── LoginForm.tsx      # Server Action
│   │       ├── SignupForm.tsx     # Server Action
│   │       └── GoogleButton.tsx   # client component
│   └── i18n/
│       ├── config.ts
│       └── messages/
│           └── en.json
└── tests/
    └── e2e/
        └── auth.spec.ts
```

---

## 3. Fluxos de dados

### 3.1 Signup email/senha
1. Usuário preenche `SignupForm` → Server Action
2. `supabase.auth.signUp({ email, password })`
3. Supabase envia email de confirmação (SMTP default da Supabase nesta fase; SendGrid/Resend entra no Polish)
4. Trigger `on_auth_user_created` cria linha em `public.profiles` com `email` e `full_name` do metadata
5. Cookie de sessão setado após confirmação
6. Redirect para `/dashboard`

### 3.2 Login email/senha
1. `LoginForm` → Server Action → `signInWithPassword({ email, password })`
2. Cookie setado → redirect `/dashboard`
3. Em erro: mensagem inline no form (mapear erros Supabase para strings PT/EN)

### 3.3 Google OAuth
1. Click em `GoogleButton` → `signInWithOAuth({ provider: 'google', options: { redirectTo: APP_URL/auth/callback } })`
2. Redirect para Google consent
3. Google redireciona para `/auth/callback?code=...`
4. Route handler chama `exchangeCodeForSession(code)` → cookie setado
5. Trigger cria profile (idempotente — só insere se ainda não existe via `ON CONFLICT DO NOTHING`)
6. Redirect para `/dashboard`
7. Em erro: redirect `/login?error=oauth_failed`

### 3.4 Logout
1. Botão no layout do dashboard → Server Action → `supabase.auth.signOut()`
2. Cookie limpo → redirect para `/`

### 3.5 Auth middleware (`middleware.ts`)
Matcher: roda em tudo exceto `/`, `/login`, `/signup`, `/auth/callback`, `/_next/*`, arquivos estáticos.

Comportamento:
- Refresh do cookie de sessão se perto de expirar (lib helper da Supabase)
- Se não há sessão válida e rota é protegida (`/dashboard/*`) → redirect `/login`
- Se há sessão válida e usuário está em `/login` ou `/signup` → redirect `/dashboard`

---

## 4. Database — migration `0001_initial.sql`

Só a tabela `profiles` + trigger. Demais tabelas entram quando forem necessárias (YAGNI). Colunas Stripe ficam para sub-projeto #3.

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'pt-br', 'es')),
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team')),
  preps_used_this_month INT DEFAULT 0,
  preps_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Nota sobre `raw_user_meta_data->>'name'`: Google OAuth envia `name`, email/senha pode enviar `full_name`. O `COALESCE` cobre ambos.

---

## 5. Env vars (`.env.example`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Validação com Zod em `src/lib/env.ts`. Falha no boot se qualquer uma faltar ou estiver vazia.

---

## 6. Tratamento de erros

- **Env vars:** validadas no boot com Zod. App não sobe se faltar chave.
- **Auth errors no form:** exibidos inline, strings mapeadas dos códigos de erro do Supabase (ex.: `invalid_credentials` → "Email ou senha inválidos"; `user_already_registered` → "Esse email já tem conta").
- **Weak password:** Supabase valida min 6 chars; front exige 8+ antes de chamar API.
- **OAuth callback:** qualquer erro na exchange → redirect `/login?error=oauth_failed` com banner.
- **DB errors em Server Actions:** log detalhado com `console.error`, mensagem genérica para o usuário ("Algo deu errado, tente de novo").
- **Unhandled:** `app/error.tsx` captura. `app/not-found.tsx` para 404. Ambos com dark theme.

---

## 7. Testes

**Vitest** (`vitest.config.ts`): configurado mas sem testes unitários nesta fase (sem utils ainda — vai ter em #2).

**Playwright E2E** (`tests/e2e/auth.spec.ts`): 1 smoke test:
1. Abre `/signup`
2. Preenche email único + senha
3. Submit → espera redirect `/dashboard`
4. Confirma texto "Create your first prep" visível

Em CI, Playwright roda contra `pnpm start` em porta aleatória, usando um projeto Supabase de **staging** (env vars separadas).

**Manual checklist no PR description:**
- [ ] Signup email/senha funciona
- [ ] Login email/senha funciona
- [ ] Google OAuth funciona
- [ ] Logout funciona
- [ ] `/dashboard` não-auth redireciona para `/login`
- [ ] `/login` auth redireciona para `/dashboard`
- [ ] Dark theme visível em todas as páginas

---

## 8. Deploy (Railway)

**Dockerfile (multi-stage):**
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

`next.config.ts` com `output: 'standalone'` para reduzir tamanho da imagem.

**Railway:**
- Serviço conectado ao repo GitHub, branch `main`
- Auto-deploy on push
- Env vars setadas via dashboard da Railway (não commitar)
- Health check: GET `/` com 200 esperado, a cada 30s
- Região: `us-east` (default)

---

## 9. CI (`.github/workflows/ci.yml`)

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.STAGING_SUPABASE_SERVICE_ROLE_KEY }}
      NEXT_PUBLIC_APP_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test
```

`playwright.config.ts` usa `webServer: { command: 'pnpm start', port: 3000, reuseExistingServer: !process.env.CI }` para subir o Next automaticamente durante o teste.

Secrets no GitHub: `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY` (projeto Supabase separado para testes, não o de produção).

---

## 10. Fora de escopo (ficam para sub-projetos posteriores)

- Parsing de PDF/DOCX (→ #2)
- Integração com Claude API (→ #2)
- Tabelas `cvs`, `prep_sessions`, `mock_interviews` (→ #2)
- Stripe + webhooks + campos Stripe em `profiles` (→ #3)
- Upload de CV e formulário de JD (→ #2)
- Upstash Redis rate-limit (→ #3)
- Landing page completa com copy, screenshots, pricing (→ #5)
- PostHog / analytics de funil (→ #5)
- PT-BR / ES nas mensagens (→ #5)
- Export PDF (→ #5)
- Email transacional customizado (SendGrid/Resend) (→ #5)

---

## 11. Definition of Done

1. Signup email/senha funciona end-to-end → usuário chega no dashboard vazio
2. Login email/senha funciona → usuário chega no dashboard vazio
3. Google OAuth funciona → usuário chega no dashboard vazio
4. Logout funciona → volta para landing
5. `/dashboard` sem sessão redireciona para `/login`
6. `/login` com sessão redireciona para `/dashboard`
7. Linha em `public.profiles` criada automaticamente em cada signup (email/senha e Google)
8. RLS ativo — SELECT em `profiles` só retorna o próprio usuário
9. Deploy funcionando em URL pública da Railway com HTTPS
10. CI passa em PR — lint + typecheck + build + vitest + playwright smoke
11. Dark theme (zinc-950 + violet-500) aplicado em todas as páginas (landing, login, signup, dashboard, error, 404)
12. `.env.example` documentado, variáveis validadas no boot com Zod
13. README com instruções de dev local (clone → pnpm install → supabase start → pnpm dev)

---

## 12. Estimativa

~15-20 arquivos novos. ~2-4 horas de trabalho real do agente (incluindo setup de contas, CI, e deploy).

Risco principal: configuração de OAuth Google (Google Cloud Console, consent screen, redirect URI) — tarefa manual fora do código, potencialmente 30min de fricção.
