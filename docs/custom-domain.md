# Domínio custom — Cloudflare + Railway

Runbook pra apontar `prepavaga.com.br` (e `www.prepavaga.com.br`) pro
serviço Railway, com SSL automático e redirect www → apex.

Tempo total: ~30 min de trampo + até 1h de propagação DNS. Funciona com
qualquer registrador, mas o passo-a-passo abaixo assume Cloudflare como
DNS (gratuito, melhor que provedor padrão).

---

## 1. Comprar/garantir o domínio (5 min)

Se ainda não comprou:

- **Registro.br** (R$ 40/ano, recomendado pra `.com.br`).
- Compre `prepavaga.com.br`. CPF/CNPJ no nome de PROAICIRCLE Ltda.

Se já comprou: confira que está pago e ativo.

---

## 2. Cloudflare como DNS (10 min)

1. Crie conta em [cloudflare.com](https://cloudflare.com) (free tier
   suficiente).
2. **Add a site** → digite `prepavaga.com.br` → plano **Free**.
3. Cloudflare scaneia DNS atual e mostra registros. Pode estar vazio.
4. Cloudflare te dá 2 nameservers (ex: `arnold.ns.cloudflare.com` e
   `nina.ns.cloudflare.com`).
5. Vá no Registro.br → **Painel do domínio** → **Servidores DNS** →
   troque os 2 nameservers atuais pelos da Cloudflare → salve.
6. Espere propagar (~30 min, às vezes mais). Cloudflare manda email
   quando terminar.

> Por que Cloudflare? Cache CDN gratuito, proteção DDoS básica,
> analytics, página de erro custom, redirect rules. O Registro.br não
> oferece isso.

---

## 3. Railway custom domain (5 min)

1. Painel Railway → projeto PrepaVAGA → service `interview-ready` →
   **Settings** → **Networking** → **Custom Domain**.
2. Clique **Add Custom Domain** → digite `prepavaga.com.br`.
3. Railway mostra um valor `CNAME` (ex: `xxxxxx.up.railway.app`).
   Copie.
4. Railway gera SSL automaticamente via Let's Encrypt depois que o
   DNS apontar.

---

## 4. Apontar DNS no Cloudflare (5 min)

Painel Cloudflare → seu domínio → **DNS** → **Records**.

Adicione 2 registros:

### Apex (`prepavaga.com.br`)

| Type | Name | Target | Proxy status |
|---|---|---|---|
| `CNAME` | `@` | `xxxxxx.up.railway.app` (do passo 3) | **DNS only** (cinza, sem proxy) |

> **Importante**: NÃO ative o proxy laranja da Cloudflare aqui. Railway
> já faz SSL termination. Se ativar o proxy, dá conflito de cert e dá
> erro 526. "DNS only" mantém Cloudflare só como resolver.

### www (`www.prepavaga.com.br`)

| Type | Name | Target | Proxy status |
|---|---|---|---|
| `CNAME` | `www` | `prepavaga.com.br` | DNS only |

---

## 5. Redirect www → apex (5 min)

Sem isso, `www.prepavaga.com.br` carrega o app duplicado (ruim pra SEO
e pra cookies de auth, que ficam scoped no domínio).

Cloudflare → **Rules** → **Redirect Rules** → **Create rule**:

| Campo | Valor |
|---|---|
| Rule name | `Redirect www to apex` |
| If hostname equals | `www.prepavaga.com.br` |
| Then... | **Static** |
| URL | `https://prepavaga.com.br${1}` |
| Preserve query string | ON |
| Status code | 301 |

Salve. Funciona em segundos.

---

## 6. Verificar SSL no Railway (até 30 min)

1. Volte pro Railway → **Custom Domain** → veja status:
   - **Pending DNS**: ainda propagando, espere.
   - **Pending SSL**: DNS resolveu, Let's Encrypt está emitindo cert.
     Demora 1-5 min.
   - **Active**: ✅ pronto.
2. Teste: `curl -I https://prepavaga.com.br` deve retornar `200 OK` sem
   warning de cert.

> Se ficar **Pending SSL** por mais de 30 min: confira que o CNAME do
> apex aponta pro valor exato que o Railway pediu, e que o proxy
> Cloudflare está OFF (cinza).

---

## 7. Atualizar variáveis na app (3 min)

### Railway

Painel Railway → **Variables** → adicione/atualize:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://prepavaga.com.br` |

Sem isso:
- Asaas successCallback redireciona pra URL antiga do Railway
- Email confirmation links apontam pro Railway
- OG image absolute URLs ficam quebradas

Salve. Redeploy automático.

### Supabase

Painel Supabase → projeto → **Authentication** → **URL Configuration**:

- **Site URL**: `https://prepavaga.com.br`
- **Redirect URLs** (allowlist): adicione
  - `https://prepavaga.com.br/auth/callback`
  - `https://prepavaga.com.br/dashboard`
  - `https://prepavaga.com.br/welcome/pro`
  - `http://localhost:3000/**` (mantém pra dev local)

Salve.

### Asaas

Painel Asaas → **Minha Conta** → **Informações da conta** → atualize
**Site/Domínio** pra `https://prepavaga.com.br`.

Sem isso, novas subscriptions falham com 400 "domínio não cadastrado".

---

## 8. Testar end-to-end (5 min)

1. Janela anônima → `https://prepavaga.com.br` → landing carrega ✓.
2. Login com conta de teste → `/dashboard` → banner Free ✓.
3. `/prep/new` → criar prep → fluxo completo ✓.
4. `/pricing` → Pro → Asaas → após pagar, redireciona pra
   `https://prepavaga.com.br/welcome/pro` ✓.
5. Recebe email de confirmação? Conferir remetente
   `nao-responda@prepavaga.com.br` (Resend, ver `email-setup.md`).

---

## 9. SEO / sitemap (opcional, 5 min)

Cria `src/app/sitemap.ts` (Next 15 auto-detecta):

```ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://prepavaga.com.br";
  const lastModified = new Date();
  return [
    { url: base, lastModified, priority: 1 },
    { url: `${base}/pricing`, lastModified, priority: 0.8 },
    { url: `${base}/login`, lastModified, priority: 0.5 },
    { url: `${base}/signup`, lastModified, priority: 0.7 },
    { url: `${base}/termos`, lastModified, priority: 0.3 },
    { url: `${base}/privacidade`, lastModified, priority: 0.3 },
    { url: `${base}/lgpd`, lastModified, priority: 0.3 },
  ];
}
```

E `src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/prep", "/profile", "/api"] },
    ],
    sitemap: "https://prepavaga.com.br/sitemap.xml",
  };
}
```

Submeta a sitemap no Google Search Console
([search.google.com/search-console](https://search.google.com/search-console))
depois que o domínio estiver no ar.

---

## 10. Email custom no domínio (opcional)

Resend já cobre `nao-responda@prepavaga.com.br` saindo. Pra **receber**
emails em `contato@prepavaga.com.br` ou `privacidade@prepavaga.com.br`:

**Opção A — Cloudflare Email Routing (gratuita)**: Cloudflare → seu
domínio → **Email** → habilitar Email Routing → criar regra
`contato@prepavaga.com.br → seuemail@gmail.com`. Não pode enviar, só
receber. Suficiente pra suporte inicial.

**Opção B — Google Workspace**: $7/usuário/mês, full inbox, calendar,
docs. Vale quando o time crescer.

---

## Histórico

- 2026-04-26: documento criado.
