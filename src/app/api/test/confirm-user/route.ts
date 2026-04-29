import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Test-only endpoint: confirms a Supabase user's email programmatically so
// E2E tests don't need a real inbox. Hard-gated by E2E_BYPASS_SECRET — when
// the env var is unset (production default), the endpoint always returns 404
// and behaves as if it doesn't exist. The secret is compared with timingSafeEqual.
//
// Use only against staging Supabase projects. Never set E2E_BYPASS_SECRET
// in the production Railway environment.

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  const expected = process.env.E2E_BYPASS_SECRET;
  if (!expected) {
    // Endpoint disabled. Indistinguishable from a non-existent route.
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

  // Defense-in-depth: only allow @example.com test emails through this path.
  // Even if E2E_BYPASS_SECRET leaks, an attacker can't confirm arbitrary user
  // emails — only synthesized e2e-* addresses.
  if (!/^e2e-[a-z0-9-]+@example\.com$/i.test(email)) {
    return NextResponse.json(
      { error: "only e2e-*@example.com emails allowed" },
      { status: 422 },
    );
  }

  const admin = createAdminClient();

  // Find user by email via the admin listUsers — Supabase Admin API doesn't
  // expose a direct "get by email" method, but listUsers paginates so we
  // pull the first page and scan. Test users are recent so they're on page 1.
  const { data, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: "list failed" }, { status: 500 });
  }
  const user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });
  if (updErr) {
    return NextResponse.json({ error: "confirm failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: user.id });
}
