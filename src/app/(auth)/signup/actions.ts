"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  fullName: z.string().min(1, "Informe seu nome"),
  cpfCnpj: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^0-9]/g, ""))
    .refine((v) => v.length === 11 || v.length === 14, {
      message: "CPF (11 dígitos) ou CNPJ (14 dígitos) inválido",
    }),
});

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
    fullName: formData.get("fullName"),
    cpfCnpj: formData.get("cpfCnpj"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

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
      options: { data: { full_name: parsed.data.fullName } },
    });

    if (error) {
      // Log only message + status code, never the full error object — it
      // contains the email payload and other PII that ends up in Railway logs.
      console.error("[signup] supabase signUp error:", error.message, error.status);
      return { error: mapSupabaseError(error.message) };
    }

    // Persist CPF on the profile row created by the auth.users trigger.
    // cpf_cnpj is in the column-level GRANT denylist for `authenticated`
    // (migration 0011), so this write must go via admin client.
    if (data.user) {
      const admin = createAdminClient();
      const { error: cpfErr } = await admin
        .from("profiles")
        .update({ cpf_cnpj: parsed.data.cpfCnpj })
        .eq("id", data.user.id);
      if (cpfErr) {
        console.warn("[signup] cpf_cnpj update failed:", cpfErr.message);
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
