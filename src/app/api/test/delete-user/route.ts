import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Test-only endpoint: deletes a Supabase user (and cascades through profile,
// preps, cvs, payments via FK) so E2E tests can clean up after themselves.
// Hard-gated by E2E_BYPASS_SECRET — when unset (production default), returns
// 404 and behaves as if it doesn't exist. Defense in depth: even with the
// secret, only e2e-*@example.com emails are deletable.
//
// This endpoint MUST never accept a non-e2e email — even with a leaked secret,
// an attacker can't delete real users.

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  const expected = process.env.E2E_BYPASS_SECRET;
  if (!expected) {
    return new NextResponse(null, { status: 404 });
  }

  const provided = req.headers.get("x-e2e-secret") ?? "";
  if (!constantTimeEquals(provided, expected)) {
    return new NextResponse(null, { status: 404 });
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  if (!/^e2e-[a-z0-9-]+@example\.com$/i.test(email)) {
    return NextResponse.json(
      { error: "only e2e-*@example.com emails allowed" },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  const { data, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: "list failed" }, { status: 500 });
  }
  const user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    // Already gone (or never existed) — idempotent success.
    return NextResponse.json({ ok: true, alreadyAbsent: true });
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    return NextResponse.json(
      { error: `delete failed: ${delErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, userId: user.id });
}
