import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Optional — callers should fall back to x-forwarded-host if absent.
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  GOOGLE_API_KEY: z
    .union([z.string().min(1), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  ASAAS_API_KEY: z
    .union([z.string().min(1), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  ASAAS_WEBHOOK_TOKEN: z
    .union([z.string().min(1), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  ASAAS_BASE_URL: z
    .string()
    .url()
    .default("https://sandbox.asaas.com/api/v3"),
  // Upstash for rate limiting. Optional: when missing, ratelimit fails open.
  UPSTASH_REDIS_REST_URL: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  UPSTASH_REDIS_REST_TOKEN: z
    .union([z.string().min(1), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  // Resend API key for transactional emails (partner approved, payout sent,
  // etc). Different from the SMTP creds Supabase Auth uses — this is a
  // separate key with `Sending Access` scope. When unset, sendEmail() logs
  // a warning and returns without throwing (keeps dev/CI green).
  RESEND_API_KEY: z
    .union([z.string().min(1), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  // Disjuntor de custo da ferramenta ATS anônima: máximo de análises por
  // dia no total. Estourou, a página convida a criar conta em vez de rodar.
  ANON_ATS_DAILY_CAP: z.coerce.number().int().positive().default(200),
  // Salt secreto para hashear IPs antes de persistir (ex.: ip_hash da ATS
  // anônima). Sem isso, um hash de IPv4 é reversível por força bruta (só
  // ~4,3 bilhões de valores) mesmo em SHA-256 — o salt precisa viver fora
  // do código-fonte para o hash valer como anonimização. Se ausente, o
  // código que depende dele deve preferir não gravar nada a gravar um hash
  // fraco que finge ser seguro.
  IP_HASH_SALT: z
    .union([z.string().min(1), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  // PostHog. Sem a KEY, `initAnalytics()` e `trackServer()` viram no-op e o
  // funil inteiro (15 eventos) para de existir — silenciosamente, sem erro.
  // Declarada aqui mesmo sendo opcional porque variável que não está no
  // schema não aparece em lugar nenhum: foi assim que ficou meses ausente
  // sem ninguém notar. Ver `INTEGRACOES_INERTES` abaixo.
  //
  // HOST tem default EU de propósito: `/lgpd` e `/privacidade` prometem
  // residência de dados na Europa e IP não armazenado. Apontar pra US aqui
  // contradiz página pública.
  NEXT_PUBLIC_POSTHOG_KEY: z
    .union([z.string().min(1), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  NEXT_PUBLIC_POSTHOG_HOST: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

function parseOrThrow(): Env {
  const result = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN,
    ASAAS_BASE_URL: process.env.ASAAS_BASE_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ANON_ATS_DAILY_CAP: process.env.ANON_ATS_DAILY_CAP,
    IP_HASH_SALT: process.env.IP_HASH_SALT,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables. See .env.example for required keys.");
  }
  return result.data;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!cached) cached = parseOrThrow();
    return cached[prop as keyof Env];
  },
});

/**
 * Subsistemas que, sem a env var, NÃO quebram — apenas deixam de existir.
 *
 * Este é o modo de falha mais caro que este repo já teve, duas vezes:
 *  - `UPSTASH_*` ausente deixou TODOS os rate limits inertes, incluindo a
 *    proteção contra credential stuffing no login. Descoberto só quando a
 *    ferramenta ATS anônima (única com `failClosed`) começou a recusar tudo.
 *  - `NEXT_PUBLIC_POSTHOG_KEY` ausente deixou os 15 eventos de funil
 *    inertes. Descoberto ao investigar por que não se sabia se um usuário
 *    tinha visto o paywall — a resposta era que o dado nunca existiu.
 *
 * Erro de configuração que não faz barulho é indistinguível de "está tudo
 * bem". A lista existe pra que a próxima ausência grite no boot.
 */
export const INTEGRACOES_INERTES: ReadonlyArray<{
  envVar: string;
  consequencia: string;
}> = [
  {
    envVar: "UPSTASH_REDIS_REST_URL",
    consequencia:
      "rate limits inertes (login, signup, reset de senha e todos os de IA falham ABERTO)",
  },
  {
    envVar: "UPSTASH_REDIS_REST_TOKEN",
    consequencia: "idem UPSTASH_REDIS_REST_URL — as duas são necessárias",
  },
  {
    envVar: "NEXT_PUBLIC_POSTHOG_KEY",
    consequencia:
      "funil cego: os 15 eventos (cta_click, paywall_view, checkout_confirmado…) viram no-op no cliente E no servidor",
  },
  {
    envVar: "GOOGLE_API_KEY",
    consequencia: "toda geração de IA falha (este NÃO é silencioso, mas é fatal)",
  },
];

/**
 * Puro pra ser testável: recebe o ambiente e devolve o que está inerte.
 * Não lê `process.env` nem loga — quem faz isso é `avisarIntegracoesInertes`.
 */
export function detectarInertes(
  vars: Record<string, string | undefined>,
): Array<{ envVar: string; consequencia: string }> {
  return INTEGRACOES_INERTES.filter(({ envVar }) => {
    const v = vars[envVar];
    return v === undefined || v.trim() === "";
  });
}

/**
 * Chamado uma vez no boot do servidor (`src/instrumentation.ts`). Só grita em
 * produção: em dev e em CI a ausência é esperada e o ruído seria ignorado —
 * e aviso ignorado não é aviso.
 */
export function avisarIntegracoesInertes(
  vars: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
  isProd: boolean = process.env.NODE_ENV === "production",
): void {
  if (!isProd) return;
  const inertes = detectarInertes(vars);
  if (inertes.length === 0) return;
  console.warn(
    `\n[env] ${inertes.length} integração(ões) DESLIGADA(S) em produção — sem erro, sem efeito:\n` +
      inertes.map((i) => `  · ${i.envVar} ausente → ${i.consequencia}`).join("\n") +
      "\n",
  );
}
