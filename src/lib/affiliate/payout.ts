import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { asaas } from "@/lib/billing/asaas";
import type { AsaasPixKeyType, AsaasTransfer } from "@/lib/billing/types";

/**
 * Minimum payable balance required to trigger an automated Pix payout.
 * R$ 100,00 = 10000 cents. Below this, the partner sees the balance but
 * the "Pagar via Pix" button is disabled. Reasons:
 * - Asaas Transfer fee (~R$1,99) eats too much of small payouts
 * - Reduces operational noise (10 payouts of R$5 vs 1 of R$50)
 * - Keeps total Asaas balance reserve modest
 */
export const MIN_PAYOUT_CENTS = 10000;

const CPF_DIGITS = /^\d{11}$/;
const CNPJ_DIGITS = /^\d{14}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^\+?55\d{10,11}$|^\d{10,11}$/;

/**
 * Detect Asaas Pix key type from the raw key string. Returns null if
 * ambiguous — caller should ask partner to use an unambiguous format
 * (e.g. CPF/CNPJ with formatting marks, or +55 prefix for phone).
 *
 * Heuristics:
 * - "@" anywhere → EMAIL
 * - Matches UUID v4 → EVP (random key)
 * - Starts with "+55" or pure digits looks like phone (10-11 digits) → PHONE
 * - 11 digits → CPF (most common Pix key, default for ambiguity)
 * - 14 digits → CNPJ
 */
export function detectPixKeyType(rawKey: string): AsaasPixKeyType | null {
  const trimmed = rawKey.trim();
  if (trimmed.includes("@")) return "EMAIL";
  if (UUID_RE.test(trimmed)) return "EVP";

  // Strip everything that isn't a digit or +
  const digitsOnly = trimmed.replace(/[^\d+]/g, "");
  if (digitsOnly.startsWith("+55")) return "PHONE";

  const justDigits = digitsOnly.replace(/\+/g, "");
  if (CPF_DIGITS.test(justDigits)) return "CPF";
  if (CNPJ_DIGITS.test(justDigits)) return "CNPJ";
  if (PHONE_RE.test(digitsOnly)) return "PHONE";
  return null;
}

export type PayoutResult =
  | {
      ok: true;
      payoutId: string;
      asaasTransferId: string;
      amountCents: number;
      commissionsPaid: number;
      status: string;
    }
  | {
      ok: false;
      reason:
        | "no_pix_key"
        | "below_minimum"
        | "ambiguous_pix_key"
        | "no_payable"
        | "partner_inactive"
        | "asaas_failed"
        | "db_failed";
      detail?: string;
    };

/**
 * Execute a payout for one partner:
 * 1. Sum confirmed-unpaid commissions
 * 2. Validate threshold + pix key
 * 3. Insert a payout row (pending) — gives us a UUID we use as audit anchor
 * 4. Call Asaas Transfer API
 * 5. Update payout row with result + flip commissions to paid
 *
 * The DB write order is intentional: payout row goes in BEFORE the Asaas
 * call so even if the network drops, we have a record + admin can resolve.
 *
 * Caller must ensure the supabase client has service_role privileges
 * (admin client) — this function won't work via the user RLS policies.
 */
