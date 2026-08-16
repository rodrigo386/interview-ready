import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrigin } from "@/lib/http/host";
import { attachReferral } from "@/lib/affiliate/attribution";
import { claimAnonAnalysis } from "@/lib/anon-ats/claim";
import { ANON_COOKIE } from "@/lib/anon-ats/repo";

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

    // Reivindicação da análise ATS anônima — mesmo bônus que o cadastro por
    // e-mail dá em `(auth)/signup/actions.ts`. Sem isto, quem escolhe
    // "Entrar com o Google" (peso visual igual no /signup) perde a análise
    // que acabou de fazer, contra a promessa explícita do `LockedFix`
    // ("Sua análise já fica salva — você não precisa colar nada de novo").
    //
    // Diferente do signup por e-mail, aqui NÃO é preciso o guard de
    // `identities` vazio: o OAuth só chega neste ponto com a sessão já
    // trocada por um code válido, então `userId` é sempre o dono real da
    // conta — não existe o caso anti-enumeração do `signUp`.
    //
    // Idempotente (claimAnonAnalysis devolve null se a linha já foi
    // reivindicada) e envolvida em try/catch: falha de reivindicação nunca
    // pode quebrar o login.
    const anonToken = cookieStore.get(ANON_COOKIE)?.value;
    if (anonToken) {
      try {
        const prepId = await claimAnonAnalysis(anonToken, userId);
        // Só apaga o cookie quando a prep realmente nasceu. Falha
        // transitória mantém o cookie e o usuário pode tentar de novo pelo
        // resultado; sucesso apaga pra que /analise-ats-gratis/resultado
        // não volte a mostrar o teaser com cadeado por mais 7 dias.
        if (prepId) cookieStore.delete(ANON_COOKIE);
      } catch (err) {
        console.warn("[auth/callback] claim anon ats falhou:", err);
      }
    }
  }

  return NextResponse.redirect(`${base}/dashboard`);
}
