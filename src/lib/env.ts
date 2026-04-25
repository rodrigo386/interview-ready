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
