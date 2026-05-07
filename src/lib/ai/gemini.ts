import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { env } from "@/lib/env";
import {
  prepSectionSchema,
  atsAnalysisSchema,
  companyIntelSchema,
  cvRewriteSchema,
  type PrepSection,
  type AtsAnalysis,
  type CompanyIntel,
  type CvRewrite,
} from "@/lib/ai/schemas";
import { type SectionKind } from "@/lib/ai/prompts/section-generator";
import { callCerebrasJson } from "@/lib/ai/cerebras";
import type { ZodSchema } from "zod";

// Primary model for structured-output tasks (sections, ATS, CV rewrite).
// `gemini-3.1-flash-lite` went GA on 2026-05-07. Same pricing as the
// previous `-preview` version we used ($0.25/$1.50 per 1M), but GA models
// get dedicated capacity separate from the preview pool — historically
// where the chronic 503 "high demand" surges concentrate. `-preview`
// sunsets on 2026-05-25, so the migration was mandatory either way.
const MODEL_ID = "gemini-3.1-flash-lite";

// Fallback chain: when the primary `gemini-3.1-flash-lite` returns transient
// failures (503/429/UNAVAILABLE) AFTER 3 retries with backoff, we try each
// fallback once. If all fail, propagates to Cerebras (last resort).
//
// Order (per user request 2026-05-07): escalate to bigger/smarter models
// in the same Gemini family, hoping their separate capacity pools have
// headroom even when 3.1-flash-lite is surging.
// - `gemini-3-flash-preview`: bigger flash sibling. Production confirmed
//   bare ID `gemini-3-flash` returns 404 — must include `-preview` suffix.
//   Supports responseSchema + googleSearch. ~6x output cost ($0.50/$3.00
//   per 1M) — only fires on primary failure so impact is low.
// - `gemini-3.1-pro-preview`: reasoning-heavy, slowest + most expensive,
//   last Gemini-family attempt before Cerebras takes over.
const FALLBACK_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
] as const;

// Note: company intel call uses MODEL_ID + the fallback chain via
// callGeminiWithRetry — no separate constant. Gemini 3 supports
// `responseSchema` AND `googleSearch` together (changed from 2.5), so a
// future cleanup can simplify the lenient JSON parser in `extractJsonObjects()`.

/** JSON Schema mirror of prepSectionSchema for Gemini responseSchema. */
const sectionResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  required: ["id", "title", "icon", "summary", "cards"],
  properties: {
    id: { type: SchemaType.STRING },
    title: { type: SchemaType.STRING },
    icon: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    cards: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        required: [
          "id",
          "question",
          "key_points",
          "sample_answer",
          "tips",
          "confidence_level",
          "references_cv",
        ],
        properties: {
          id: { type: SchemaType.STRING },
          question: { type: SchemaType.STRING },
          key_points: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          sample_answer: { type: SchemaType.STRING },
          tips: { type: SchemaType.STRING },
          confidence_level: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["low", "medium", "high"],
          },
          references_cv: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
      },
    },
  },
};

/** Mirrors anthropic.ts ClaudeResponseError so callers (pipeline.ts) see same shape. */
export class GeminiResponseError extends Error {
  rawResponse: string;
  constructor(message: string, rawResponse: string) {
    super(message);
    this.name = "GeminiResponseError";
    this.rawResponse = rawResponse;
  }
}

/**
 * Detect transient Gemini errors that justify a retry. 503 ("model under high
 * demand") and 429 ("rate limit") are explicitly listed by Google as retryable.
 * Network/timeouts also fit. Other errors fail fast.
 */
function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|deadline|ECONNRESET|ETIMEDOUT|fetch failed|high demand|temporarily unavailable)\b/i.test(
    msg,
  );
}

/**
 * Wrap a Gemini call with 3-attempt exponential backoff (immediate, +1.5s,
 * +4s) on the primary model, then 1 attempt on each fallback model. Only
 * retries on transient errors (503/429/network). Non-transient errors on
 * the primary skip the fallback chain entirely (likely code/schema bug,
 * fallback won't help).
 *
 * Total worst case: ~5.5s primary retries + 2s + (fallback call 1) + 2s +
 * (fallback call 2) ≈ 12-15s before giving up. Acceptable in a 1-3 min
 * prep generation flow.
 *
 * `fn` receives the model ID to use for each attempt — caller is expected
 * to construct the model fresh per call (so that systemInstruction +
 * generationConfig are bound correctly to whichever model ID is active).
 */
