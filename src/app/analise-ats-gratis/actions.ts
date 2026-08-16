"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { parseCvFile } from "@/lib/files/parse";
import { normalizeAnonInput } from "@/lib/anon-ats/core";
import { analyzeAnonAts } from "@/lib/anon-ats/analyze";
import {
  ANON_COOKIE,
  countAnalysesLast24h,
  hashIp,
  insertAnonAnalysis,
  isOverDailyCap,
  newToken,
} from "@/lib/anon-ats/repo";

const CONVITE_CADASTRO =
  "Muitas análises gratuitas agora. Crie sua conta grátis pra continuar sem espera.";

export async function runAnonAtsAnalysis(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";

  // Guarda 1: limite por IP, falhando FECHADO.
  const rl = await rateLimit(`anonAts:${hashIp(ip)}`, LIMITS.anonAts);
  if (!rl.success) return { error: CONVITE_CADASTRO };

  // Guarda 2: disjuntor global de custo.
  if (isOverDailyCap(await countAnalysesLast24h(), env.ANON_ATS_DAILY_CAP)) {
    return { error: CONVITE_CADASTRO };
  }

  // Guarda 3: tamanho e forma da entrada.
  let cvText = String(formData.get("cvText") ?? "");
  const file = formData.get("cvFile");
  if (file instanceof File && file.size > 0) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseCvFile(buffer, file.type);
      cvText = parsed.text;
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Não conseguimos ler esse arquivo.",
      };
    }
  }

  const normalized = normalizeAnonInput({
    cvText,
    jobDescription: String(formData.get("jobDescription") ?? ""),
  });
  if (!normalized.ok) return { error: normalized.error };

  const result = await analyzeAnonAts(normalized.value);
  if (!result.ok) return { error: result.error };

  const token = newToken();
  const saved = await insertAnonAnalysis({
    token,
    cvText: normalized.value.cvText,
    jobDescription: normalized.value.jobDescription,
    jobTitle: normalized.value.jobTitle,
    companyName: normalized.value.companyName,
    analysis: result.analysis,
    modelUsed: result.modelUsed,
    ipHash: hashIp(ip),
  });
  if (!saved) {
    return { error: "Não conseguimos guardar sua análise. Tente de novo." };
  }

  // HttpOnly: o token dá acesso ao texto do CV e nunca pode ir pra URL.
  (await cookies()).set(ANON_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  redirect("/analise-ats-gratis/resultado");
}
