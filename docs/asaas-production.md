# Asaas — sandbox → produção

Runbook pra trocar do ambiente de testes do Asaas pro de produção e
começar a receber pagamento real. Tempo total: ~1h, mas a verificação do
Asaas pode levar até 24h.

Tudo é dashboard + env vars. Código já está pronto pra ambos os
ambientes — só muda a URL e as credenciais.

---

## 1. Criar conta de produção (10 min + verificação)

1. Acesse [asaas.com](https://www.asaas.com) (NÃO o sandbox).
2. Cadastre como **Pessoa Jurídica** com:
   - CNPJ: `62.805.016/0001-29` (PROAICIRCLE CONSULTORIA EMPRESARIAL LTDA)
   - Razão social, endereço (Rua Pais Leme 215, conj 1713, Pinheiros,
     São Paulo/SP, CEP 05.424-150) — copia do contrato social
   - Sócio responsável (com CPF)
3. Conta bancária da empresa pra receber repasses (PJ no nome da empresa).
4. Documentação que o Asaas pede:
   - Contrato social atualizado (PDF)
   - Documento com foto do sócio
   - Selfie segurando documento (KYC)
   - Comprovante de endereço da empresa
5. Submeta. Asaas costuma verificar em **2-24h úteis**. Email avisa.

> **Antes de aprovar**: você não consegue gerar API key de produção. Use
> o tempo pra revisar tudo que está no sandbox.

---

## 2. Cadastrar domínio + URL de retorno (5 min)

Painel Asaas → **Minha Conta** → **Informações da conta**:

- **Site/Domínio**: `https://prepavaga.com.br` (mesmo se ainda estiver
  na URL do Railway, cadastre o domínio final pra evitar precisar
  re-aprovar). Se ainda não tiver o domínio, cadastre primeiro a URL
  do Railway (`https://prepavaga.up.railway.app`).
- Sem essa etapa, o Asaas rejeita criação de subscription com erro 400
  "domínio não cadastrado".

---

## 3. Gerar API key de produção (2 min)

Painel Asaas → **Integrações** → **Chave de API** → **Gerar nova chave**.

- Copie a chave (formato `$aact_prod_xxxxxx`). Mostra só uma vez —
  guarde no 1Password / Bitwarden.
- Permissões: deixe full (default). Não temos uso restrito.

---

## 4. Configurar webhook de produção (5 min)

Painel Asaas → **Integrações** → **Webhooks** → **Adicionar webhook**.

| Campo | Valor |
|---|---|
| URL | `https://prepavaga.com.br/api/asaas/webhook` |
| Email pra notificar erros | `contato@prepavaga.com.br` |
| Header customizado — **Nome** | `asaas-access-token` |
| Header customizado — **Valor** | gere uma string aleatória de 32 chars (ex: `openssl rand -hex 16`) — esse é o seu `ASAAS_WEBHOOK_TOKEN` |
| Versão da API | `v3` |
| Status | **Ativo** |
| Eventos selecionados | `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `SUBSCRIPTION_DELETED` |

> Recomenda-se também marcar `PAYMENT_CREATED` e `SUBSCRIPTION_CREATED`
> só pra logging — o handler já lida com eles.

Salve.

---

## 5. Trocar env vars no Railway (5 min)

Painel Railway → projeto PrepaVAGA → service → **Variables**:

| Variável | Valor (sandbox) | Valor (produção) |
|---|---|---|
| `ASAAS_BASE_URL` | `https://sandbox.asaas.com/api/v3` | `https://api.asaas.com/v3` |
| `ASAAS_API_KEY` | `$aact_xxx` (sandbox) | `$aact_prod_xxxxxx` (passo 3) |
| `ASAAS_WEBHOOK_TOKEN` | qualquer | string que você setou no header do passo 4 |

Salve. Railway redeploy automático em ~90s.

> **Não delete as variáveis sandbox antes de testar prod.** Se algo der
> errado, é mais fácil voltar trocando os valores do que recriando.

---

## 6. Testar com cobrança real (10 min)

1. Em janela anônima, acesse `https://prepavaga.com.br/signup` e
   cadastre uma conta de teste (CPF real seu).
2. Vá pra `/pricing` → clique **Comprar 1 prep · R$ 10**.
3. Asaas redireciona pro checkout hosted.
4. Pague com:
   - **Pix** (mais rápido, 1-2 min pra confirmar) — recomendado pra
     primeiro teste.
   - **Cartão** (instantâneo) — use seu cartão pessoal.
5. Após pagar, Asaas redireciona de volta pra `/dashboard?billing=ok`.
6. Verifique:
   - Badge no header mudou de "Free" pra mostrar 1 crédito (se foi
     prep_purchase) ou pra "Pro" verde (se foi subscription).
   - Tabela `payments` no Supabase tem 1 linha nova com
     `status=received`.
   - Tabela `subscription_events` tem 1 linha nova (webhook chegou).

> Se `subscription_events` ficar vazio depois de 5 min, o webhook não
> está chegando. O reconcile que está em `src/lib/billing/reconcile.ts`
> sincroniza no próximo `/dashboard`, mas idealmente o webhook funciona.
> Debug: painel Asaas → Webhooks → veja a fila de envios e logs de
> retry.

---

## 7. Reembolso desse teste (2 min)

Cobranças reais aparecem na fatura mensal do Asaas (eles cobram **2,99%
do volume + R$ 1,49 por transação** confirmada — barato, mas existe).

Pra reembolsar a transação de teste:

Painel Asaas → **Cobranças** → encontre a transação → **Estornar**.

O webhook `PAYMENT_REFUNDED` dispara, que no nosso handler reverte
`tier=free` (se era subscription) ou decrementa `prep_credits` (se era
avulso). Confira que o badge no header voltou pra Free.

---

## 8. Cancelar conta sandbox (opcional, 1 min)

Não é obrigatório, mas evita confusão depois. Sandbox e produção são
contas SEPARADAS — você não migra dados, só desliga.

Se quiser manter sandbox pra testes futuros: deixe ativa, só não use as
credenciais dela em produção.

---

## 9. Limites e escala

| Tier Asaas | Custo por transação | Quando vale subir |
|---|---|---|
| Padrão (default) | 2,99% + R$ 1,49 | Sempre começa aqui |
| Avançado | 1,99% + R$ 1,49 | A partir de ~R$ 30k/mês de volume |
| Personalizado | negociado | A partir de ~R$ 100k/mês |

Para mudar de plano: Painel Asaas → **Planos** → solicitar.

---

## 10. Monitoramento

Diariamente os primeiros 30 dias:

- **Painel Asaas → Cobranças** → veja todas as transações (sucesso,
  falha, estorno, em atraso).
- **Painel Asaas → Webhooks → Histórico** → confira que cada evento foi
  entregue. Falhas têm detalhes (status HTTP retornado pela nossa app).
- **Tabela `subscription_events` no Supabase** → cada evento aparece
  com `received_at`. Se a tabela estiver atrasada vs Asaas, webhook
  está caindo.

---

## Histórico

- 2026-04-26: documento criado.
