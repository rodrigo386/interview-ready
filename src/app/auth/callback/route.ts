import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  // Prefer the configured public app URL over request.url's origin.
  // Behind Railway's proxy, request.url has the internal 0.0.0.0:8080 host.
  const base = env.NEXT_PUBLIC_APP_URL;
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
