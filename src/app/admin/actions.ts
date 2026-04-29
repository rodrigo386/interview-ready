"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminActionResult = { ok: true } | { ok: false; error: string };
export type DeleteUserResult = AdminActionResult;

export async function deleteUserAction(userId: string): Promise<DeleteUserResult> {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    return { ok: false, error: "Não é possível deletar sua própria conta admin." };
  }

  const sb = createAdminClient();

  // Bloqueia deleção de outros admins (somente via SQL).
  const { data: target } = await sb
    .from("profiles")
    .select("is_admin, email")
    .eq("id", userId)
    .single();
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  if ((target as { is_admin?: boolean }).is_admin) {
    return {
      ok: false,
      error: "Outro admin não pode ser deletado pela UI. Remova o flag is_admin via SQL antes.",
    };
  }

  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function grantProAction(userId: string): Promise<AdminActionResult> {
  await requireAdmin();
  const sb = createAdminClient();

  const { error } = await sb
    .from("profiles")
    .update({
      tier: "pro",
      subscription_status: "active",
    })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function revokeProAction(userId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    return { ok: false, error: "Não é possível remover Pro da sua própria conta admin." };
  }

  const sb = createAdminClient();

  const { data: target } = await sb
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  if ((target as { is_admin?: boolean }).is_admin) {
    return {
      ok: false,
      error: "Admins têm Pro permanente. Remova o flag is_admin via SQL antes.",
    };
  }

  const { error } = await sb
    .from("profiles")
    .update({
      tier: "free",
      subscription_status: "none",
    })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true };
}
