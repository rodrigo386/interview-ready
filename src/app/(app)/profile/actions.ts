"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const updateProfileSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  preferred_language: z.enum(["en", "pt-br", "es"]).optional(),
});

const updateAvatarPathSchema = z.object({
  ext: z.enum(["jpg", "png", "webp"]),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

// Generic message returned to clients on DB failure. Never echo the raw
// Supabase error.message — that leaks schema details (column names,
// constraints, RLS policy names) and aids attackers fingerprinting the DB.
function dbErrorOf(scope: string, err: { message: string; code?: string }): string {
  console.error(`[${scope}] DB error:`, err.message, err.code);
  return "Não foi possível salvar agora. Tente novamente em alguns instantes.";
}

export async function updateProfile(input: z.infer<typeof updateProfileSchema>): Promise<ActionResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  const patch: Record<string, unknown> = {};
  if (parsed.data.full_name !== undefined) patch.full_name = parsed.data.full_name || null;
  if (parsed.data.preferred_language !== undefined) patch.preferred_language = parsed.data.preferred_language;
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from("profiles").update(patch).eq("id", auth.user.id);
  if (error) return { ok: false, error: dbErrorOf("updateProfile", error) };

  revalidatePath("/profile");
  return { ok: true };
}

export async function updateAvatarPath(input: z.infer<typeof updateAvatarPathSchema>): Promise<ActionResult> {
  const parsed = updateAvatarPathSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Extensão inválida." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  const path = `${auth.user.id}/avatar.${parsed.data.ext}`;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: path, avatar_updated_at: new Date().toISOString() })
    .eq("id", auth.user.id);
  if (error) return { ok: false, error: dbErrorOf("updateAvatarPath", error) };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeAvatar(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  const uid = auth.user.id;
  // Try to remove all avatar variants from storage; ignore not-found errors.
  await supabase.storage.from("avatars").remove([
    `${uid}/avatar.jpg`,
    `${uid}/avatar.png`,
    `${uid}/avatar.webp`,
  ]);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null, avatar_updated_at: new Date().toISOString() })
    .eq("id", uid);
  if (error) return { ok: false, error: dbErrorOf("removeAvatar", error) };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

// CVs
const cvIdSchema = z.object({ cvId: z.string().uuid() });
const renameSchema = z.object({
  cvId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(80),
});
const prepIdSchema = z.object({ prepSessionId: z.string().uuid() });

export async function deleteUploadedCv(input: z.infer<typeof cvIdSchema>): Promise<ActionResult> {
  const parsed = cvIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  // Look up file_path before deleting the row so we can clean up storage.
  const { data: row } = await supabase
    .from("cvs")
    .select("file_path")
    .eq("id", parsed.data.cvId)
    .eq("user_id", auth.user.id)
    .single();

  const { error } = await supabase
    .from("cvs")
    .delete()
    .eq("id", parsed.data.cvId)
    .eq("user_id", auth.user.id);
  if (error) return { ok: false, error: dbErrorOf("deleteUploadedCv", error) };

  if (row?.file_path) {
    await supabase.storage.from("cvs").remove([row.file_path]);
  }

  revalidatePath("/profile/cvs");
  return { ok: true };
}

export async function renameUploadedCv(input: z.infer<typeof renameSchema>): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nome inválido." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  const { error } = await supabase
    .from("cvs")
    .update({ display_name: parsed.data.displayName } as never)
    .eq("id", parsed.data.cvId)
    .eq("user_id", auth.user.id);
  if (error) return { ok: false, error: dbErrorOf("renameUploadedCv", error) };

  revalidatePath("/profile/cvs");
  return { ok: true };
}

export async function deleteAiCvRewrite(input: z.infer<typeof prepIdSchema>): Promise<ActionResult> {
  const parsed = prepIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  const { error } = await supabase
    .from("prep_sessions")
    .update({ cv_rewrite: null, cv_rewrite_status: "pending", cv_rewrite_error: null })
    .eq("id", parsed.data.prepSessionId)
    .eq("user_id", auth.user.id);
  if (error) return { ok: false, error: dbErrorOf("deleteAiCvRewrite", error) };

  revalidatePath("/profile/cvs");
  return { ok: true };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export async function changePassword(
  input: z.infer<typeof changePasswordSchema>,
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Senha nova precisa ter pelo menos 8 caracteres." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !auth.user.email) return { ok: false, error: "Não autenticado." };

  // Reauthenticate by attempting sign-in with current password.
  const { error: reAuthErr } = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: parsed.data.currentPassword,
  });
  if (reAuthErr) return { ok: false, error: "Senha atual incorreta." };

  const { error: updErr } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (updErr) {
    console.error("[changePassword] updateUser error:", updErr.message);
    return { ok: false, error: "Não foi possível alterar a senha. Tente novamente." };
  }

  return { ok: true };
}

const deleteAccountSchema = z.object({
  confirmation: z.literal("EXCLUIR"),
});

export async function deleteAccount(
  input: z.infer<typeof deleteAccountSchema>,
): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confirmação inválida." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };
  const uid = auth.user.id;

  // Best-effort storage cleanup. List + remove (paths under {uid}/).
  for (const bucket of ["cvs", "avatars"] as const) {
    const { data: files } = await supabase.storage.from(bucket).list(uid);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${uid}/${f.name}`);
      await supabase.storage.from(bucket).remove(paths);
    }
  }

  // Delete the auth user (cascades profiles, cvs, prep_sessions).
  const admin = createAdminClient();
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) {
    console.error("[deleteAccount] admin.deleteUser error:", delErr.message);
    return { ok: false, error: "Não foi possível excluir a conta. Entre em contato com o suporte." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
