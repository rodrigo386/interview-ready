"use server";

import { z } from "zod";

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
  const text = raw
    .replace(/^Title:.*\nURL Source:.*\n(Markdown Content:.*?\n)?/im, "")
    .trim();

  if (text.length < MIN_TEXT_CHARS) {
    return {
      error:
        "A página não tem texto suficiente para gerar um prep. Cole o texto da vaga em vez disso.",
    };
  }

  return {
    jd: {
      text: text.slice(0, MAX_TEXT_CHARS),
      url,
    },
  };
}
