// src/app/api/billing/cancel/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asaas } from "@/lib/billing/asaas";

export async function POST() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("asaas_subscription_id, subscription_status")
    .eq("id", auth.user.id)
    .single();
  const subId = (profile as { asaas_subscription_id?: string | null } | null)?.asaas_subscription_id;
  if (!subId) {
    return NextResponse.json({ ok: false, error: "Sem assinatura ativa" }, { status: 400 });
  }
  try {
    await asaas.cancelSubscription(subId);
  } catch (err) {
    console.error("[billing/cancel] asaas error:", err);
    return NextResponse.json(
      { ok: false, error: "Não consegui cancelar agora. Tente em instantes." },
      { status: 502 },
    );
  }
  await supabase
    .from("profiles")
    .update({ subscription_status: "canceled" })
    .eq("id", auth.user.id);
  return NextResponse.json({ ok: true });
}
