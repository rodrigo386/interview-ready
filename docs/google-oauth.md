# Google OAuth — runbook de setup

Login com Google está implementado no código (botão em `/login` e `/signup`, callback em `/auth/callback`). Para ativar em produção, é preciso (1) criar o OAuth client no Google Cloud Console, (2) configurar o provider no Supabase Dashboard. Tempo estimado: 10 minutos.

## Por que isso não pode ser automatizado

Cada passo exige login interativo (Google Cloud + Supabase) e aceitação de termos. A CLI da Google não cobre Console OAuth. Documentado aqui pra ser repetível.

---

## 1. Criar OAuth client no Google Cloud Console (~5 min)

### 1.1 Criar/selecionar projeto
- Acesse https://console.cloud.google.com/
- Topo da página → seletor de projeto → **New Project**
- Nome: `prepavaga` (ou reaproveitar projeto existente)
- Aguarde criação, selecione o projeto

### 1.2 Configurar OAuth consent screen (1ª vez)
- Menu lateral → **APIs & Services** → **OAuth consent screen**
- User Type: **External** → Create
- App information:
  - **App name**: `PrepaVaga`
  - **User support email**: `prepavaga@prepavaga.com.br`
  - **App logo**: opcional, pode pular agora
- App domain:
  - **Application home page**: `https://prepavaga.com.br`
  - **Application privacy policy**: `https://prepavaga.com.br/privacidade`
  - **Application terms of service**: `https://prepavaga.com.br/termos`
- Authorized domains: adicione `prepavaga.com.br` e `supabase.co`
- Developer contact: `prepavaga@prepavaga.com.br`
- **Save and continue**
- Scopes: clique **Add or remove scopes** → marque:
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
  - `openid`
- **Save and continue**
- Test users: pode pular (vamos publicar logo)
- Summary → **Back to dashboard**

### 1.3 Publicar o app (importante)
- Em **OAuth consent screen** → **Publishing status**: clique **Publish app** → confirme.
- Sem isso, só os "test users" conseguem logar (limite de 100). Publicado, qualquer Google pode usar. Para escopos básicos (email + profile), Google **não exige verification** — é instantâneo.

### 1.4 Criar Client ID
- Menu lateral → **APIs & Services** → **Credentials**
- **+ Create credentials** → **OAuth client ID**
- Application type: **Web application**
- Name: `PrepaVaga Web`
- **Authorized JavaScript origins** — adicione:
  - `https://prepavaga.com.br`
  - `https://reslmtzofwczxrswulca.supabase.co`
  - `http://localhost:3000` (pra dev)
- **Authorized redirect URIs** — adicione:
  - `https://reslmtzofwczxrswulca.supabase.co/auth/v1/callback`
  - (Opcional dev) `http://localhost:54321/auth/v1/callback` se rodar Supabase local
- **Create**
- Modal mostra **Client ID** e **Client secret** — **copie os dois agora** (o secret pode ser revelado depois mas é mais fácil agora)

---

## 2. Configurar provider no Supabase Dashboard (~2 min)

- Acesse https://supabase.com/dashboard/project/reslmtzofwczxrswulca
- Menu lateral → **Authentication** → **Providers**
- Localize **Google** na lista → expanda
- **Enable Sign in with Google**: ON
- Cole **Client ID (for OAuth)** e **Client Secret (for OAuth)**
- **Authorized Client IDs**: deixe vazio (só pra one-tap login nativo Android/iOS)
- **Skip nonce check**: deixe OFF
- **Save**

---

## 3. Validar URLs no Supabase Auth Settings

- Authentication → **URL Configuration**
- **Site URL**: `https://prepavaga.com.br` (já deve estar)
- **Redirect URLs** (allowlist) — confirme que tem:
  - `https://prepavaga.com.br/**`
  - `https://prepavaga.com.br/auth/callback`
  - `http://localhost:3000/**` (pra dev)

Sem `auth/callback` na allowlist, o exchange falha com `redirect_to is not allowed`.

---

## 4. Teste end-to-end

1. Abra `https://prepavaga.com.br/login` em janela anônima
2. Clique **Entrar com Google**
3. Tela de consent do Google aparece → escolhe conta → autoriza
4. Redireciona pra `https://reslmtzofwczxrswulca.supabase.co/auth/v1/callback?code=...`
5. Supabase valida e redireciona pra `https://prepavaga.com.br/auth/callback?code=...`
6. App troca code → session → redireciona pra `/dashboard`

Se algo der errado: console do browser tem o erro do Supabase. Erros comuns:

| Erro | Causa | Fix |
|---|---|---|
| `redirect_uri_mismatch` | URI não bate exato | Confira se o redirect URI no Google Cloud é `https://<project>.supabase.co/auth/v1/callback` literal |
| `redirect_to is not allowed` | URL não está na allowlist Supabase | Adicione `https://prepavaga.com.br/**` em URL Configuration |
| `Access blocked: PrepaVaga has not completed Google verification` | App ainda em "Testing" | Publish app no consent screen |
| Profile não criado após OAuth | Trigger `handle_new_user` falhou | Verificar logs Supabase: `select * from auth.audit_log_entries order by created_at desc limit 10` |

---

## 5. Diferença com signup por e-mail (CPF)

Signup por e-mail coleta CPF obrigatório no form (migration 0010). Login com Google **não coleta CPF** — o user fica com `profiles.cpf_cnpj = NULL`.

Comportamento atual:
- Free tier (1 prep grátis): funciona sem CPF
- Pro/Avulso: `/api/billing/checkout` retorna `422 cpf_required` → frontend já prompta CPF antes do Asaas

Não precisa migration nova. O fluxo de "pedir CPF na hora do checkout" já existe (`CheckoutButton` em `src/components/billing/CheckoutButton.tsx`).

---

## 6. Variáveis de ambiente (no Railway)

**Nenhuma nova é necessária.** Client ID e Secret ficam armazenados no Supabase, não no app. Uma vez configurado no Supabase Dashboard, o app já funciona.
