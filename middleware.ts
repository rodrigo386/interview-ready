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

  // Page-view analytics: ensure a visitor cookie exists, then write a row
  // directly to Supabase via REST (Edge-compatible, no node client needed).
  // Awaited with a short timeout so the request actually goes out — Edge
  // middleware kills fire-and-forget work after the response is sent.
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

    await trackPageViewFromMiddleware({
      visitorId,
      path: pathname,
      userAgent: request.headers.get("user-agent"),
    });
  }

  return response;
}

const BOT_RE =
  /bot|crawl|spider|scrape|headless|lighthouse|pingdom|uptimerobot|facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|discordbot|telegrambot/i;

async function trackPageViewFromMiddleware(opts: {
  visitorId: string;
  path: string;
  userAgent: string | null;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  // 2s budget — if Supabase is slow, drop the row rather than block the page.
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 2000);
  try {
    const res = await fetch(`${url}/rest/v1/page_views`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        visitor_id: opts.visitorId,
        path: opts.path,
        user_agent: opts.userAgent?.slice(0, 500) ?? null,
        is_bot: !opts.userAgent || BOT_RE.test(opts.userAgent),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[analytics] page_views insert failed (${res.status}): ${body.slice(0, 200)}`);
    }
  } catch (err) {
    if ((err as { name?: string }).name !== "AbortError") {
      console.warn("[analytics] page_views fetch error:", err);
    }
  } finally {
    clearTimeout(timeout);
  }
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
