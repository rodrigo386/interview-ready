"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  fullName: z.string().min(1, "Informe seu nome"),
});

export type SignupState = {
  error?: string;
  pendingConfirmation?: boolean;
};

function mapSupabaseError(message: string): string {
  if (/already registered|already exists/i.test(message)) {
    return "Já existe uma conta com este e-mail.";
  }
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.fullName } },
    });

    if (error) {
      console.error("[signup] supabase signUp error:", error.message, error);
      return { error: mapSupabaseError(error.message) };
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
