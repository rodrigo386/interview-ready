"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { parseCvFile, ParseError } from "@/lib/files/parse";
import {
  normalizeAnonInput,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from "@/lib/anon-ats/core";
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
  // Dívida conhecida: x-forwarded-for é forjável pelo cliente (o primeiro
  // valor da lista não é verificado). Aceito de propósito — o teto diário
  // (Guarda 2) já limita o custo agregado, e tratar IP de forma diferente
  // só neste endpoint criaria inconsistência com login/signup, que usam o
  // mesmo padrão. Decisão revisada e mantida na rodada de correção 1.
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";

  // Guarda 1: limite por IP, falhando FECHADO. A chave do rate limit usa o
  // hash quando há salt configurado, mas cai pro IP cru se não houver —
  // o Redis do Upstash só guarda isso em memória com TTL (não persiste no
  // nosso banco), então não tem o mesmo problema de reversibilidade que
  // motivou hashIp() a virar opcional. Nunca deixar de aplicar o limite por
  // falta de env seria um furo pior do que o hash fraco que estamos
  // corrigindo.
  const rl = await rateLimit(`anonAts:${hashIp(ip) ?? ip}`, LIMITS.anonAts);
  if (!rl.success) return { error: CONVITE_CADASTRO };

  // Guarda 2: disjuntor global de custo.
  if (isOverDailyCap(await countAnalysesLast24h(), env.ANON_ATS_DAILY_CAP)) {
    return { error: CONVITE_CADASTRO };
  }

  // Guarda 3: tamanho e forma da entrada.
  let cvText = String(formData.get("cvText") ?? "");
  const file = formData.get("cvFile");
  if (file instanceof File && file.size > 0) {
    // Espelha a validação do cliente (AnonAtsForm) — ela é conveniência de
    // UX, não garantia: qualquer POST direto passa por cima dela.
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return {
        error: `Este arquivo tem ${mb} MB e o limite é ${MAX_UPLOAD_LABEL}. Envie um arquivo menor ou cole o texto do currículo.`,
      };
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseCvFile(buffer, file.type);
      cvText = parsed.text;
    } catch (err) {
      // Só reaproveita a mensagem quando é o nosso ParseError (já em
      // PT-BR). Qualquer outro erro (ex.: exceção crua de mammoth/pdf-parse)
      // pode vir em inglês — texto pro usuário é sempre PT-BR neste app.
      return {
        error: err instanceof ParseError ? err.message : "Não conseguimos ler esse arquivo.",
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
    // Sempre "gemini" agora — Cerebras removido em 2026-08-16. A coluna
    // model_used continua existindo (linhas antigas gravaram "cerebras")
    // então este valor literal fica explícito aqui em vez de vir da
    // resposta de analyzeAnonAts, que não carrega mais essa informação.
    modelUsed: "gemini",
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
