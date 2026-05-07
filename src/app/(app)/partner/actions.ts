"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updatePixKey(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: "Não autenticado" };

  const pixKey = String(formData.get("pix_key") || "").trim();
  if (!pixKey) return { ok: false, error: "Chave Pix obrigatória" };
  if (pixKey.length > 200) return { ok: false, error: "Chave Pix muito longa" };

  // Use admin client because column-level GRANT (migration 0011) restricts what
  // `authenticated` can UPDATE on profiles — pix_key is not in the allowlist.
  // We've already verified data.user.id, and we scope the update to that id.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ pix_key: pixKey })
    .eq("id", data.user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/partner");
  return { ok: true };
}
