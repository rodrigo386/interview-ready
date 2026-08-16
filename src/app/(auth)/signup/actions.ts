"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";
import { attachReferral } from "@/lib/affiliate/attribution";
import { deriveNameFromEmail } from "@/lib/auth/derive-name";
import { claimAnonAnalysis } from "@/lib/anon-ats/claim";
import { ANON_COOKIE } from "@/lib/anon-ats/repo";
import { trackServer } from "@/lib/analytics/server";

// Experiment PRE-14 (signup friction reduction, second pass): only email +
// password. Full name is derived from the email local-part with light cleanup
// (humps split, capitalized). User can override later in /profile. PRE-4 had
// removed CPF/endereço; this removes the last optional-feeling field. Every
// removed field bumps signup completion ~10-15%.
const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
});


export type SignupState = {
  error?: string;
  pendingConfirmation?: boolean;
};

function mapSupabaseError(message: string): string {
  // Note: we deliberately do NOT branch on "already registered" here.
  // Returning that message reveals account existence (enumeration vector).
  // Supabase's signUp returns success+pendingConfirmation for already-
  // registered emails when "Confirm email" is on, which is what we want.
  if (/confirmation email/i.test(message)) {
    return "Cadastro feito, mas o envio do e-mail de confirmação falhou. Entre em contato com o suporte.";
  }
  return "Não conseguimos criar sua conta. Tente novamente.";
}

export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const fullName = deriveNameFromEmail(parsed.data.email);

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "anon";
  const rl = await rateLimit(`signup:${ip}`, LIMITS.authSignup);
  if (!rl.success) {
    return {
      error: `Muitos cadastros deste IP. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      // Log only message + status code, never the full error object — it
      // contains the email payload and other PII that ends up in Railway logs.
      console.error("[signup] supabase signUp error:", error.message, error.status);
      return { error: mapSupabaseError(error.message) };
    }

    // CPF + endereço NÃO são mais coletados no signup (experimento PRE-4 de
    // redução de fricção). O profile row é criada pelo trigger de auth.users
    // com esses campos nulos; /api/billing/checkout os coleta sob demanda no
    // primeiro checkout via os diálogos cpf_required / address_required.
    if (data.user) {
      const admin = createAdminClient();

      // Affiliate attribution: same pattern as auth/callback. If user has pv_ref
      // cookie, link to partner. Idempotent. Failure tolerated.
      const cookieStore = await cookies();
      const refCode = cookieStore.get("pv_ref")?.value;
      if (refCode) {
        try {
          await attachReferral(data.user.id, refCode, admin);
        } catch (err) {
          console.warn("[signup] attribution failed:", err);
        }
        cookieStore.delete("pv_ref");
      }

      // Reivindicação da análise ATS anônima: acontece aqui, no envio do
      // cadastro, e não em /auth/confirm. O confirm roda de propósito em
      // outro navegador (fricção anti-bot dos links de e-mail), então o
      // cookie do token anônimo não existiria lá. Como "Confirm email" está
      // ON em produção, `data.session` normalmente é null e a função retorna
      // mais abaixo antes de chegar no redirect — por isso a reivindicação
      // precisa ficar aqui dentro, não logo antes do redirect final.
      // Idempotente e nunca pode quebrar o cadastro: bônus, não requisito.
      //
      // GUARD DE SEGURANÇA — não remover: com "Confirm email" ligado, o
      // Supabase devolve `data.user` PREENCHIDO também quando o e-mail já
      // pertence a outra conta (é a proteção anti-enumeração dele — sem
      // isso, tentar cadastrar um e-mail existente revelaria a existência da
      // conta pela resposta). O sinal documentado desse caso é
      // `data.user.identities` vir como array VAZIO (cadastro genuinamente
      // novo tem 1+ identity). Sem este guard, um visitante anônimo poderia:
      // rodar a análise ATS anônima (ganhando o cookie do token), depois
      // submeter o cadastro com o e-mail de OUTRA pessoa já registrada, e a
      // reivindicação gravaria uma prep_session com o currículo dele DENTRO
      // DA CONTA DA VÍTIMA. Se `identities` vier `undefined` (SDK/versão
      // diferente do documentado), tratamos como "não sei" e NÃO
      // reivindicamos — falhar fechado aqui é o certo: o custo de não
      // migrar uma análise é pequeno perto do de escrever na conta alheia.
      const isNewSignup =
        Array.isArray(data.user.identities) && data.user.identities.length > 0;
      const anonToken = cookieStore.get(ANON_COOKIE)?.value;
      if (anonToken && isNewSignup) {
        try {
          const prepId = await claimAnonAnalysis(anonToken, data.user.id);
          // Cookie apagado só quando a prep de fato nasceu — mesmo critério
          // do `pv_ref` logo acima. Sem isso o cookie sobrevivia os 7 dias
          // inteiros e quem voltasse em /analise-ats-gratis/resultado já
          // cadastrado veria de novo o teaser com cadeado mandando criar
          // conta. Falha transitória mantém o cookie (a análise ainda pode
          // ser reivindicada depois).
          if (prepId) {
            cookieStore.delete(ANON_COOKIE);
            await trackServer(data.user.id, "anon_ats_claimed", {
              method: "email",
            });
          }
        } catch (err) {
          console.warn("[signup] claim anon ats falhou:", err);
        }
      }
    }

    // If email confirmation is required, Supabase returns user but no session.
    if (!data.session) {
      return { pendingConfirmation: true };
    }
  } catch (err) {
    // redirect() throws NEXT_REDIRECT which Next handles — let it propagate.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof err.digest === "string" &&
      err.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    console.error("[signup] unexpected error:", err);
    return { error: "Erro inesperado. Tente novamente em alguns instantes." };
  }

  redirect("/dashboard");
}
