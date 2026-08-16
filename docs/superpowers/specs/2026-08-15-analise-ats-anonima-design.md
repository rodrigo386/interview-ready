# Análise ATS anônima — valor antes da parede de upload

**Data:** 2026-08-15
**Status:** aprovado, aguardando plano de implementação

## Problema

O funil não trava na aquisição, trava logo depois do cadastro. Dos 19 usuários reais (excluindo admin), medido em 2026-08-15:

| Passo | Chegaram |
|---|---|
| Cadastrou | 19 |
| Confirmou e-mail | 18 |
| Conseguiu sessão | 15 |
| Subiu um currículo | 8 |
| Criou uma prep | 5 |

A maior perda isolada é **login → upload de CV: 15 para 8**. Quase metade de quem entra nunca sobe nada. E nenhum usuário não-admin jamais voltou ao site: o `last_sign_in_at` é sempre o mesmo dia do cadastro. Não existe segunda sessão para recuperar quem desistiu na primeira.

A causa provável é a ordem: hoje é preciso criar conta, confirmar e-mail, colar a vaga **e** subir o currículo antes de receber qualquer valor. Esta feature inverte isso — entrega o resultado primeiro e pede a conta depois, quando a pessoa já viu que funciona.

Secundariamente, resolve a falta de ativo linkável: o domínio tem 4 meses, posição média 8 no Google e nenhum backlink relevante. Uma ferramenta pública gratuita é o tipo de página que ganha link, e link é o que falta para sair da posição 8.

## Objetivo

Uma página pública, sem cadastro, onde a pessoa cola a vaga, envia o currículo e recebe na hora o score ATS mais o primeiro ajuste. O restante dos ajustes exige conta — e ao criar a conta, a análise que ela já fez é migrada, sem refazer nada.

## Não-objetivos

Fora de escopo nesta entrega, adicionáveis depois se o dado justificar:

- Armazenar o arquivo enviado (só o texto extraído é gravado)
- Histórico de análises anônimas
- CV reescrito para anônimos
- Captcha
- Preparação completa (seções, pesquisa da empresa) para anônimos

## Fluxo

1. `/analise-ats-gratis` — página pública. Campo para colar a vaga + envio de PDF/DOCX ou colagem do CV.
2. Server action `runAnonAtsAnalysis`:
   - checa limite por IP e teto global diário (ver Guardas)
   - parseia o CV em memória (`pdf-parse` / `mammoth`); o arquivo nunca é gravado
   - roda a análise no Cerebras, com Gemini como fallback só em caso de falha
   - grava a linha em `anon_ats_analyses`, define o cookie `pv_anon_ats` com o token
3. `/analise-ats-gratis/resultado` lê o token do cookie e mostra gauge, score, resumo de palavras-chave encontradas e o **primeiro ajuste por inteiro**. Os demais aparecem borrados com cadeado e contagem ("mais 4 ajustes").
4. CTA leva para `/signup`, sem parâmetro.
5. **No envio do cadastro** (não na confirmação do e-mail), `claimAnonAnalysis` lê o cookie, cria uma `prep_session` com `cv_text`, `job_description`, `ats_analysis` e `ats_status='complete'`, e marca a linha anônima como reivindicada. Ao confirmar o e-mail, a pessoa entra e a prep já está lá.

O token nunca aparece em URL. Ele dá acesso ao texto do currículo, e query string vaza por `Referer`, histórico e log de servidor — por isso trafega só no cookie `HttpOnly`. Isso também é o que torna a reivindicação robusta: ela acontece no cadastro, no mesmo navegador onde o cookie existe. Se ela dependesse da confirmação do e-mail, quebraria no caso — já suportado hoje — em que a pessoa abre o link de confirmação em outro navegador.

## Modelo de dados

Migration `0023_anon_ats_analyses.sql`:

```sql
create table public.anon_ats_analyses (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  cv_text text not null,
  job_description text not null,
  job_title text,
  company_name text,
  analysis jsonb,
  status text not null default 'pending',   -- pending|generating|complete|failed
  error_message text,
  model_used text,                          -- 'cerebras' | 'gemini'
  ip_hash text,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on public.anon_ats_analyses (token);
create index on public.anon_ats_analyses (created_at);
alter table public.anon_ats_analyses enable row level security;
```

**Sem policy para `anon` ou `authenticated`.** Todo acesso passa por server action usando o admin client, autorizado pelo token. O token é opaco (`crypto.randomUUID()`), não é o `id`, e vive num cookie `HttpOnly`.

`ip_hash` guarda SHA-256 do IP com salt, não o IP — serve para auditar abuso sem armazenar dado pessoal.

Expiração de 7 dias, avaliada **na leitura** (`expires_at < now()` é tratado como inexistente). Não depende de cron. Uma limpeza periódica pode ser adicionada depois; enquanto o volume for baixo, linhas expiradas apenas ocupam espaço.

