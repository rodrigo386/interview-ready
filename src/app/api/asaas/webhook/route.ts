// src/app/api/asaas/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { verifyToken, dispatchEvent } from "@/lib/billing/webhook";
import type { AsaasWebhookEvent } from "@/lib/billing/types";

function adminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSbClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  const token = req.headers.get("asaas-access-token");
  if (!verifyToken(token)) {
    console.warn("[asaas/webhook] token mismatch");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: AsaasWebhookEvent;
  try {
    body = (await req.json()) as AsaasWebhookEvent;
  } catch (err) {
    console.warn("[asaas/webhook] invalid JSON:", err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const asaasEventId =
    (body as unknown as { id?: string }).id ??
    `${body.event}:${body.payment?.id ?? body.subscription?.id ?? Date.now()}`;

  try {
    const supabase = adminClient();
    const result = await dispatchEvent(body, asaasEventId, supabase);
    if (!result.handled && result.reason !== "duplicate") {
      console.warn(`[asaas/webhook] not handled: ${result.reason}`, body.event);
    }
  } catch (err) {
    console.error("[asaas/webhook] dispatch error:", err);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