async function callGeminiWithRetry<T>(
  label: string,
  fn: (modelId: string) => Promise<T>,
): Promise<T> {
  const PRIMARY_DELAYS = [0, 1500, 4000];
  const FALLBACK_DELAY = 2000;

  let lastErr: unknown;
  let primaryHadNonTransient = false;

  // Primary model: 3 attempts with backoff
  for (let i = 0; i < PRIMARY_DELAYS.length; i++) {
    if (PRIMARY_DELAYS[i] > 0) await new Promise((r) => setTimeout(r, PRIMARY_DELAYS[i]));
    try {
      return await fn(MODEL_ID);
    } catch (err) {
      lastErr = err;
      const transient = isTransientGeminiError(err);
      console.warn(
        `[gemini] ${label} primary attempt ${i + 1}/${PRIMARY_DELAYS.length} failed (transient=${transient}): ${err instanceof Error ? err.message : String(err)}`,
      );
      if (!transient) {
        primaryHadNonTransient = true;
        break;
      }
    }
  }

  // Skip fallback chain if primary failed for a non-transient reason
  // (probably a code/schema bug — different model won't fix it).
  if (primaryHadNonTransient) {
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  // Fallback chain: 1 attempt each on FALLBACK_MODELS
  for (const fallbackId of FALLBACK_MODELS) {
    await new Promise((r) => setTimeout(r, FALLBACK_DELAY));
    console.warn(`[gemini] ${label} falling back to ${fallbackId}`);
    try {
      return await fn(fallbackId);
    } catch (err) {
      lastErr = err;
      console.warn(
        `[gemini] ${label} fallback ${fallbackId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Continue to next fallback regardless of transient/not — we've already
      // exhausted the "transient on primary" budget; any error on fallback is
      // a signal to try the next model.
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Lenient pre-process for Cerebras output: fills common missing fields with
 * sensible defaults before Zod safeParse. Cerebras's `response_format:
 * json_object` only guarantees valid JSON, not schema match — Llama / Qwen
 * habitually skip required fields like card `id` (production-observed
 * 2026-05-07: "expected string, received undefined" at path cards.0.id).
 *
 * Strategy: fill what's safely auto-derivable (ids), leave the rest to Zod.
 * If still failing, propagation continues normally.
 */
function coerceCerebrasOutput(raw: unknown, label: string): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };

  // Sections schema: cards[].id is required and Cerebras often skips it.
  if (Array.isArray(obj.cards)) {
    out.cards = (obj.cards as unknown[]).map((card, i) => {
      if (!card || typeof card !== "object" || Array.isArray(card)) return card;
      const c = card as Record<string, unknown>;
      if (typeof c.id !== "string" || !c.id) {
        return { ...c, id: `${label}-${i + 1}` };
      }
      return c;
    });
  }

  // Sections schema: top-level id/title/icon/summary required.
  if (typeof out.id !== "string" || !out.id) out.id = label;
  return out;
}

/**
 * Last-resort fallback: when the entire Gemini chain (primary + 2 GA
 * fallbacks) is exhausted by 503s, try Cerebras Cloud Inference. Returns
 * the parsed Zod result on success, or throws the original Gemini error
 * to preserve diagnostics. Never throws from Cerebras itself — silent fail
 * to original error so user sees the most informative message.
 *
 * Cerebras with `response_format: json_object` is looser on schema
 * adherence than Gemini's `responseSchema`, so the Zod safeParse is the
 * only enforcement. We pre-coerce common missing fields (auto-fill card
 * ids, etc.) before validation to recover from minor schema drift.
 */
async function tryCerebrasFallback<T>(opts: {
  label: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  schema: ZodSchema<T>;
  geminiErr: unknown;
}): Promise<T> {
  const result = await callCerebrasJson({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    label: opts.label,
  });
  if (!result.ok) {
    // No key OR all Cerebras models failed. Surface the ORIGINAL Gemini
    // error — it's more diagnostic than "Cerebras has no key".
    throw opts.geminiErr instanceof Error
      ? opts.geminiErr
      : new Error(String(opts.geminiErr));
  }

  let raw: unknown;
  try {
    raw = JSON.parse(result.text);
  } catch {
    console.warn(`[cerebras] ${opts.label} non-JSON output, propagating Gemini error`);
    throw opts.geminiErr instanceof Error
      ? opts.geminiErr
      : new Error(String(opts.geminiErr));
  }

  // Lenient pre-process: fill predictable missing fields (card ids etc).
  const coerced = coerceCerebrasOutput(raw, opts.label);

  const parsed = opts.schema.safeParse(coerced);
  if (!parsed.success) {
    console.warn(
      `[cerebras] ${opts.label} schema failed after coercion: ${parsed.error.message.slice(0, 200)}`,
    );
    throw opts.geminiErr instanceof Error
      ? opts.geminiErr
      : new Error(String(opts.geminiErr));
  }

  console.log(
    `[cerebras] ${opts.label} succeeded as fallback (${result.modelId})`,
  );
  return parsed.data;
}

// Re-export the mock fixtures by importing them lazily (anthropic.ts owns them
// to avoid circular concerns). For test paths, MOCK_ANTHROPIC=1 already short-
// circuits in anthropic.ts; for parity we honor the same env var here.
const MOCK_FIXTURES: Record<SectionKind, PrepSection> = {
  likely: {
    id: "likely-questions",
    title: "Likely Questions",
    icon: "💬",
    summary: "Mock likely questions.",
    cards: [
      {
        id: "mock-1",
        question: "Mock question?",
        key_points: ["Mock point"],
        sample_answer:
          "Mock answer that is at least fifty characters long to satisfy the schema minimum.",
        tips: "Mock tips.",
        confidence_level: "high",
        references_cv: [],
      },
    ],
  },
  "deep-dive": {
    id: "deep-dive-questions",
    title: "Deep Dive Questions",
    icon: "🔍",
    summary: "Mock deep dive.",
    cards: [
      {
        id: "mock-1",
        question: "Mock deep question?",
        key_points: ["Mock"],
        sample_answer:
          "Mock answer that is at least fifty characters long to satisfy the schema minimum.",
        tips: "Mock.",
        confidence_level: "high",
        references_cv: [],
      },
    ],
  },
  tricky: {
    id: "tricky-questions",
    title: "Tricky Questions",
    icon: "🎯",
    summary: "Mock tricky.",
    cards: [
      {
        id: "mock-1",
        question: "Mock tricky?",
        key_points: ["Mock"],
        sample_answer:
          "Mock answer that is at least fifty characters long to satisfy the schema minimum.",
        tips: "Mock.",
        confidence_level: "medium",
        references_cv: [],
      },
    ],
  },
  "questions-to-ask": {
    id: "questions-to-ask",
    title: "Questions to Ask",
    icon: "❓",
    summary: "Mock questions to ask.",
    cards: [
      {
        id: "mock-1",
        question: "Mock to ask?",
        key_points: ["Mock"],
        sample_answer:
          "Mock answer that is at least fifty characters long to satisfy the schema minimum.",
        tips: "Mock.",
        confidence_level: "high",
        references_cv: [],
      },
    ],
  },
  mindset: {
    id: "mindset-tips",
    title: "Mindset & Tips",
    icon: "🧠",
    summary: "Mock mindset.",
    cards: [
      {
        id: "mock-1",
        question: "Mock mindset?",
        key_points: ["Mock"],
        sample_answer:
          "Mock answer that is at least fifty characters long to satisfy the schema minimum.",
        tips: "Mock.",
        confidence_level: "high",
        references_cv: [],
      },
    ],
  },
};

/**
 * Generate ONE prep section via Gemini Flash with JSON schema-constrained
 * output. Throws on error. If MOCK_ANTHROPIC=1, returns fixture immediately
 * (kept name for test parity — the env flag is the kill switch for ALL AI).
 */
export async function generateSection(params: {
  kind: SectionKind;
  system: string;
  user: string;
}): Promise<PrepSection> {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return MOCK_FIXTURES[params.kind];
  }

  if (!env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const client = new GoogleGenerativeAI(env.GOOGLE_API_KEY);

  const start = Date.now();
  console.log(`[gemini] section ${params.kind} starting`);
  let result;
  try {
    result = await callGeminiWithRetry(`section-${params.kind}`, (modelId) => {
      const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: params.system,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: sectionResponseSchema,
          // 8192 (was 4096): PT-BR consumes ~1.3-1.5x more tokens than EN
          // for the same characters. 4096 was getting truncated mid-JSON
          // for sections with long sample_answers, producing
          // "Unterminated string" errors and confusing the user.
          maxOutputTokens: 8192,
          temperature: 0.7,
        },
      });
      return model.generateContent(params.user);
    });
  } catch (geminiErr) {
    // All Gemini models exhausted — try Cerebras as last resort.
    return tryCerebrasFallback({
      label: `section-${params.kind}`,
      systemPrompt: params.system,
      userPrompt: params.user,
      temperature: 0.7,
      maxTokens: 8192,
      schema: prepSectionSchema,
      geminiErr,
    });
  }
  const text = result.response.text();
  // Detect truncation: when Gemini hits maxOutputTokens, finishReason is
  // "MAX_TOKENS" and the JSON is unterminated mid-string. Surface as a
  // clear error instead of letting JSON.parse blow up with "Unexpected end".
  const finishReason =
    result.response.candidates?.[0]?.finishReason ?? null;
  if (finishReason === "MAX_TOKENS") {
    throw new GeminiResponseError(
      `Gemini section truncated (hit max_output_tokens). Output is malformed JSON.`,
      text,
    );
  }
  console.log(
    `[gemini] section ${params.kind} completed in ${Date.now() - start}ms`,
  );

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new GeminiResponseError(
      `Gemini returned non-JSON output: ${err instanceof Error ? err.message : String(err)}`,
      text,
    );
  }

  const parsed = prepSectionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GeminiResponseError(
      `Gemini section failed schema validation: ${parsed.error.message}`,
      text,
    );
  }
  return parsed.data;
}

// ---------------------------- CV Rewrite -----------------------------

/** JSON Schema mirror of cvRewriteSchema for Gemini responseSchema. */
const cvRewriteResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  required: ["markdown", "summary_of_changes", "preserved_facts"],
  properties: {
    markdown: { type: SchemaType.STRING },
    summary_of_changes: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    preserved_facts: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
};

const MOCK_CV_REWRITE: CvRewrite = {
  markdown: `## Resumo Profissional\n\nLíder de procurement com 10+ anos em transformação digital e AI-enabled em LATAM.\n\n## Experiência\n\n### Bayer (2019-2022)\n- $500M em spend, 18% de cost takeout, 40% redução de cycle time.\n\n## Educação\nMBA, INSEAD, 2018.`,
  summary_of_changes: [
    "Mock change 1: termo 'digital tools' → 'agentic AI'",
    "Mock change 2: adicionado 'touchless P2P' no resumo",
  ],
  preserved_facts: ["$500M spend", "18% cost takeout", "MBA INSEAD 2018"],
};

/**
 * Generate ATS-optimized CV rewrite via Gemini Flash with JSON
 * schema-constrained output. Throws on error.
 */
export async function generateCvRewrite(params: {
  system: string;
  user: string;
}): Promise<CvRewrite> {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return MOCK_CV_REWRITE;
  }

  if (!env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const client = new GoogleGenerativeAI(env.GOOGLE_API_KEY);

  const start = Date.now();
  console.log("[gemini] cv-rewrite starting");
  let result;
  try {
    result = await callGeminiWithRetry("cv-rewrite", (modelId) => {
      const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: params.system,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: cvRewriteResponseSchema,
          // 16k (was 8k): CV rewrite output is the full markdown CV plus
          // summary_of_changes (up to 40 entries) plus preserved_facts (up
          // to 60). Hit 8k truncation on long CVs in PT-BR.
          maxOutputTokens: 16384,
          temperature: 0.5,
        },
      });
      return model.generateContent(params.user);
    });
  } catch (geminiErr) {
    return tryCerebrasFallback({
      label: "cv-rewrite",
      systemPrompt: params.system,
      userPrompt: params.user,
      temperature: 0.5,
      maxTokens: 16384,
      schema: cvRewriteSchema,
      geminiErr,
    });
  }
  const text = result.response.text();
  const finishReason =
    result.response.candidates?.[0]?.finishReason ?? null;
  if (finishReason === "MAX_TOKENS") {
    throw new GeminiResponseError(
      `Gemini cv-rewrite truncated (hit max_output_tokens). Output is malformed JSON.`,
      text,
    );
  }
  console.log(`[gemini] cv-rewrite completed in ${Date.now() - start}ms`);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new GeminiResponseError(
      `Gemini returned non-JSON output: ${err instanceof Error ? err.message : String(err)}`,
      text,
    );
  }

  const parsed = cvRewriteSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GeminiResponseError(
      `Gemini cv-rewrite failed schema validation: ${parsed.error.message}`,
      text,
    );
  }
  return parsed.data;
}

