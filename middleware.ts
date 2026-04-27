import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Force www → apex (canonical = no www). Runs before Supabase session
  // logic so the redirect is the cheapest possible response.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const apexHost = host.slice(4);
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
