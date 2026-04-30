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
  postalCode: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^0-9]/g, ""))
    .refine((v) => v.length === 8, { message: "CEP deve ter 8 dígitos" }),
  addressStreet: z.string().trim().min(1, "Informe o logradouro"),
  addressNumber: z.string().trim().min(1, "Informe o número"),
  addressComplement: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  addressDistrict: z.string().trim().min(1, "Informe o bairro"),
  addressCity: z.string().trim().min(1, "Informe a cidade"),
  addressState: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, "UF deve ter 2 letras"),
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
    postalCode: formData.get("postalCode"),
    addressStreet: formData.get("addressStreet"),
    addressNumber: formData.get("addressNumber"),
    addressComplement: formData.get("addressComplement"),
    addressDistrict: formData.get("addressDistrict"),
    addressCity: formData.get("addressCity"),
    addressState: formData.get("addressState"),
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

    // Persist CPF + endereço no profile row criada pelo auth.users trigger.
    // cpf_cnpj está no denylist de GRANT pra `authenticated` (migration 0011),
    // então usamos admin client. Os campos de endereço estão no allowlist
    // (migration 0015) mas a gente passa pelo admin pra simplificar — uma
    // única round-trip cobre tudo.
    if (data.user) {
      const admin = createAdminClient();
      const { error: profileErr } = await admin
        .from("profiles")
        .update({
          cpf_cnpj: parsed.data.cpfCnpj,
          postal_code: parsed.data.postalCode,
          address_street: parsed.data.addressStreet,
          address_number: parsed.data.addressNumber,
          address_complement: parsed.data.addressComplement,
          address_district: parsed.data.addressDistrict,
          address_city: parsed.data.addressCity,
          address_state: parsed.data.addressState,
        })
        .eq("id", data.user.id);
      if (profileErr) {
        console.warn("[signup] profile update failed:", profileErr.message);
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