// ---------------------------- ATS Analysis -----------------------------

const atsResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  required: ["score", "title_match", "keyword_analysis", "top_fixes", "overall_assessment"],
  properties: {
    score: { type: SchemaType.INTEGER },
    title_match: {
      type: SchemaType.OBJECT,
      required: ["cv_title", "jd_title", "match_score"],
      properties: {
        cv_title: { type: SchemaType.STRING },
        jd_title: { type: SchemaType.STRING },
        match_score: { type: SchemaType.INTEGER },
      },
    },
    keyword_analysis: {
      type: SchemaType.OBJECT,
      required: ["critical", "high", "medium"],
      properties: {
        critical: {
          type: SchemaType.ARRAY,
          items: keywordItemGeminiSchema(),
        },
        high: {
          type: SchemaType.ARRAY,
          items: keywordItemGeminiSchema(),
        },
        medium: {
          type: SchemaType.ARRAY,
          items: keywordItemGeminiSchema(),
        },
      },
    },
    top_fixes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        required: [
          "priority",
          "gap",
          "original_cv_language",
          "jd_language",
          "suggested_rewrite",
        ],
        properties: {
          priority: { type: SchemaType.INTEGER },
          gap: { type: SchemaType.STRING },
          original_cv_language: { type: SchemaType.STRING },
          jd_language: { type: SchemaType.STRING },
          suggested_rewrite: { type: SchemaType.STRING },
        },
      },
    },
    overall_assessment: { type: SchemaType.STRING },
  },
};

