import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const REF_REGEX = /^[A-Z0-9-]{2,40}$/;
const REF_COOKIE = "pv_ref";
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

const VISITOR_COOKIE = "pv_vid";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Paths the analytics shouldn't track. Static + auth callbacks + the track
// endpoint itself.
const TRACK_SKIP_PREFIXES = [
  "/api/",
  "/_next/",
  "/auth/",
  "/favicon",
  "/icon.svg",
  "/opengraph-image",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
];

function shouldTrack(pathname: string): boolean {
  if (pathname.includes(".")) return false; // .png, .ico, etc.
  return !TRACK_SKIP_PREFIXES.some((p) => pathname.startsWith(p));
}

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

  const response = await updateSession(request);

  // Page-view analytics: ensure a visitor cookie exists, then fire-and-forget
  // POST to /api/track. Skipped for static / api / auth paths.
  const { pathname } = request.nextUrl;
  if (shouldTrack(pathname)) {
    let visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: VISITOR_COOKIE_MAX_AGE,
        path: "/",
      });
    }

    // Fire-and-forget — don't await. Failures are silently tolerated. The
    // /api/track route runs in Node runtime and inserts via service-role
    // client; middleware itself stays in Edge.
    const origin = request.nextUrl.origin;
    fetch(`${origin}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, path: pathname }),
    }).catch(() => undefined);
  }

  return response;
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
