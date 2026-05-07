import "server-only";
import { env } from "@/lib/env";

/**
 * Cerebras Cloud Inference — used as a last-resort fallback after the Gemini
 * chain (3.1-flash-lite → 2.5-flash → 2.5-flash-lite) is exhausted by 503s.
 *
 * Free tier OpenAI-compatible REST. Default model: `gpt-oss-120b` (OpenAI
 * open-source 120B params, runs fast on Cerebras LPU). Smaller `llama3.1-8b`
 * is the secondary fallback if 120B itself is overloaded.
 *
 * Quality vs Gemini: comparable for free-form generation, slightly looser on
 * JSON schema adherence — callers should validate with Zod and tolerate
 * extra fields.
 *
 * Returns null when CEREBRAS_API_KEY isn't configured (caller treats that as
 * "no further fallback available, propagate original error").
 */

const CEREBRAS_ENDPOINT = "https://api.cerebras.ai/v1/chat/completions";

// Primary fallback. GPT-OSS 120B is OpenAI's open-source release, hosted on
// Cerebras LPU at ~1500 tok/s. Strong on structured output.
const CEREBRAS_PRIMARY = "gpt-oss-120b";
// Secondary if primary 503s — Qwen 3 235B-A22B is much better at schema
// adherence than Llama 3.1 8B (which we initially used and failed Zod
// validation in prod). Same provider, free tier, similar latency.
const CEREBRAS_SECONDARY = "qwen-3-235b-a22b-instruct-2507";

// Suffix appended to the system prompt when calling Cerebras — Cerebras's
// `response_format: json_object` only guarantees valid JSON, not that the
// JSON matches our Zod schema. Llama / Qwen / GPT-OSS need an explicit
// instruction to stay schema-faithful, otherwise they invent extra fields
// or skip required ones.
const JSON_STRICT_SUFFIX = `

CRITICAL: Respond with ONLY a single valid JSON object matching the schema described above. No prose, no explanation, no markdown code fences. Every required field must be present. Do not invent extra fields not in the schema.`;

export type CerebrasResult =
  | { ok: true; text: string; modelId: string }
  | { ok: false; reason: "no_key" | "all_failed"; detail?: string };

export async function callCerebrasJson(opts: {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  label: string;
}): Promise<CerebrasResult> {
  if (!env.CEREBRAS_API_KEY) {
    return { ok: false, reason: "no_key" };
  }

  const chain = [CEREBRAS_PRIMARY, CEREBRAS_SECONDARY];
  let lastErr = "";

  for (const modelId of chain) {
    const t0 = Date.now();
    console.log(`[cerebras] ${opts.label} starting (${modelId})`);
    try {
      const res = await fetch(CEREBRAS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CEREBRAS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: "system",
              content: opts.systemPrompt + JSON_STRICT_SUFFIX,
            },
            { role: "user", content: opts.userPrompt },
          ],
          temperature: opts.temperature,
          max_completion_tokens: opts.maxTokens,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastErr = `${res.status}: ${body.slice(0, 200)}`;
        console.warn(
          `[cerebras] ${opts.label} ${modelId} HTTP ${res.status}: ${body.slice(0, 200)}`,
        );
        continue;
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text) {
        lastErr = "empty content";
        console.warn(`[cerebras] ${opts.label} ${modelId} returned empty content`);
        continue;
      }
      console.log(
        `[cerebras] ${opts.label} ${modelId} completed in ${Date.now() - t0}ms (${text.length} chars)`,
      );
      return { ok: true, text, modelId };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      console.warn(`[cerebras] ${opts.label} ${modelId} threw: ${lastErr}`);
    }
  }

  return { ok: false, reason: "all_failed", detail: lastErr };
}
