"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
});

export type ResetPasswordState = { error?: string };

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = schema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // The user is on this page because they clicked a recovery link — Supabase
  // already exchanged the token for a session via auth/callback. updateUser
  // requires that session.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      error: "Sessão de recuperação expirou. Solicite um novo link.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.warn("[reset-password] updateUser error:", error.message);
    return { error: "Não foi possível redefinir a senha. Tente novamente." };
  }

  redirect("/dashboard");
}
