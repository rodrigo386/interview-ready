"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isApplicationStatus } from "@/lib/prep/application-status";

export type SetStatusResult = { ok: true } | { ok: false; error: "unauthorized" | "invalid" | "not_found" | "failed" };

/**
 * Marca o status da candidatura de uma prep.
 *
 * A coluna `application_status` não tem GRANT de UPDATE pra `authenticated`
 * (migration 0025, mesmo padrão da 0024), então a escrita vai pelo admin
 * client — e a posse é garantida pelo `.eq("user_id", user.id)` explícito, que
 * aqui é a ÚNICA barreira (o admin client ignora RLS). Por isso a checagem de
 * "afetou exatamente uma linha": uma prep de outra pessoa afeta zero e vira
 * `not_found`, nunca sucesso silencioso.
 *
 * Devolve resultado em vez de lançar/redirecionar: quem chama é um `<select>`
 * num componente de cliente, que precisa reverter o valor otimista se falhar.
 */
export async function setApplicationStatus(
  sessionId: string,
  status: string,
): Promise<SetStatusResult> {
  if (!isApplicationStatus(status)) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("prep_sessions")
    .update({
      application_status: status,
      application_status_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    console.error("[setApplicationStatus]", error.message);
    return { ok: false, error: "failed" };
  }
  if (!data || data.length !== 1) return { ok: false, error: "not_found" };

  revalidatePath("/dashboard");
  return { ok: true };
}
