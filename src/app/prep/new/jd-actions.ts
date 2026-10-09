"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";
import { extractJdFromUrl } from "@/lib/jd/extract-from-url";

const urlSchema = z
  .string()
  .trim()
  .url("URL inválida")
  .refine((u) => /^https?:\/\//i.test(u), "URL precisa começar com http(s)://");

export type FetchJdState = {
  error?: string;
  jd?: { text: string; url: string };
};

/**
 * Busca a página de uma vaga e devolve texto limpo (usuário LOGADO).
 *
 * A extração em si (Jina Reader + limpeza com Gemini) vive em
 * `lib/jd/extract-from-url`, compartilhada com a busca do visitante anônimo
 * (`analise-ats-gratis/jd-actions`), que tem limites próprios e mais estritos.
 */
export async function fetchJdFromUrl(
  _prev: FetchJdState,
  formData: FormData,
): Promise<FetchJdState> {
  const rawUrl = String(formData.get("url") ?? "").trim();
  const parsed = urlSchema.safeParse(rawUrl);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "URL inválida.",
    };
  }
  const url = parsed.data;

  // Aqui exige login e rate limit por usuário. A versão anônima existe, mas
  // com limite por IP falhando fechado e disjuntor global: ela proxia URLs
  // arbitrárias pelo Jina e gasta cota do Gemini na limpeza.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: "Faça login para buscar vaga por URL." };
  }
  const rl = await rateLimit(`user:${auth.user.id}`, LIMITS.fetchJd);
  if (!rl.success) {
    return {
      error: `Muitas buscas de URL seguidas. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
    };
  }

  const r = await extractJdFromUrl(url);
  if (!r.ok) return { error: r.error };
  return { jd: { text: r.text, url } };
}
