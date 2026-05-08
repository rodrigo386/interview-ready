"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { confirmCommissions } from "@/lib/affiliate/commission";
import { payPartner, type PayoutResult } from "@/lib/affiliate/payout";
import {
  sendPartnerApprovedEmail,
  sendPartnerPayoutSentEmail,
  sendPartnerRejectedEmail,
} from "@/lib/email/partner-emails";

export async function approvePartner(partnerId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  const sb = createAdminClient();

  // Load partner + email BEFORE the update so we can email even if revalidate
  // races. Email send is fire-and-forget after the DB write succeeds.
  const { data: partnerRow } = await sb
    .from("affiliate_partners")
    .select("user_id, code, display_name, status")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partnerRow) return { ok: false, error: "Parceiro não encontrado" };
  const partner = partnerRow as {
    user_id: string;
    code: string;
    display_name: string;
    status: string;
  };
  if (partner.status !== "pending") {
    return { ok: false, error: `Parceiro já está com status ${partner.status}` };
  }

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

  // Email — non-blocking
  try {
    const { data: profile } = await sb
      .from("profiles")
      .select("email")
      .eq("id", partner.user_id)
      .maybeSingle();
    const email = (profile as { email?: string } | null)?.email;
    if (email) {
      await sendPartnerApprovedEmail({
        to: email,
        displayName: partner.display_name,
        code: partner.code,
      });
    }
  } catch (err) {
    console.warn("[affiliate] sendPartnerApprovedEmail failed:", err);
  }

  revalidatePath("/admin/affiliates");
  return { ok: true };
}

export async function denyPartner(partnerId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const sb = createAdminClient();

  // Capture user info before delete so we can email them.
  const { data: partnerRow } = await sb
    .from("affiliate_partners")
    .select("user_id, display_name, status")
    .eq("id", partnerId)
    .maybeSingle();

  const { error } = await sb
    .from("affiliate_partners")
    .delete()
    .eq("id", partnerId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  // Email rejected applicant — non-blocking
  if (partnerRow) {
    const partner = partnerRow as { user_id: string; display_name: string };
    try {
      const { data: profile } = await sb
        .from("profiles")
        .select("email")
        .eq("id", partner.user_id)
        .maybeSingle();
      const email = (profile as { email?: string } | null)?.email;
      if (email) {
        await sendPartnerRejectedEmail({
          to: email,
          displayName: partner.display_name,
        });
      }
    } catch (err) {
      console.warn("[affiliate] sendPartnerRejectedEmail failed:", err);
    }
  }

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

export type PayPartnerActionResult =
  | {
      ok: true;
      message: string;
      transferId: string;
      amountCents: number;
      commissionsPaid: number;
      status: string;
    }
  | { ok: false; error: string };

const PAYOUT_REASON_MESSAGES: Record<string, string> = {
  no_pix_key: "Parceiro não cadastrou chave Pix no perfil",
  below_minimum: "Saldo abaixo do mínimo de R$ 100,00",
  ambiguous_pix_key:
    "Chave Pix em formato ambíguo. Peça pra parceiro reformatar (CPF com pontos, telefone com +55, etc.)",
  no_payable: "Sem comissões confirmadas pra pagar",
  partner_inactive: "Parceiro não está ativo",
  asaas_failed: "Asaas rejeitou a transferência",
  db_failed: "Erro ao gravar no banco",
};

/**
 * Trigger an automated Pix payout via Asaas Transfer API for one partner.
 * Server-side validates: admin-only, partner active, payable >= R$100,
 * pix_key present and unambiguous. On success, marks all settled
 * commissions as paid with paid_via=asaas_transfer:<id>.
 */
export async function payPartnerViaPix(
  partnerId: string,
): Promise<PayPartnerActionResult> {
  const admin = await requireAdmin();
  const sb = createAdminClient();

  let result: PayoutResult;
  try {
    result = await payPartner(partnerId, admin.id, sb);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!result.ok) {
    const base = PAYOUT_REASON_MESSAGES[result.reason] ?? result.reason;
    return {
      ok: false,
      error: result.detail ? `${base}: ${result.detail}` : base,
    };
  }

  // Email partner that the Pix was sent — non-blocking
  try {
    const { data: partnerRow } = await sb
      .from("affiliate_partners")
      .select("user_id, display_name")
      .eq("id", partnerId)
      .maybeSingle();
    if (partnerRow) {
      const p = partnerRow as { user_id: string; display_name: string };
      const { data: profile } = await sb
        .from("profiles")
        .select("email, pix_key")
        .eq("id", p.user_id)
        .maybeSingle();
      const prof = profile as { email?: string; pix_key?: string | null } | null;
      if (prof?.email && prof.pix_key) {
        await sendPartnerPayoutSentEmail({
          to: prof.email,
          displayName: p.display_name,
          amountCents: result.amountCents,
          asaasTransferId: result.asaasTransferId,
          pixKey: prof.pix_key,
        });
      }
    }
  } catch (err) {
    console.warn("[affiliate] sendPartnerPayoutSentEmail failed:", err);
  }

  revalidatePath("/admin/affiliates");
  revalidatePath("/admin");
  return {
    ok: true,
    message: `Transferência ${result.asaasTransferId} de R$ ${(result.amountCents / 100).toFixed(2)} enviada (${result.commissionsPaid} comissões marcadas como pagas)`,
    transferId: result.asaasTransferId,
    amountCents: result.amountCents,
    commissionsPaid: result.commissionsPaid,
    status: result.status,
  };
}
