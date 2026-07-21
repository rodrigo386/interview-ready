import type { EmailOtpType } from "@supabase/supabase-js";

const ALLOWED: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Validates the `type` query param of /auth/confirm against the OTP types
 * Supabase accepts in verifyOtp. Returns null for anything else so the route
 * can 400 instead of forwarding attacker-controlled strings to the API.
 */
export function parseOtpType(raw: string | null | undefined): EmailOtpType | null {
  if (!raw) return null;
  return (ALLOWED as string[]).includes(raw) ? (raw as EmailOtpType) : null;
}

/** Where to land after a successful verification, per link type. */
export function postConfirmRedirect(type: EmailOtpType): string {
  return type === "recovery" ? "/reset" : "/dashboard";
}
