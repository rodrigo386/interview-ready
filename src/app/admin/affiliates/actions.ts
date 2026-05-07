"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { confirmCommissions } from "@/lib/affiliate/commission";

export async function approvePartner(partnerId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  const sb = createAdminClient();
  const { error } = await sb
    .from("affiliate_partners")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: admin.id,
    })
    .eq("id", partnerId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/affiliates");
  return { ok: true };
}

export async function denyPartner(partnerId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const sb = createAdminClient();
  const { error } = await sb
    .from("affiliate_partners")
    .delete()
    .eq("id", partnerId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/affiliates");
  return { ok: true };
}

export async function suspendPartner(partnerId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const sb = createAdminClient();
  const { error } = await sb
    .from("affiliate_partners")
    .update({ status: "suspended" })
    .eq("id", partnerId)
    .eq("status", "active");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/affiliates");
  return { ok: true };
}

export async function markAllPayablePaid(
  partnerId: string,
  paidVia: string,
): Promise<{ ok: boolean; error?: string; updated?: number }> {
  await requireAdmin();
  if (!paidVia.trim()) return { ok: false, error: "paid_via obrigatório" };
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("affiliate_commissions")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_via: paidVia,
    })
    .eq("partner_id", partnerId)
    .eq("status", "confirmed")
    .is("paid_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/affiliates");
  return { ok: true, updated: data?.length ?? 0 };
}

export async function refreshConfirmations(): Promise<{ confirmed: number }> {
  await requireAdmin();
  const sb = createAdminClient();
  return confirmCommissions(sb);
}
