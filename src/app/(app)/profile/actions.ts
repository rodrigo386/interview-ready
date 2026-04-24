"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  preferred_language: z.enum(["en", "pt-br", "es"]).optional(),
});

const updateAvatarPathSchema = z.object({
  ext: z.enum(["jpg", "png", "webp"]),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

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
  if (error) return { ok: false, error: error.message };

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
  if (error) return { ok: false, error: error.message };

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
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
