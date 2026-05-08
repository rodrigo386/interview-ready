import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachReferral } from "./attribution";

/**
 * Tests for the self-referral hardening pass:
 * - Hard block on same user_id (existing)
 * - Hard block on same CPF (NEW — was flag)
 * - Hard block on identical email (NEW)
 * - Soft flag on same corporate email domain (NEW behavior; gmail/etc no
 *   longer trigger flag)
 *
 * Uses a hand-rolled mock supabase that returns canned data for the
 * sequential .from(...).select(...).eq(...).maybeSingle()/.single() calls
 * attribution makes. Order matters; see comments inside each test.
 */

type MockResponses = {
  existingReferral?: { partner_id: string } | null;
  partner?: { id: string; user_id: string } | null;
  refereeProfile?: { email: string | null; cpf_cnpj: string | null } | null;
  partnerProfile?: { email: string | null; cpf_cnpj: string | null } | null;
  insertError?: { message: string } | null;
};

function mockSupabase(r: MockResponses): SupabaseClient {
  const calls: Array<{ table: string; selectCol?: string }> = [];
  let nextProfileLookup: "referee" | "partner" = "referee";

  const builder = (table: string) => {
    let selectCol = "";
    const queryState = { table, eqs: [] as string[] };

    const exec = async (mode: "single" | "maybeSingle") => {
      if (table === "affiliate_referrals") {
        return { data: r.existingReferral ?? null, error: null };
      }
      if (table === "affiliate_partners") {
        return { data: r.partner ?? null, error: null };
      }
      if (table === "profiles") {
        const data =
          nextProfileLookup === "referee" ? r.refereeProfile : r.partnerProfile;
        nextProfileLookup =
          nextProfileLookup === "referee" ? "partner" : "referee";
        return { data: data ?? null, error: null };
      }
      void mode;
      return { data: null, error: null };
    };

    const chain = {
      select(col: string) {
        selectCol = col;
        calls.push({ table, selectCol });
        return chain;
      },
      eq(_col: string, _val: unknown) {
        queryState.eqs.push(`${_col}=${String(_val)}`);
        return chain;
      },
      single: () => exec("single"),
      maybeSingle: () => exec("maybeSingle"),
      insert: async (_payload: unknown) => {
        if (r.insertError) {
          return { error: r.insertError };
        }
        return { error: null };
      },
    } as unknown as {
      select: (c: string) => typeof chain;
      eq: (c: string, v: unknown) => typeof chain;
      single: () => Promise<{ data: unknown; error: unknown }>;
      maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      insert: (p: unknown) => Promise<{ error: unknown }>;
    };
    return chain;
  };

  return { from: builder } as unknown as SupabaseClient;
}

describe("attachReferral — self-referral hardening", () => {
  it("blocks when same user uses own code on own account", async () => {
    const sb = mockSupabase({
      partner: { id: "p1", user_id: "u1" },
    });
    const result = await attachReferral("u1", "ANACOACH", sb);
    expect(result).toEqual({ attributed: false, reason: "self_referral" });
  });

  it("blocks when CPF matches between partner and referred user", async () => {
    const sb = mockSupabase({
      partner: { id: "p1", user_id: "u-partner" },
      refereeProfile: { email: "outro@gmail.com", cpf_cnpj: "12345678909" },
      partnerProfile: { email: "ana@gmail.com", cpf_cnpj: "12345678909" },
    });
    const result = await attachReferral("u-referee", "ANACOACH", sb);
    expect(result).toEqual({ attributed: false, reason: "self_referral" });
  });

  it("blocks when CPF matches across formatting differences", async () => {
    const sb = mockSupabase({
      partner: { id: "p1", user_id: "u-partner" },
      refereeProfile: { email: "ref@example.com", cpf_cnpj: "123.456.789-09" },
      partnerProfile: { email: "ana@example.com", cpf_cnpj: "12345678909" },
    });
    const result = await attachReferral("u-referee", "ANACOACH", sb);
    expect(result).toEqual({ attributed: false, reason: "self_referral" });
  });

  it("blocks when emails are identical (case-insensitive)", async () => {
    const sb = mockSupabase({
      partner: { id: "p1", user_id: "u-partner" },
      refereeProfile: { email: "Ana@Example.com", cpf_cnpj: null },
      partnerProfile: { email: "ana@example.com", cpf_cnpj: null },
    });
    const result = await attachReferral("u-referee", "ANACOACH", sb);
    expect(result).toEqual({ attributed: false, reason: "self_referral" });
  });

  it("does NOT flag when both share gmail.com (generic provider)", async () => {
    const sb = mockSupabase({
      partner: { id: "p1", user_id: "u-partner" },
      refereeProfile: { email: "joao@gmail.com", cpf_cnpj: null },
      partnerProfile: { email: "ana@gmail.com", cpf_cnpj: null },
    });
    const result = await attachReferral("u-referee", "ANACOACH", sb);
    expect(result).toMatchObject({
      attributed: true,
      partnerId: "p1",
      flagged: false,
    });
  });

  it("flags (soft) when both share a corporate domain", async () => {
    const sb = mockSupabase({
      partner: { id: "p1", user_id: "u-partner" },
      refereeProfile: { email: "joao@meucanal.com.br", cpf_cnpj: null },
      partnerProfile: { email: "ana@meucanal.com.br", cpf_cnpj: null },
    });
    const result = await attachReferral("u-referee", "ANACOACH", sb);
    expect(result).toMatchObject({
      attributed: true,
      partnerId: "p1",
      flagged: true,
      flagReason: "same_corporate_email_domain",
    });
  });

  it("attributes normally when nothing fishy", async () => {
    const sb = mockSupabase({
      partner: { id: "p1", user_id: "u-partner" },
      refereeProfile: { email: "joao@gmail.com", cpf_cnpj: "11122233344" },
      partnerProfile: { email: "ana@otherdomain.com", cpf_cnpj: "55566677788" },
    });
    const result = await attachReferral("u-referee", "ANACOACH", sb);
    expect(result).toEqual({
      attributed: true,
      partnerId: "p1",
      flagged: false,
      flagReason: undefined,
    });
  });

  it("returns invalid_code for malformed code", async () => {
    const sb = mockSupabase({});
    const result = await attachReferral("u1", "abc def", sb);
    expect(result).toEqual({ attributed: false, reason: "invalid_code" });
  });

  it("returns already_attributed when referral row exists", async () => {
    const sb = mockSupabase({
      existingReferral: { partner_id: "p-existing" },
    });
    const result = await attachReferral("u1", "ANACOACH", sb);
    expect(result).toEqual({ attributed: false, reason: "already_attributed" });
  });

  it("returns code_not_found when partner missing or inactive", async () => {
    const sb = mockSupabase({
      partner: null,
    });
    const result = await attachReferral("u1", "GHOST", sb);
    expect(result).toEqual({ attributed: false, reason: "code_not_found" });
  });
});
