"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { claimAndSendWelcomeEmail } from "@/lib/email/welcome-email";
import { parseOtpType, postConfirmRedirect } from "@/lib/auth/otp-type";

export type ConfirmEmailState = { error?: string };

/**
 * Verifies an email link via token_hash + verifyOtp. Unlike the PKCE code
 * flow (/auth/callback), this works in ANY browser — the person can sign up
 * on Chrome and open the email in an in-app webview and it still verifies.
 * Combined with the click-to-confirm page (bots GET, humans POST), it also
 * survives Outlook SafeLinks / Gmail scanners prefetching the link.
 */
export async function confirmEmail(
  _prev: ConfirmEmailState,
  formData: FormData,
): Promise<ConfirmEmailState> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = parseOtpType(String(formData.get("type") ?? ""));

  if (!tokenHash || !type) {
    return { error: "Link inválido. Abra o link mais recente do seu email." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    console.warn("[auth/confirm] verifyOtp failed:", error.message);
    return {
      error:
        "Este link expirou ou já foi usado. Se você já confirmou antes, é só fazer login normalmente — sua senha funciona.",
    };
  }

  // First session established — fire the welcome email now instead of waiting
  // for a dashboard visit that (as the data showed) may never happen.
  const user = data.user;
  if (user?.email && (type === "signup" || type === "email")) {
    await claimAndSendWelcomeEmail({ userId: user.id, email: user.email });
  }

  redirect(postConfirmRedirect(type));
}
