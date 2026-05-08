"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCode } from "@/lib/affiliate/code";

export async function applyAsAffiliate(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) {
    redirect("/signup?next=/parceiros");
  }

  const displayName = String(formData.get("display_name") || "").trim();
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const bio = String(formData.get("bio") || "").trim() || null;
  const pixKey = String(formData.get("pix_key") || "").trim();
  const why = String(formData.get("why") || "").trim();

  if (!displayName || displayName.length < 2) return { ok: false, error: "Nome inválido" };
  if (!validateCode(code)) {
    return { ok: false, error: "Código inválido (use só A-Z, 0-9 e hífen, 2-40 caracteres)" };
  }
  if (!pixKey) return { ok: false, error: "Chave Pix obrigatória" };
  if (!why || why.length < 30) {
    return { ok: false, error: "Conta um pouco mais sobre seu público (mínimo 30 caracteres)" };
  }

  const admin = createAdminClient();

  // Already applied?
  const { data: existing } = await admin
    .from("affiliate_partners")
    .select("id, status")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (existing) {
    const ex = existing as { status: string };
    return {
      ok: false,
      error: `Você já aplicou. Status atual: ${ex.status}.`,
    };
  }

  // Code uniqueness check
  const { data: codeTaken } = await admin
    .from("affiliate_partners")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (codeTaken) {
    return { ok: false, error: "Este código já está em uso. Escolha outro." };
  }

  // Update profile pix_key
  await admin.from("profiles").update({ pix_key: pixKey }).eq("id", data.user.id);

  // Insert partner row (status=pending)
  const { error } = await admin.from("affiliate_partners").insert({
    user_id: data.user.id,
    code,
    display_name: displayName,
    bio,
    notes: `Audiência/Por quê:\n${why}`,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  // Note: deliberately NOT calling revalidatePath("/parceiros") here.
  // The form re-renders client-side via setSuccess(true), then the
  // SuccessRedirect component does router.push("/dashboard") + refresh
  // after 10s. revalidatePath was triggering a server re-render of
  // /parceiros mid-action that occasionally appeared to invalidate the
  // user's session — surfacing as the "logged out after applying" bug
  // reported in prod.
  return { ok: true };
}
