"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "anon";
  const rl = await rateLimit(
    `login:${ip}:${parsed.data.email.toLowerCase()}`,
    LIMITS.authLogin,
  );
  if (!rl.success) {
    return {
      error: `Muitas tentativas de login. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "E-mail ou senha inválidos" };
  }

  redirect("/dashboard");
}
