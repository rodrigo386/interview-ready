import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Force www → apex (canonical = no www). Runs before Supabase session
  // logic so the redirect is the cheapest possible response.
  // Check every host source — Railway sometimes leaves x-forwarded-host as
  // the internal hostname while the real public host is in `host` or in the
  // parsed nextUrl.
  const xfHost = request.headers.get("x-forwarded-host") ?? "";
  const rawHost = request.headers.get("host") ?? "";
  const urlHost = request.nextUrl.host ?? "";
  // TEMP DEBUG: remove after www→apex is confirmed working in prod
  if (process.env.DEBUG_HOST === "1") {
    console.log("[middleware:host]", JSON.stringify({ xfHost, rawHost, urlHost, path: request.nextUrl.pathname }));
  }
  const wwwHost = [xfHost, rawHost, urlHost].find((h) => h.startsWith("www."));
  if (wwwHost) {
    const apexHost = wwwHost.slice(4);
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, `${proto}://${apexHost}`);
    return NextResponse.redirect(target, 308);
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - files with an extension (.svg, .png, .jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
