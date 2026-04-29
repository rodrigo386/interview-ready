import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveOrigin } from "@/lib/http/host";

export async function GET(request: NextRequest) {
  const base = resolveOrigin(request);
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
