# Crédito avulso e paywall na preparação completa

**Data:** 2026-08-16
**Status:** aprovado, aguardando plano de implementação
**Escopo:** Projeto 1 de 2 (o Projeto 2, limpeza do legado, tem spec própria e não bloqueia receita)

## Problema

O modelo atual — 1 preparação grátis vitalícia, Pro a R$30/mês ilimitado, avulso a R$10 — não converte. Medido em 2026-08-16 no banco de produção:

| | |
|---|---|
| Assinaturas Asaas reais | **1** |
| Perfis Pro não-admin | 3 (só 1 com assinatura de verdade) |
| Pagamentos de assinatura confirmados | 1 |
| Pagamentos avulsos confirmados | 1 |
| Comissões de afiliado já geradas | **0** |
| Preps em toda a história do produto | 19 |

A receita recorrente é essencialmente zero, e o produto sustenta três caminhos de cobrança para atender a um assinante. A preparação grátis não está funcionando como isca: das 19 preps, a maioria veio de poucos usuários, e nenhum usuário não-admin voltou ao site num segundo dia.

O custo dessa complexidade é concreto: o gate de cota tem cinco modos, quatro colunas de contagem em `profiles`, um soft cap mensal, um reset preguiçoso por ciclo de faturamento, e um programa de parceiros inteiro construído sobre recorrência que nunca pagou uma comissão.

## O modelo novo

Um preço, um produto pago:

- **A análise ATS é gratuita** — anônima (ferramenta pública já construída) e para usuário logado.
- **A preparação completa custa R$10** — 5 seções de perguntas, pesquisa da empresa, benchmark salarial e CV reescrito.
- **Não existe preparação grátis.**
- **Não existe assinatura.**

Pacotes com desconto: **3 por R$25** (R$8,33 cada) e **5 por R$40** (R$8 cada).

Crédito não expira e não é reembolsável em dinheiro. Se a geração falhar, o crédito volta.

**Identificação da compra no Asaas.** O parser atual (`src/lib/billing/ids.ts`) entende `pro:<uid>` e `prep:<uid>:<nano>`. O formato passa a carregar a quantidade: **`prep:<uid>:<qtd>:<nano>`**, com `<qtd>` ∈ {1, 3, 5}. A quantidade vem do `externalReference`, nunca do valor pago — casar por valor quebraria em qualquer promoção ou ajuste de preço. Um `externalReference` no formato antigo (sem quantidade) é tratado como 1 crédito, para não perder pagamento em trânsito no momento do deploy.

## Onde fica a parede

O trabalho da ferramenta ATS anônima já construiu a peça central. A action `generateFullPrep` — criada para dar saída à prep reivindicada — é exatamente "gerar a preparação completa cobrando cota", separada da criação da sessão. **O modelo novo faz todo mundo passar por ela.**

```
/prep/new → cola vaga + CV → ATS roda GRÁTIS → mostra score e ajustes
                                                      ↓
                              [ Gerar preparação completa · R$10 ]
                                     ↓                        ↓
                            tem crédito: gera        sem crédito: checkout
```

`createPrep` deixa de disparar `runGenerationInBackground`. Ele cria a `prep_session`, roda a análise ATS, e para. A pessoa vê o score antes de qualquer cobrança.

Consequência boa: o caminho da prep reivindicada da ferramenta anônima e o caminho do usuário que colou direto no app convergem no mesmo estado — sessão com ATS pronto e sem `prep_guide`. O gate `isClaimedAtsOnlyPrep` (hoje discriminando por `company_intel_status`) passa a descrever o estado normal de toda prep nova, não uma exceção.

**Efeito sobre a prep reivindicada.** A spec da ferramenta anônima (2026-08-15, linha 105) diz que a análise reivindicada "não consome a preparação grátis vitalícia". Essa frase perde o objeto: não há mais preparação grátis. A regra que sobrevive é a que importava — **reivindicar não custa nada** (a pessoa recebe a sessão com o ATS já pronto), e **completar custa R$10**, igual a qualquer outra prep. Nenhuma exceção de cobrança para quem veio da ferramenta anônima.

## O gate de cota encolhe

`checkQuota` hoje devolve `pro | free | credit | block | pro_soft_cap`. Passa a devolver **`credit`** (tem saldo) ou **`block`** (não tem).

Saem de cena, em `profiles`: `preps_used_this_month`, `preps_reset_at`, `preps_this_billing_cycle`, `billing_cycle_started_at`. Sai também o soft cap mensal (`PRO_MONTHLY_SOFT_CAP`), o reset preguiçoso por ciclo, e as ramificações de `tier`/`subscription_status` no gate.

