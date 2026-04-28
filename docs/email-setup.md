# Email setup — Resend + Supabase Auth

Runbook pra trocar o SMTP padrão do Supabase (rate-limited a ~3 emails/hora,
remetente genérico) pelo Resend, e personalizar os templates de auth em PT-BR.

Sem isso, em volume real:
- Email de confirmação chega lento ou não chega
- Domínio remetente é o do Supabase (`noreply@mail.app.supabase.io`), parece spam
- Reset de senha falha silenciosamente

Tempo total: ~30 minutos. Não precisa código. Tudo em dashboard.

---

## 1. Conta Resend (5 min)

1. Criar conta em [resend.com](https://resend.com) (gratuito até 3.000 emails/mês, 100/dia).
2. **Adicionar domínio** em Domains → Add Domain → `prepavaga.com.br`.
3. O Resend vai pedir 3 registros DNS:
   - `MX` apontando pra `feedback-smtp.us-east-1.amazonses.com` (Resend usa SES por baixo)
   - `TXT` SPF
   - `TXT` DKIM (3 chaves separadas)
4. Adicionar todos no painel do registrador do domínio (Cloudflare, Registro.br, GoDaddy etc.).
5. Voltar pro Resend → Verify. Pode levar até 48h, geralmente <30 min.
6. Em **API Keys** → criar chave com permissão "Sending access" → copiar (formato `re_xxxxxxxx`).

> **Antes do domínio estar verificado**: o Resend permite enviar de
> `onboarding@resend.dev` pra testar. Útil pra validar configuração, mas
> não use em produção (cai em spam).

---

## 2. SMTP do Resend no Supabase (5 min)

1. Painel Supabase → projeto `reslmtzofwczxrswulca` → **Authentication** → **Emails** → aba **SMTP Settings**.
2. Toggle **Enable Custom SMTP** = ON.
3. Preencher:
   - **Sender email**: `nao-responda@prepavaga.com.br` ⚠️ **APEX**, sem `send.` no meio. A API key do Resend é restrita ao domínio que você verificou (apex). Se botar `nao-responda@send.prepavaga.com.br`, dá erro 550 "API key is not authorized to send emails from send.prepavaga.com.br".
   - **Sender name**: `PrepaVAGA`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: a chave `re_xxxxxxxx` que você copiou no passo 1.6
   - **Minimum interval between emails**: `0` (Resend já tem rate limit próprio)
4. Salvar. Supabase envia email de teste — confira a inbox do `Sender email`.

---

## 3. Templates PT-BR (15 min)

Painel Supabase → **Authentication** → **Emails** → cada aba (Confirm signup, Invite user, Magic Link, Change Email Address, Reset Password). Cole os templates abaixo.

> Tags Supabase: `{{ .Email }}` `{{ .ConfirmationURL }}` `{{ .Token }}` `{{ .SiteURL }}` `{{ .RedirectTo }}`.

### Confirm signup

**Subject**: `Confirme seu cadastro na PrepaVAGA`

**Body**:
```html
<h2>Bem-vindo à PrepaVAGA</h2>
<p>Olá!</p>
<p>Recebemos seu cadastro com o e-mail <strong>{{ .Email }}</strong>. Pra ativar sua conta e usar a sua primeira prep grátis, clique no botão abaixo:</p>
<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 24px;background:#EA580C;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">
    Confirmar cadastro
  </a>
</p>
<p>Ou copie e cole este link no navegador:</p>
<p style="color:#666;word-break:break-all;font-size:13px">{{ .ConfirmationURL }}</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#888;font-size:13px">
  Se você não criou uma conta na PrepaVAGA, pode ignorar este e-mail.
</p>
<p style="color:#888;font-size:13px">
  PrepaVAGA · operado por PROAICIRCLE Ltda · CNPJ 62.805.016/0001-29
</p>
```

### Magic Link

**Subject**: `Seu link de acesso à PrepaVAGA`

**Body**:
```html
<h2>Acesse sua conta</h2>
<p>Olá!</p>
<p>Você pediu um link mágico pra entrar na PrepaVAGA. Clique abaixo:</p>
<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 24px;background:#EA580C;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">
    Entrar na PrepaVAGA
  </a>
</p>
<p style="color:#666;word-break:break-all;font-size:13px">{{ .ConfirmationURL }}</p>
<p style="color:#888;font-size:13px">Esse link expira em 1 hora.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#888;font-size:13px">
  Se não foi você, ignore este e-mail. Sua senha continua intacta.
</p>
```

### Reset Password

**Subject**: `Redefina sua senha na PrepaVAGA`

**Body**:
```html
<h2>Redefinir sua senha</h2>
<p>Olá!</p>
<p>Recebemos um pedido pra redefinir a senha da conta <strong>{{ .Email }}</strong>. Clique abaixo pra escolher uma nova:</p>
<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 24px;background:#EA580C;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">
    Redefinir senha
  </a>
</p>
<p style="color:#666;word-break:break-all;font-size:13px">{{ .ConfirmationURL }}</p>
<p style="color:#888;font-size:13px">Esse link expira em 1 hora.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#888;font-size:13px">
  Se você não pediu pra redefinir senha, ignore este e-mail. Sua senha atual continua válida.
</p>
```

### Change Email Address

**Subject**: `Confirme seu novo e-mail na PrepaVAGA`

**Body**:
```html
<h2>Confirme seu novo e-mail</h2>
<p>Você pediu pra trocar o e-mail da sua conta PrepaVAGA pra <strong>{{ .Email }}</strong>.</p>
<p>Clique abaixo pra confirmar a mudança:</p>
<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 24px;background:#EA580C;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">
    Confirmar novo e-mail
  </a>
</p>
<p style="color:#666;word-break:break-all;font-size:13px">{{ .ConfirmationURL }}</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#888;font-size:13px">
  Se você não pediu essa mudança, ignore este e-mail e a alteração será cancelada.
</p>
```

### Invite user

Não usamos esse fluxo hoje (só self-signup). Pode deixar o template default.

---

## 4. URL de redirect

Supabase → **Authentication** → **URL Configuration**:

- **Site URL**: `https://prepavaga.com.br` (ou a URL do Railway até o domínio estar pronto)
- **Redirect URLs**: adicionar
  - `https://prepavaga.com.br/auth/callback`
  - `https://prepavaga.com.br/dashboard`
  - `http://localhost:3000/**` (pra dev local)

Sem isso, os links dos e-mails caem em "redirect not allowed".

---

## 5. Testar (5 min)

1. Em janela anônima, abrir `https://prepavaga.com.br/signup`.
2. Cadastrar com um e-mail real (não use endereço de teste tipo `+test@`).
3. Conferir:
   - Email chega em <30 segundos
   - Remetente é `PrepaVAGA <nao-responda@prepavaga.com.br>`
   - Assunto e corpo em PT-BR conforme os templates
   - Clique no botão → vai pra `/dashboard` autenticado
4. Pedir reset de senha em `/login` → repetir o teste pro template de reset.

---

## 6. Email confirmation: ON ou OFF?

Decisão de produto:

- **ON (recomendado pra produção)**: usuário precisa clicar no link do e-mail antes de logar. Reduz signups fake/bot, mas adiciona fricção. Asaas precisa do CPF + e-mail confirmado pra conformidade.
- **OFF**: signup loga direto. Bom pra demos e testes E2E. Não recomendado pra produção.

Painel Supabase → **Authentication** → **Providers** → **Email** → toggle **Confirm email**.

> Se ligar ON em produção: lembre que o E2E `auth-required` em CI exige
> OFF (caso contrário, o signup retorna `pendingConfirmation` em vez de
> redirecionar pra dashboard, e os testes quebram). Mantenha OFF no
> projeto Supabase **staging** e ON no de produção.

---

## 7. Quando setar/parar Resend

- **Free tier (3.000/mês)**: cobre até ~100 signups/dia. Suficiente até a primeira centena de usuários pagantes.
- **Pro ($20/mês, 50.000 emails)**: necessário a partir de ~1.500 signups/dia.
- **Logs**: Resend mantém histórico 30 dias, mostra abertura, clique, bounce. Útil pra debug.
- **Bounce alto** (>5%): reputação cai. Verifique se está usando double opt-in (Confirm email ON).

---

## Histórico

- 2026-04-26: documento criado.
