"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";

const schema = z.object({ email: z.string().email("E-mail inválido") });

export type ForgotPasswordState = {
  error?: string;
  /** Always set to true after a successful submission, even when the
   * email doesn't exist — prevents account enumeration. */
  ok?: boolean;
};

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Per-email + per-IP rate limit. Tight window (3 per 10 min) — generous
  // enough for legitimate "I mistyped" but kills brute-force email scrapes.
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "anon";
  const rl = await rateLimit(
    `forgot:${ip}:${parsed.data.email.toLowerCase()}`,
    LIMITS.passwordReset,
  );
  if (!rl.success) {
    return {
      error: `Muitas solicitações. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
    };
  }

  // Build redirect target from the request host so the email link returns
  // the user to the same domain they started on (apex prepavaga.com.br).
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "prepavaga.com.br";
  const redirectTo = `${proto}://${host}/auth/reset`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  // Always return ok=true. Do NOT reveal whether the email exists — that's
  // an account enumeration vector. Log internal errors but mask them.
  if (error) {
    console.warn("[forgot-password] resetPasswordForEmail error:", error.message);
  }
  return { ok: true };
}