function keywordItemGeminiSchema(): Schema {
  return {
    type: SchemaType.OBJECT,
    required: ["keyword", "found"],
    properties: {
      keyword: { type: SchemaType.STRING },
      found: { type: SchemaType.BOOLEAN },
      context: { type: SchemaType.STRING },
    },
  };
}

const MOCK_ATS: AtsAnalysis = {
  score: 73,
  title_match: {
    cv_title: "Head of Procurement LATAM",
    jd_title: "Senior Director, AI Procurement",
    match_score: 55,
  },
  keyword_analysis: {
    critical: [{ keyword: "agentic AI", found: false }],
    high: [{ keyword: "touchless P2P", found: false }],
    medium: [{ keyword: "rapid prototyping", found: false }],
  },
  top_fixes: [
    {
      priority: 1,
      gap: "Missing: agentic AI",
      original_cv_language: "digital tools",
      jd_language: "agentic AI",
      suggested_rewrite:
        "Deployed agentic AI workflows for sourcing across LATAM, automating tail spend and reducing cycle time 40%.",
    },
  ],
  overall_assessment:
    "Mock assessment: strong domain experience but CV vocabulary lags JD by 2-3 years on AI-specific terminology.",
};

export async function generateAtsAnalysis(params: {
  system: string;
  user: string;
}): Promise<AtsAnalysis> {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return MOCK_ATS;
  }
  if (!env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const client = new GoogleGenerativeAI(env.GOOGLE_API_KEY);

  const start = Date.now();
  console.log("[gemini] ats starting");
  let result;
  try {
    result = await callGeminiWithRetry("ats", (modelId) => {
      const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: params.system,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: atsResponseSchema,
          // 8192 (was 4096): ATS analysis can be verbose with many top_fixes
          // entries each containing original_cv_language + jd_language +
          // suggested_rewrite — easily blows past 4096 tokens in PT-BR.
          maxOutputTokens: 8192,
          // Deterministic-as-possible: same CV + JD should produce the same
          // score and analysis on re-run. temperature=0 + topK=1 collapses the
          // sampling distribution; minor variation may still leak from float
          // ops on the server, but it's no longer the wild swings users saw.
          temperature: 0,
          topK: 1,
          topP: 0,
        },
      });
      return model.generateContent(params.user);
    });
  } catch (geminiErr) {
    return tryCerebrasFallback({
      label: "ats",
      systemPrompt: params.system,
      userPrompt: params.user,
      temperature: 0,
      maxTokens: 8192,
      schema: atsAnalysisSchema,
      geminiErr,
    });
  }
  const text = result.response.text();
  const finishReason =
    result.response.candidates?.[0]?.finishReason ?? null;
  if (finishReason === "MAX_TOKENS") {
    throw new GeminiResponseError(
      `Gemini ats truncated (hit max_output_tokens). Output is malformed JSON.`,
      text,
    );
  }
  console.log(`[gemini] ats completed in ${Date.now() - start}ms`);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new GeminiResponseError(
      `Gemini ats returned non-JSON: ${err instanceof Error ? err.message : String(err)}`,
      text,
    );
  }

  const parsed = atsAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GeminiResponseError(
      `Gemini ats failed schema validation: ${parsed.error.message}`,
      text,
    );
  }
  return parsed.data;
}

