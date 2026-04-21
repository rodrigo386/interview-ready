import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

function resolveBase(request: NextRequest): string {
  // Prefer the configured public URL; behind Railway request.url shows
  // the internal 0.0.0.0:8080. Fall back to x-forwarded-host if unset.
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const base = resolveBase(request);
  const searchParams = new URL(request.url).searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=oauth_failed`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchange error:", error);
      return NextResponse.redirect(`${base}/login?error=oauth_failed`);
    }
  } catch (err) {
    console.error("[auth/callback] unexpected error:", err);
    return NextResponse.redirect(`${base}/login?error=oauth_failed`);
  }

  return NextResponse.redirect(`${base}/dashboard`);
}
