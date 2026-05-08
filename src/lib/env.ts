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
  // Cerebras: optional last-resort fallback for AI generation when Gemini
  // chain (3.1-flash-lite → 2.5-flash → 2.5-flash-lite) all 503. Free tier
  // OpenAI-compatible REST. Get key at https://cloud.cerebras.ai
  CEREBRAS_API_KEY: z
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
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN,
    ASAAS_BASE_URL: process.env.ASAAS_BASE_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
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
