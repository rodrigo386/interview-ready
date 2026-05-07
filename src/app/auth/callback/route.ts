import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrigin } from "@/lib/http/host";
import { attachReferral } from "@/lib/affiliate/attribution";

export async function GET(request: NextRequest) {
  const base = resolveOrigin(request);
  const searchParams = new URL(request.url).searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=oauth_failed`);
  }

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchange error:", error);
      return NextResponse.redirect(`${base}/login?error=oauth_failed`);
    }

    userId = data.user?.id ?? null;
  } catch (err) {
    console.error("[auth/callback] unexpected error:", err);
    return NextResponse.redirect(`${base}/login?error=oauth_failed`);
  }

  // Affiliate attribution: if pv_ref cookie is set, link the new user to the
  // partner who referred them. Idempotent (attachReferral checks for
  // already_attributed). Failures are tolerated — never block signup.
  if (userId) {
    const cookieStore = await cookies();
    const refCode = cookieStore.get("pv_ref")?.value;
    if (refCode) {
      try {
        const admin = createAdminClient();
        await attachReferral(userId, refCode, admin);
      } catch (err) {
        console.warn("[auth/callback] attribution failed:", err);
      }
      cookieStore.delete("pv_ref");
    }
  }

  return NextResponse.redirect(`${base}/dashboard`);
}
