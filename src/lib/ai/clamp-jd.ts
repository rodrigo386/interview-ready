/**
 * Cap a job description before it goes into an AI prompt.
 *
 * Real JDs run ~1.5–6 KB. Occasionally one is pasted (or fetched from a URL)
 * with page boilerplate — nav, cookie banners, "vagas relacionadas" — and
 * balloons past 30 KB. The section pipeline injects the JD into 5 sequential
 * Gemini calls, so a 35 KB JD becomes ~175 KB of repeated input and, on the
 * Gemini free tier, trips the per-minute token limit → the whole prep fails
 * with 429 (RESOURCE_EXHAUSTED).
 *
 * We keep the full JD in the DB (for display in the JobCard) and clamp only
 * the copy sent to the model. The signal that matters — title, requirements,
 * responsibilities — sits well within the cap; the boilerplate that gets cut
 * is exactly what we don't want the model spending tokens on.
 */
export const MAX_JD_CHARS = 12_000;

const TRUNCATION_MARKER =
  "\n\n[…descrição truncada para análise — o conteúdo relevante da vaga está acima…]";

export function clampJobDescription(
  jd: string | null | undefined,
  max: number = MAX_JD_CHARS,
): string {
  if (!jd) return "";
  if (jd.length <= max) return jd;
  return jd.slice(0, max).trimEnd() + TRUNCATION_MARKER;
}
