import "server-only";
import { env } from "@/lib/env";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM_ADDRESS = "PrepaVAGA <nao-responda@prepavaga.com.br>";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Optional reply-to (e.g. prepavaga@prepavaga.com.br for support replies). */
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_api_key" | "http_error"; detail?: string };

/**
 * Send a transactional email via Resend REST. Used for partner notifications
 * (approved, paid, etc) — auth flow uses Supabase's own SMTP integration.
 *
 * Fails gracefully when RESEND_API_KEY is missing: logs warn and returns
 * { ok: false, reason: "no_api_key" }. Callers should treat send failures
 * as non-blocking — never let an email failure break the underlying action.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!env.RESEND_API_KEY) {
    console.warn(
      `[email] RESEND_API_KEY not set — would have sent: ${input.subject} → ${input.to}`,
    );
    return { ok: false, reason: "no_api_key" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[email] Resend ${res.status}: ${detail.slice(0, 200)}`);
      return { ok: false, reason: "http_error", detail: `${res.status}: ${detail.slice(0, 200)}` };
    }
    const body = (await res.json()) as { id?: string };
    return { ok: true, id: body.id ?? "" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn("[email] sendEmail failed:", detail);
    return { ok: false, reason: "http_error", detail };
  }
}
