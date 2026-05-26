"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";
import { attachReferral } from "@/lib/affiliate/attribution";

// Experiment PRE-14 (signup friction reduction, second pass): only email +
// password. Full name is derived from the email local-part with light cleanup
// (humps split, capitalized). User can override later in /profile. PRE-4 had
// removed CPF/endereço; this removes the last optional-feeling field. Every
// removed field bumps signup completion ~10-15%.
const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
});

/**
 * Best-effort guess at a display name from the email local-part. Used as the
 * default `full_name` when the user signs up. Always overridable in /profile.
 * Examples:
 *   ana.silva@x.com → "Ana Silva"
 *   joao_pedro_123@x.com → "Joao Pedro 123"
 *   anaSilva@x.com → "Ana Silva"  (split on camelHumps)
 *   x@x.com → "X"
 */
export function deriveNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  if (!local) return "";
  return local
    .replace(/[._+-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export type SignupState = {
  error?: string;
  pendingConfirmation?: boolean;
};

function mapSupabaseError(message: string): string {
  // Note: we deliberately do NOT branch on "already registered" here.
  // Returning that message reveals account existence (enumeration vector).
  // Supabase's signUp returns success+pendingConfirmation for already-
  // registered emails when "Confirm email" is on, which is what we want.
  if (/confirmation email/i.test(message)) {
    return "Cadastro feito, mas o envio do e-mail de confirmação falhou. Entre em contato com o suporte.";
  }
  return "Não conseguimos criar sua conta. Tente novamente.";
}

export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const fullName = deriveNameFromEmail(parsed.data.email);

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "anon";
  const rl = await rateLimit(`signup:${ip}`, LIMITS.authSignup);
  if (!rl.success) {
    return {
      error: `Muitos cadastros deste IP. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      // Log only message + status code, never the full error object — it
      // contains the email payload and other PII that ends up in Railway logs.
      console.error("[signup] supabase signUp error:", error.message, error.status);
      return { error: mapSupabaseError(error.message) };
    }

    // CPF + endereço NÃO são mais coletados no signup (experimento PRE-4 de
    // redução de fricção). O profile row é criada pelo trigger de auth.users
    // com esses campos nulos; /api/billing/checkout os coleta sob demanda no
    // primeiro checkout via os diálogos cpf_required / address_required.
    if (data.user) {
      const admin = createAdminClient();

      // Affiliate attribution: same pattern as auth/callback. If user has pv_ref
      // cookie, link to partner. Idempotent. Failure tolerated.
      const cookieStore = await cookies();
      const refCode = cookieStore.get("pv_ref")?.value;
      if (refCode) {
        try {
          await attachReferral(data.user.id, refCode, admin);
        } catch (err) {
          console.warn("[signup] attribution failed:", err);
        }
        cookieStore.delete("pv_ref");
      }
    }

    // If email confirmation is required, Supabase returns user but no session.
    if (!data.session) {
      return { pendingConfirmation: true };
    }
  } catch (err) {
    // redirect() throws NEXT_REDIRECT which Next handles — let it propagate.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof err.digest === "string" &&
      err.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    console.error("[signup] unexpected error:", err);
    return { error: "Erro inesperado. Tente novamente em alguns instantes." };
  }

  redirect("/dashboard");
}