// ---------------------------- JD Cleanup -------------------------------

/**
 * Strip non-JD chrome from a careers-page extraction (cookie banners,
 * navigation, legal footer, "Apply now" CTAs, etc.) and return only the
 * description that's relevant to the candidate. Returns the input verbatim
 * if cleanup fails or the model API is unavailable — callers should not
 * rely on cleanup, just treat it as a best-effort improvement.
 */
export async function cleanJobDescription(rawText: string): Promise<string> {
  const trimmed = rawText.trim();
  if (trimmed.length < 400) return trimmed;
  if (process.env.MOCK_ANTHROPIC === "1") return trimmed;
  if (!env.GOOGLE_API_KEY) return trimmed;

  // Guard against giant inputs — Gemini Flash Lite has a wide context window
  // but we don't want to spend tokens on absurd payloads.
  const truncated = trimmed.slice(0, 60_000);

  const system = `You receive raw text scraped from a careers page that contains a job description plus website chrome (cookie banners, navigation, footer, related jobs, legal links, "Apply now" buttons, social share, etc.).

Return ONLY the job description content the candidate cares about: role title (if present), responsibilities, requirements, qualifications, "about the role", "what you'll do", "what you'll bring", team/company section if it's substantive (one paragraph), benefits if listed.

REMOVE: cookie consent text, "We use cookies" banners, accept/reject buttons, navigation menus, "Related jobs", "Job ID", "Apply now" CTAs that aren't part of the description, social share text, "Sign in to LinkedIn" prompts, footer links (Privacy Policy, Terms, Cookie Policy), copyright, breadcrumb trails, "Tell us about yourself" widgets, equal-opportunity boilerplate longer than 1 sentence, salary disclaimers longer than 1 sentence.

PRESERVE the meaningful structure: keep headings (## or "Responsibilities:"), keep bullet points (with - or *), keep paragraph breaks. Output plain text / lightweight markdown only.

Output rules:
- Return only the cleaned text. No preamble, no explanation, no code fences.
- Preserve language (Portuguese stays Portuguese, English stays English).
- If the input is already clean / mostly JD content, return it almost unchanged.
- If the input has no recognizable job description, return the original text verbatim — do not invent content.`;

  try {
    const client = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
    const start = Date.now();
    console.log(`[gemini] jd-cleanup starting (${truncated.length} chars in)`);
    const result = await callGeminiWithRetry("jd-cleanup", (modelId) => {
      const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: system,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.1,
        },
      });
      return model.generateContent(truncated);
    });
    const cleaned = result.response.text().trim();
    console.log(
      `[gemini] jd-cleanup completed in ${Date.now() - start}ms (${cleaned.length} chars out)`,
    );
    // Sanity: if the cleaner returned something absurdly short, prefer the
    // original to avoid losing legitimate JD content.
    if (cleaned.length < 200) return trimmed;
    return cleaned;
  } catch (err) {
    console.warn(
      `[gemini] jd-cleanup failed: ${err instanceof Error ? err.message : String(err)} — using raw text`,
    );
    return trimmed;
  }
}

