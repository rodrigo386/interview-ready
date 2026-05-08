import { NextResponse, type NextRequest } from "next/server";
import { trackPageView } from "@/lib/analytics/page-views";

/**
 * Internal endpoint hit by middleware to log page views. Not a public API —
 * called fire-and-forget; never returns useful data. Always responds 204
 * even on error so the middleware doesn't accidentally retry.
 *
 * Why an endpoint instead of inserting from middleware directly? Edge
 * runtime doesn't have access to the @supabase/supabase-js node-only
 * service role client. Routing through an API route keeps the heavy
 * client in a Node runtime.
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

  // Don't await — fire and forget. The middleware shouldn't block on
  // analytics writes; it should pass through immediately.
  trackPageView({
    visitorId: body.visitorId,
    path: body.path,
    userAgent: req.headers.get("user-agent"),
  }).catch(() => undefined);

  return new NextResponse(null, { status: 204 });
}
