import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Minimal liveness endpoint for uptime monitors. Intentionally no DB ping —
// returning 200 only proves the Node process is up, which is what monitors
// need; deeper readiness checks (Supabase, Asaas, Gemini) belong to a
// separate /api/ready route if/when we add full health-check tooling.
export async function GET() {
  return NextResponse.json(
    { ok: true, ts: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
