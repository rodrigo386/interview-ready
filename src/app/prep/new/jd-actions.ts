"use server";

import { z } from "zod";
import { cleanJobDescription } from "@/lib/ai/gemini";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";

const urlSchema = z
  .string()
  .trim()
  .url("URL inválida")
  .refine((u) => /^https?:\/\//i.test(u), "URL precisa começar com http(s)://");

export type FetchJdState = {
  error?: string;
  jd?: { text: string; url: string };
};

const MAX_TEXT_CHARS = 50_000;
const MIN_TEXT_CHARS = 200;
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Fetch a job description page and return clean text. Uses Jina Reader
 * (https://r.jina.ai) — a free service that handles JS-rendered pages and
 * returns markdown. No API key required. Falls back to user-friendly errors
 * for paywalls / login walls / unsupported sites; user can always paste text.
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

  // Require auth — this server action proxies arbitrary URLs through Jina
  // and burns Gemini quota on cleanup. Anonymous use was an open abuse vector.
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

  let res: Response;
  try {
    res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/plain",
        "User-Agent": "PrepaVAGA/1.0",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[fetchJdFromUrl] network error:", err);
    return {
      error:
        "Não consegui acessar essa página (timeout ou rede). Cole o texto da vaga em vez disso.",
    };
  }

  if (!res.ok) {
    return {
      error: `Não consegui ler essa página (HTTP ${res.status}). Pode ser uma página com login. Cole o texto da vaga em vez disso.`,
    };
  }

  const raw = (await res.text()).trim();
  // Jina Reader returns markdown with a small header; strip front matter.
  const stripped = raw
    .replace(/^Title:.*\nURL Source:.*\n(Markdown Content:.*?\n)?/im, "")
    .trim();

  if (stripped.length < MIN_TEXT_CHARS) {
    return {
      error:
        "A página não tem texto suficiente para gerar um prep. Cole o texto da vaga em vez disso.",
    };
  }

  // Best-effort AI cleanup: strip cookie banners, navigation, legal footer.
  // Failures fall back to the raw text inside cleanJobDescription itself.
  const cleaned = await cleanJobDescription(stripped);

  if (cleaned.length < MIN_TEXT_CHARS) {
    return {
      error:
        "Depois de limpar a página, sobrou pouco conteúdo. Cole o texto da vaga em vez disso.",
    };
  }

  return {
    jd: {
      text: cleaned.slice(0, MAX_TEXT_CHARS),
      url,
    },
  };
}