Permanece: `prep_credits` (já existe) e o bypass por `is_admin`.

**As colunas não são dropadas nesta entrega.** Elas param de ser lidas e escritas; a remoção física fica para o Projeto 2, depois de o modelo novo estar rodando em produção sem sustos. Dropar coluna e trocar comportamento no mesmo deploy é o padrão que já derrubou este produto uma vez (migration 0020).

## Abuso do ATS gratuito

Com ATS grátis para logado, alguém pode criar preps em série só para consumir análises. A guarda já existe: `LIMITS.createPrep` limita a 3 por hora por usuário. Isso passa a ser a única barreira desse caminho, e é suficiente — cada análise é uma chamada de IA barata, e o teto horário limita o dano.

## Migração do assinante existente

É **uma** pessoa. O tratamento é pontual, por SQL, não por rotina automatizada — não vale construir migração para um registro:

1. Cancelar a assinatura no painel do Asaas.
2. Creditar **3 preps** (o pagamento confirmado foi R$30; a R$10, dá 3).
3. Zerar `asaas_subscription_id` e `subscription_status` do perfil.

O crédito avulso já em circulação (1 unidade) permanece intocado.

## Varredura de texto

A promessa "primeira preparação grátis" precisa sair **no mesmo deploy** que a mudança de comportamento, senão o site promete o que o produto recusa. Ela aparece em:

- landing (hero e CTA final)
- CTA inline e de rodapé dos 44 artigos (`ArticleInlineCta.tsx` e `artigos/[slug]/page.tsx`)
- ferramenta ATS anônima (`AnonAtsForm`, `LockedFix`)
- `/signup`
- `/pricing`

A mensagem nova em cada lugar é a mesma ideia: a análise ATS é grátis, a preparação completa custa R$10.

## Fora de escopo

- **Programa de parceiros:** continua pausado. A comissão é 30% recorrente sobre assinatura; sem assinatura, o modelo não existe. Nunca gerou uma comissão, então redefinir agora seria desenhar para um problema inexistente.
- **Código de assinatura do Asaas:** `createSubscription`, `/api/billing/cancel` e os handlers `SUBSCRIPTION_*` do webhook ficam de pé como legado inalcançável. Estorno de pagamento antigo ainda passa por ali.
- **Métricas do admin:** MRR perde sentido e `GrantProButton` precisa virar concessão de crédito — Projeto 2.
- **Remoção física das colunas de contagem** — Projeto 2.

## Riscos

**O maior é a copy dessincronizada.** Se o gate novo subir e um único lugar continuar prometendo prep grátis, a pessoa cadastra esperando algo que não vem. Por isso a varredura de texto é requisito desta entrega, não polimento posterior.

**O segundo é cobrar duas vezes.** O consumo de crédito hoje é read-modify-write (`prep_credits - 1`), não decremento atômico. Com todo mundo passando pelo caminho pago, a chance de corrida sobe. A transição para "gerando" já é atômica via `WHERE prep_guide IS NULL`; o consumo do crédito precisa da mesma proteção.

**O terceiro é o crédito preso.** Se a geração falhar depois do consumo, a pessoa pagou e não recebeu. O crédito precisa voltar em toda falha do pipeline, e isso precisa de teste.

## Testes

Lógica pura, coberta por unidade:

- `checkQuota` com os dois modos, incluindo saldo zero, saldo negativo (não deve acontecer, mas não pode liberar) e bypass de admin
- cálculo de crédito por pacote comprado (1, 3, 5) a partir do `externalReference` do Asaas
- devolução do crédito em falha de geração
- consumo atômico: duas chamadas concorrentes com 1 crédito só geram uma prep e consomem um crédito

Integração: o webhook de pagamento confirmado credita a quantidade certa para cada SKU.

## Métricas de sucesso

Comparar 30 dias depois de subir, contra a linha de base atual (19 preps na história, 1 assinante, ~R$0 recorrente):

- quantas análises ATS gratuitas rodam (anônimas e logadas)
- taxa análise ATS → checkout iniciado
- taxa checkout iniciado → pagamento confirmado
- receita total e ticket médio (avulso vs pacote)

O tracking de paths internos foi ligado em 2026-08-15, e os eventos de funil da ferramenta anônima existem desde a branch `feat/analise-ats-anonima`. **Os eventos de checkout são requisito desta entrega**, não item futuro: sem `checkout_iniciado` e `checkout_confirmado` (com a quantidade comprada), três das quatro métricas acima ficam impossíveis de apurar sem SQL manual, e a decisão sobre manter ou matar os pacotes dependeria de palpite.