export async function payPartner(
  partnerId: string,
  triggeredBy: string,
  sb: SupabaseClient,
): Promise<PayoutResult> {
  // 1. Load partner + pix key + payable
  const { data: partner } = await sb
    .from("affiliate_partners")
    .select("id, status, user_id, display_name")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) return { ok: false, reason: "partner_inactive", detail: "partner not found" };
  const p = partner as { id: string; status: string; user_id: string; display_name: string };
  if (p.status !== "active") return { ok: false, reason: "partner_inactive" };

  const { data: profile } = await sb
    .from("profiles")
    .select("pix_key")
    .eq("id", p.user_id)
    .maybeSingle();
  const pixKey = (profile as { pix_key?: string | null } | null)?.pix_key ?? null;
  if (!pixKey) return { ok: false, reason: "no_pix_key" };

  const pixKeyType = detectPixKeyType(pixKey);
  if (!pixKeyType) {
    return {
      ok: false,
      reason: "ambiguous_pix_key",
      detail: "Use formato com marcação (CPF com pontos, telefone com +55, etc.)",
    };
  }

  const { data: confirmed } = await sb
    .from("affiliate_commissions")
    .select("id, amount_cents")
    .eq("partner_id", partnerId)
    .eq("status", "confirmed")
    .is("paid_at", null);
  const rows = (confirmed ?? []) as Array<{ id: string; amount_cents: number }>;
  if (rows.length === 0) return { ok: false, reason: "no_payable" };

  const totalCents = rows.reduce((acc, r) => acc + r.amount_cents, 0);
  if (totalCents < MIN_PAYOUT_CENTS) {
    return {
      ok: false,
      reason: "below_minimum",
      detail: `R$${(totalCents / 100).toFixed(2)} < mínimo R$${(MIN_PAYOUT_CENTS / 100).toFixed(2)}`,
    };
  }

  // 2. Insert payout row (pending) — exists even if Asaas fails
  const { data: payoutRow, error: insErr } = await sb
    .from("affiliate_payouts")
    .insert({
      partner_id: partnerId,
      amount_cents: totalCents,
      pix_key: pixKey,
      pix_key_type: pixKeyType,
      status: "pending",
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();
  if (insErr || !payoutRow) {
    return {
      ok: false,
      reason: "db_failed",
      detail: insErr?.message ?? "failed to insert payout row",
    };
  }
  const payoutId = (payoutRow as { id: string }).id;

  // 3. Call Asaas Transfer
  let transfer: AsaasTransfer;
  try {
    transfer = await asaas.createTransfer({
      value: totalCents / 100,
      operationType: "PIX",
      pixAddressKey: pixKey,
      pixAddressKeyType: pixKeyType,
      description: `Comissão PrepaVAGA - ${p.display_name} - ${rows.length} venda(s)`,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await sb
      .from("affiliate_payouts")
      .update({
        status: "failed",
        error_message: detail.slice(0, 500),
        completed_at: new Date().toISOString(),
      })
      .eq("id", payoutId);
    return { ok: false, reason: "asaas_failed", detail };
  }

  // 4. Update payout + commissions atomically (best effort — no real txn
  //    available via REST). Order matters: commissions first so that even
  //    if the payout-row update fails, money is still tracked as paid.
  const nowIso = new Date().toISOString();
  const transferStatus = mapAsaasStatus(transfer.status);
  const paidVia = `asaas_transfer:${transfer.id}`;

  const { error: commErr, data: updatedComms } = await sb
    .from("affiliate_commissions")
    .update({ status: "paid", paid_at: nowIso, paid_via: paidVia })
    .in(
      "id",
      rows.map((r) => r.id),
    )
    .select("id");
  if (commErr) {
    // Money already left Asaas. Mark payout as done but flag the error.
    await sb
      .from("affiliate_payouts")
      .update({
        asaas_transfer_id: transfer.id,
        status: transferStatus,
        asaas_response: transfer as unknown as Record<string, unknown>,
        error_message: `transfer enviada mas falhou ao marcar commissions: ${commErr.message}`.slice(
          0,
          500,
        ),
        completed_at: nowIso,
      })
      .eq("id", payoutId);
    return {
      ok: false,
      reason: "db_failed",
      detail: `transferência ${transfer.id} enviada mas commission update falhou: ${commErr.message}`,
    };
  }

  await sb
    .from("affiliate_payouts")
    .update({
      asaas_transfer_id: transfer.id,
      status: transferStatus,
      asaas_response: transfer as unknown as Record<string, unknown>,
      completed_at: transferStatus === "done" ? nowIso : null,
    })
    .eq("id", payoutId);

  return {
    ok: true,
    payoutId,
    asaasTransferId: transfer.id,
    amountCents: totalCents,
    commissionsPaid: updatedComms?.length ?? rows.length,
    status: transferStatus,
  };
}

function mapAsaasStatus(s: string): "pending" | "processing" | "done" | "failed" | "cancelled" {
  switch (s) {
    case "DONE":
      return "done";
    case "BANK_PROCESSING":
      return "processing";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "pending";
  }
}
