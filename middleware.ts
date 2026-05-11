import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const REF_REGEX = /^[A-Z0-9-]{2,40}$/;
const REF_COOKIE = "pv_ref";
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export async function middleware(request: NextRequest) {
  // Affiliate ref capture: if URL has ?ref=CODE matching our format, set
  // cookie and redirect to clean URL (without ref param). Cookie persists 90
  // days; on signup, attribution is read from cookie and the user is linked
  // to the partner. www→apex redirect lives in next.config.ts redirects().
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && REF_REGEX.test(ref)) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("ref");
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(REF_COOKIE, ref, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: REF_COOKIE_MAX_AGE,
      path: "/",
    });
    return res;
  }

  // Page-view tracking moved to a client beacon (see PageViewTracker +
  // /api/track route). Edge middleware on Railway standalone wasn't reliably
  // exposing SUPABASE_SERVICE_ROLE_KEY, breaking direct REST writes. Beacon
  // works on Node runtime where env always works.
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