// ---------------------------- Company Intel -----------------------------

const MOCK_COMPANY_INTEL: CompanyIntel = {
  overview:
    "Mock Co is a $3B specialty chemicals company headquartered in Columbus, OH, private-equity owned by Apollo Global Management.",
  recent_developments: [
    {
      headline: "IPO filed March 2026",
      why_it_matters:
        "Signals a liquidity event — leadership is under shareholder pressure to accelerate AI and cost transformation.",
    },
  ],
  key_people: [
    {
      name: "Jane Doe",
      role: "Chief Procurement Officer",
      background_snippet: "Ex-Bayer, joined 2024 to lead procurement transformation.",
    },
  ],
  culture_signals: ["fast-paced", "sponsor-owned speed"],
  strategic_context:
    "Specialty chemicals is consolidating; the PE sponsor is targeting a 2027 exit and needs EBITDA expansion via operational efficiency.",
  questions_this_creates: [
    "How does the IPO timeline affect the procurement transformation roadmap?",
  ],
};

/**
 * Strip markdown code fences (```json ... ``` or ``` ... ```) from a string.
 * Gemini sometimes wraps JSON output in fences when grounding is enabled and
 * responseSchema is not (Gemini blocks combining the two).
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
  }
  return trimmed;
}

/**
 * Extract every balanced top-level JSON object from a string and return them
 * in order. Useful when the model emits multiple ```json blocks (Gemini does
 * this when grounding citations get long) — we pick the most complete one.
 */