## Guardas

Ordem de verificação, tudo antes de qualquer chamada de IA:

1. **Limite por IP:** 3 análises por hora. Diferente do resto do sistema, este limite **falha fechado** — se o Upstash estiver indisponível, a análise é recusada. O `rateLimit()` atual falha aberto, o que é seguro em ação que exige login, mas seria porta aberta num endpoint anônimo com chamada de IA.
2. **Teto global diário:** contagem de linhas criadas nas últimas 24h contra um limite configurável (`ANON_ATS_DAILY_CAP`, padrão 200). Funciona como disjuntor: o pior caso de custo por dia é conhecido.
3. **Tamanho:** CV e vaga com limite de caracteres, reaproveitando `clampJobDescription`.

Bloqueio em qualquer um dos três mostra um convite a criar conta, não uma mensagem de erro seca.

## LLM e imutabilidade do score

A análise anônima roda no **Cerebras** (`qwen-3-235b-a22b-instruct-2507`, free tier já integrado em `src/lib/ai/cerebras.ts`). Custo marginal zero. Se o Zod rejeitar a resposta ou o free tier estourar, refaz no **Gemini** — o custo pago acontece só na fração que falha, e continua limitado pelos mesmos tetos.

**Regra dura: a reivindicação copia a análise armazenada, nunca roda de novo.** A PR #36 tornou o ATS determinístico (`temperature: 0`, `topK: 1`, `topP: 0`) para que o mesmo CV e a mesma vaga sempre dessem a mesma nota. Como o lado anônimo usa outro modelo, rodar de novo na reivindicação faria a nota mudar entre "62 antes de criar conta" e "71 depois" — e o número é justamente a isca. Se ele se move sozinho, a credibilidade vai junto.

Resíduo aceito e tratado: o botão "Rerodar análise" dentro do app usa Gemini e vai alterar a nota de uma prep reivindicada. Numa prep com `model_used = 'cerebras'`, esse botão é rotulado "Refazer com análise completa", deixando explícito que o número pode mudar.

## Interação com a quota

A análise reivindicada **não consome** a preparação grátis vitalícia — ela entrega apenas o ATS. Gerar a preparação completa a partir dela (5 seções + pesquisa da empresa + benchmark salarial) é que consome. O presente não pode virar pegadinha.

## Risco de integração conhecido

O layout de `/prep/[id]` valida `prep_guide` hoje. Uma sessão reivindicada nasce **sem** `prep_guide`, só com ATS. Sem tratamento, isso quebra a rota — foi exatamente o padrão que derrubou todas as preps quando faltou a migration 0020 (`loadPrepSession` selecionava colunas inexistentes, retornava null, e `/prep/[id]` chamava `notFound()`).

**Decisão: o layout passa a tolerar `prep_guide` nulo**, mostrando as etapas 3–5 como "ainda não geradas" e a etapa 2 (ATS) completa. A prep reivindicada é uma prep de verdade, que a pessoa vai querer completar; mandá-la para uma rota separada fragmentaria o produto e duplicaria a interface do resultado ATS. Um teste cobre especificamente o carregamento de `/prep/[id]` e `/prep/[id]/ats` com `prep_guide` nulo.

Regra geral herdada: aplicar a migration **antes** de deployar o código que referencia as colunas novas.

## Testes

Lógica pura, coberta por unidade:

- `normalizeAnonInput` — limites de tamanho, rejeição de entrada vazia
- verificação do teto diário e do limite por IP, incluindo **o caminho de falha fechada** quando o Upstash não responde
- `anonAnalysisToPrepSession` — mapeamento da linha anônima para o insert de `prep_session`
- expiração na leitura: linha com `expires_at` no passado é tratada como inexistente
- reivindicação é idempotente: token já reivindicado não cria segunda prep

Integração: `atsAnalysisSchema` aceita `top_fixes` vazio desde 2026-08-15, então um CV que casa perfeitamente com a vaga produz um resultado anônimo válido ("nenhum ajuste necessário"), e não uma falha.

E2E de fumaça: a página pública responde 200 e não vaza a análise completa no HTML antes do cadastro.

## Métricas de sucesso

Medir 30 dias depois de subir, comparando com a linha de base atual (visitante → cadastro ~6%, sessão → upload de CV 15/8):

- quantas análises anônimas são executadas
- taxa análise anônima → cadastro
- taxa de reivindicação entre quem cadastra vindo da ferramenta
- se a perda no passo de upload diminui para quem entra por esse caminho

O tracking de paths internos foi ligado em 2026-08-15 (commit `88326ff`), então esses passos passam a ser observáveis. Com ~3 visitantes reais por dia, são necessárias 2 a 3 semanas de acúmulo antes de qualquer leitura ter significado.
