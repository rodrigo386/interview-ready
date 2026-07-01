"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSlugs } from "@/lib/blog/posts";
import { submitToIndexNow } from "@/lib/seo/indexnow";
import { sendReengagementEmail } from "@/lib/email/reengagement-email";

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

export type IndexNowSubmitResult =
  | { ok: true; submitted: number; status: number }
  | { ok: false; error: string };

const SITE_URL_FOR_INDEXNOW = "https://prepavaga.com.br";

/**
 * Submit all public URLs (landing, /artigos, every article) to IndexNow.
 * Bing/Yandex/Seznam pick up the changes within hours. Use after publishing
 * new articles or whenever indexing seems stuck.
 */
export async function submitIndexNowAction(): Promise<IndexNowSubmitResult> {
  await requireAdmin();
  const slugs = await listSlugs();
  const urls = [
    `${SITE_URL_FOR_INDEXNOW}/`,
    `${SITE_URL_FOR_INDEXNOW}/pricing`,
    `${SITE_URL_FOR_INDEXNOW}/sobre`,
    `${SITE_URL_FOR_INDEXNOW}/artigos`,
    ...slugs.map((s) => `${SITE_URL_FOR_INDEXNOW}/artigos/${s}`),
  ];
  const result = await submitToIndexNow(urls);
  if (!result.ok) {
    return {
      ok: false,
      error: `IndexNow respondeu ${result.status}: ${result.detail ?? "sem detalhe"}`,
    };
  }
  return { ok: true, submitted: result.submitted, status: result.status };
}

export type ReengageResult =
  | { ok: true; sent: number; skipped: number }
  | { ok: false; error: string };

/**
 * One-off re-engagement to dormant free users: free tier, non-admin, account
 * older than 2 days (brand-new signups already got the welcome), no completed
 * prep, and not yet re-engaged. Sends the nudge and stamps
 * reengagement_email_sent_at so repeat clicks don't re-spam. Idempotent.
 */
export async function reengageDormantUsersAction(): Promise<ReengageResult> {
  await requireAdmin();
  const sb = createAdminClient();

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await sb
    .from("profiles")
    .select("id, email, full_name, is_admin, created_at")
    .eq("tier", "free")
    .is("reengagement_email_sent_at", null)
    .lt("created_at", twoDaysAgo);
  if (error) return { ok: false, error: error.message };

  const candidates = (rows ?? []).filter(
    (r): r is { id: string; email: string; full_name: string | null; is_admin: boolean | null; created_at: string } =>
      Boolean(r.email) && !(r as { is_admin?: boolean }).is_admin,
  );
  if (candidates.length === 0) return { ok: true, sent: 0, skipped: 0 };

  // Exclude anyone who already generated a successful prep.
  const { data: completed } = await sb
    .from("prep_sessions")
    .select("user_id")
    .eq("generation_status", "complete")
    .in(
      "user_id",
      candidates.map((c) => c.id),
    );
  const activated = new Set((completed ?? []).map((r) => (r as { user_id: string }).user_id));
  const dormant = candidates.filter((c) => !activated.has(c.id));

  const sentIds: string[] = [];
  for (const u of dormant) {
    const r = await sendReengagementEmail({ to: u.email, name: u.full_name });
    if (r.ok) sentIds.push(u.id);
  }

  if (sentIds.length > 0) {
    await sb
      .from("profiles")
      .update({ reengagement_email_sent_at: new Date().toISOString() })
      .in("id", sentIds);
  }

  revalidatePath("/admin");
  return { ok: true, sent: sentIds.length, skipped: dormant.length - sentIds.length };
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

export type TestTrackingResult =
  | { ok: true; rowId: string }
  | { ok: false; error: string; code?: string };

/**
 * Diagnostic: inserts a synthetic row into page_views via the Node-runtime
 * admin client. Bypasses middleware entirely.
 *
 * - If this succeeds AND middleware still doesn't write → problem is Edge-
 *   runtime (env vars not reaching middleware, or middleware not even firing).
 * - If this fails → problem is in the table (RLS blocking writes, schema
 *   mismatch, service_role key invalid).
 */
export async function testTracking(): Promise<TestTrackingResult> {
  await requireAdmin();
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("page_views")
    .insert({
      visitor_id: `test-${crypto.randomUUID()}`,
      path: "/admin/test-tracking",
      user_agent: "PrepaVaga Admin Test Button",
      is_bot: false,
    })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      error: error.message,
      code: (error as { code?: string }).code,
    };
  }
  revalidatePath("/admin");
  return { ok: true, rowId: (data as { id: string }).id };
}