function extractJsonObjects(text: string): string[] {
  const found: string[] = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("{", i);
    if (start === -1) break;
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;
    for (let j = start; j < text.length; j++) {
      const c = text[j];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) break;
    found.push(text.slice(start, end + 1));
    i = end + 1;
  }
  return found;
}

/**
 * Generate company intel via Gemini with Google Search grounding. Returns
 * `null` when the model produces nothing useful — pipeline treats this as
 * "skipped" and continues. Throws on hard errors (network, schema fail).
 *
 * Gemini does not allow `googleSearchRetrieval` AND `responseSchema` in the
 * same call, so we ask for JSON via prompt and parse leniently.
 */
export async function generateCompanyIntel(params: {
  system: string;
  user: string;
}): Promise<CompanyIntel | null> {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return MOCK_COMPANY_INTEL;
  }
  if (!env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const client = new GoogleGenerativeAI(env.GOOGLE_API_KEY);

  async function callOnce(opts: {
    modelId: string;
    grounded: boolean;
    label: string;
  }): Promise<string> {
    const model = client.getGenerativeModel({
      model: opts.modelId,
      systemInstruction: params.system,
      ...(opts.grounded ? { tools: [{ googleSearch: {} }] as never } : {}),
      generationConfig: {
        // Bumped from 4096 → 12000 after Burson prep (5915 chars) hit
        // Unterminated string mid-JSON. Grounded calls eat tokens on
        // citation overhead, so the JSON envelope needs more headroom.
        maxOutputTokens: 12000,
        temperature: 0.4,
      },
    });
    console.log(`[gemini] company-intel ${opts.label} (${opts.modelId}) starting`);
    const t0 = Date.now();
    const result = await model.generateContent(params.user);
    const text = result.response.text();
    console.log(
      `[gemini] company-intel ${opts.label} completed in ${Date.now() - t0}ms (${text.length} chars)`,
    );
    return text;
  }

  let text = "";
  let groundedErr: unknown = null;
  try {
    text = await callGeminiWithRetry("company-intel-grounded", (modelId) =>
      callOnce({ modelId, grounded: true, label: "googleSearch" }),
    );
  } catch (err) {
    groundedErr = err;
  }

  // Fallback to ungrounded call so we still produce *something* for the
  // candidate from the model's training knowledge. This is acceptable
  // even when grounded fails — better stale info than no info.
  if (!text) {
    try {
      console.warn("[gemini] company-intel falling back to ungrounded call");
      text = await callGeminiWithRetry("company-intel-ungrounded", (modelId) =>
        callOnce({ modelId, grounded: false, label: "ungrounded" }),
      );
    } catch (err) {
      // Both paths failed. If error was transient (503 etc.), surface a
      // user-friendly message and let them retry. If it was a hard error,
      // surface the actual exception.
      const groundedMsg = groundedErr instanceof Error ? groundedErr.message : String(groundedErr);
      const ungroundedMsg = err instanceof Error ? err.message : String(err);
      const bothTransient =
        isTransientGeminiError(groundedErr) && isTransientGeminiError(err);
      const userMessage = bothTransient
        ? "O serviço de pesquisa de empresa está temporariamente sobrecarregado. Tente novamente em alguns minutos."
        : `Falha na pesquisa de empresa. Detalhes: ${ungroundedMsg}`;
      throw new GeminiResponseError(
        `${userMessage}\n\n[grounded] ${groundedMsg}\n[ungrounded] ${ungroundedMsg}`,
        "",
      );
    }
  }

  // Gemini grounding sometimes emits multiple ```json blocks separated by
  // citation noise. Try every top-level object and pick the first that
  // parses + matches the schema.
  const stripped = stripCodeFences(text);
  const candidates = stripped.startsWith("{") ? [stripped] : extractJsonObjects(stripped);

  if (candidates.length === 0) {
    console.warn("[gemini] company-intel produced no parseable JSON; skipping");
    return null;
  }

  let parseErr: string | null = null;
  for (const jsonStr of candidates) {
    let raw: unknown;
    try {
      raw = JSON.parse(jsonStr);
    } catch (err) {
      parseErr = `JSON.parse: ${err instanceof Error ? err.message : String(err)}`;
      continue;
    }
    // Defensive: strip any URL-ish fields the model might have sneaked in
    // despite the prompt — Vertex AI redirect URLs run thousands of chars.
    const clean = stripUrlFields(raw);
    const sanitized = sanitizeCompanyIntel(clean);
    const parsed = companyIntelSchema.safeParse(sanitized);
    if (parsed.success) return parsed.data;
    parseErr = `schema: ${parsed.error.message}`;
  }

  throw new GeminiResponseError(
    `Gemini company-intel: no candidate parsed (${candidates.length} tried). Last error: ${parseErr ?? "unknown"}`,
    text,
  );
}

function stripUrlFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUrlFields);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "source_url" || k === "url" || k === "link" || k === "citation") continue;
      out[k] = stripUrlFields(v);
    }
    return out;
  }
  return value;
}

/**
 * Best-effort cleanup of a parsed company-intel JSON object before strict
 * schema validation. Goal: never reject the whole payload over one bad item.
 *
 * - `recent_developments`: drop entries missing `headline` or `why_it_matters`,
 *   truncate strings to schema max, cap array at 6.
 * - `key_people`: drop entries missing required fields, truncate strings,
 *   cap at 5.
 * - `culture_signals`: drop empties, truncate to 300 chars, cap at 6.
 * - `questions_this_creates`: drop empties/too-shorts, truncate to 400, cap 4.
 * - `overview` / `strategic_context`: truncate to 2000 chars.
 *
 * Anything else passes through. Returns the original value if it's not an
 * object (schema will then reject it normally).
 */
// Exported for unit tests; not part of the module's public surface.
export function sanitizeCompanyIntel(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };

  const truncStr = (v: unknown, max: number): string | undefined => {
    if (typeof v !== "string") return undefined;
    const s = v.trim();
    return s.length > max ? s.slice(0, max) : s;
  };

  if (typeof obj.overview === "string") out.overview = truncStr(obj.overview, 2000);
  if (typeof obj.strategic_context === "string")
    out.strategic_context = truncStr(obj.strategic_context, 2000);

  if (Array.isArray(obj.recent_developments)) {
    out.recent_developments = (obj.recent_developments as unknown[])
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const it = item as Record<string, unknown>;
        const headline = truncStr(it.headline, 200);
        const why = truncStr(it.why_it_matters, 400);
        if (!headline || !why || why.length < 10) return null;
        return { headline, why_it_matters: why };
      })
      .filter((it): it is { headline: string; why_it_matters: string } => it !== null)
      .slice(0, 6);
  }

  if (Array.isArray(obj.key_people)) {
    out.key_people = (obj.key_people as unknown[])
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const it = item as Record<string, unknown>;
        const name = truncStr(it.name, 120);
        const role = truncStr(it.role, 120);
        const bg = truncStr(it.background_snippet, 400);
        if (!name || !role || !bg) return null;
        return { name, role, background_snippet: bg };
      })
      .filter(
        (it): it is { name: string; role: string; background_snippet: string } => it !== null,
      )
      .slice(0, 5);
  }

  if (Array.isArray(obj.culture_signals)) {
    out.culture_signals = (obj.culture_signals as unknown[])
      .map((s) => truncStr(s, 300))
      .filter((s): s is string => Boolean(s && s.length >= 1))
      .slice(0, 6);
  }

  if (Array.isArray(obj.questions_this_creates)) {
    out.questions_this_creates = (obj.questions_this_creates as unknown[])
      .map((s) => truncStr(s, 400))
      .filter((s): s is string => Boolean(s && s.length >= 5))
      .slice(0, 4);
  }

  return out;
}
