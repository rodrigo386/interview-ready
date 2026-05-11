import { NextResponse, type NextRequest } from "next/server";
import { trackPageView } from "@/lib/analytics/page-views";

/**
 * Page-view tracking endpoint. Called by the PageViewTracker client component
 * on mount + route change. Always returns 204 — failures are silent so we
 * don't trigger client-side retry/error UI for cosmetic analytics.
 *
 * Why client beacon instead of middleware:
 * - Middleware on Edge runtime (Railway standalone) doesn't reliably expose
 *   SUPABASE_SERVICE_ROLE_KEY at runtime, breaking writes silently.
 * - Forcing `runtime: 'nodejs'` in middleware config is gated behind an
 *   experimental flag in Next 15.5 whose typings aren't stable yet.
 * - Beacon side-steps both: this Node-runtime API route has full env access,
 *   the client component handles cookie + pathname + fetch.
 * - Trade-off: doesn't track JS-disabled browsers / curl / non-JS bots.
 *   We were filtering bots out anyway, so this loses nothing useful.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { visitorId?: string; path?: string } | null = null;
  try {
    body = (await req.json()) as { visitorId?: string; path?: string };
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  if (!body?.visitorId || !body?.path) {
    return new NextResponse(null, { status: 204 });
  }

  // Fire-and-forget — we don't want the client to wait, and a failed insert
  // shouldn't break navigation. Errors are logged inside trackPageView.
  trackPageView({
    visitorId: body.visitorId,
    path: body.path,
    userAgent: req.headers.get("user-agent"),
  }).catch(() => undefined);

  return new NextResponse(null, { status: 204 });
}
