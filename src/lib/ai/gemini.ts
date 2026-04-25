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

// Default model for structured-output tasks (sections, ATS, CV rewrite).
// Lighter / cheaper / higher rate limits than the Sonnet path we replaced.
const MODEL_ID = "gemini-3.1-flash-lite-preview";

// Model used for company intel — needs Google Search grounding, which the
// flash-lite preview does not support. 2.5-flash is the lightest model that
// supports `googleSearchRetrieval` + ample reasoning for research synthesis.
const GROUNDED_MODEL_ID = "gemini-2.5-flash";

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
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: params.system,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: sectionResponseSchema,
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
  });

  const start = Date.now();
  console.log(`[gemini] section ${params.kind} starting`);
  const result = await model.generateContent(params.user);
  const text = result.response.text();
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
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: params.system,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: cvRewriteResponseSchema,
      maxOutputTokens: 8192,
      temperature: 0.5,
    },
  });

  const start = Date.now();
  console.log("[gemini] cv-rewrite starting");
  const result = await model.generateContent(params.user);
  const text = result.response.text();
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
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: params.system,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: atsResponseSchema,
      maxOutputTokens: 4096,
      // Deterministic-as-possible: same CV + JD should produce the same
      // score and analysis on re-run. temperature=0 + topK=1 collapses the
      // sampling distribution; minor variation may still leak from float
      // ops on the server, but it's no longer the wild swings users saw.
      temperature: 0,
      topK: 1,
      topP: 0,
    },
  });

  const start = Date.now();
  console.log("[gemini] ats starting");
  const result = await model.generateContent(params.user);
  const text = result.response.text();
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
    const model = client.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: system,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.1,
      },
    });
    const start = Date.now();
    console.log(`[gemini] jd-cleanup starting (${truncated.length} chars in)`);
    const result = await model.generateContent(truncated);
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

  // For Gemini 2.5+ models, the grounding tool is `googleSearch` (no Retrieval
  // suffix). Older models used `googleSearchRetrieval`. The bundled SDK types
  // only know the old name, so we cast. Try the new name first; if the API
  // rejects it, fall back to the legacy name.
  async function callWith(tool: unknown, label: string): Promise<string> {
    const model = client.getGenerativeModel({
      model: GROUNDED_MODEL_ID,
      systemInstruction: params.system,
      tools: [tool] as never,
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.4,
      },
    });
    console.log(`[gemini] company-intel ${label} starting`);
    const t0 = Date.now();
    const result = await model.generateContent(params.user);
    const text = result.response.text();
    console.log(
      `[gemini] company-intel ${label} completed in ${Date.now() - t0}ms (${text.length} chars)`,
    );
    return text;
  }

  let text = "";
  let lastErr: unknown = null;
  for (const attempt of [
    { tool: { googleSearch: {} }, label: "googleSearch" },
    { tool: { googleSearchRetrieval: {} }, label: "googleSearchRetrieval" },
  ]) {
    try {
      text = await callWith(attempt.tool, attempt.label);
      break;
    } catch (err) {
      lastErr = err;
      console.warn(
        `[gemini] company-intel ${attempt.label} threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Last-resort: try without grounding so we still produce *something* for
  // the candidate from the model's training knowledge.
  if (!text) {
    try {
      console.warn("[gemini] company-intel falling back to ungrounded call");
      const model = client.getGenerativeModel({
        model: GROUNDED_MODEL_ID,
        systemInstruction: params.system,
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.4,
        },
      });
      const result = await model.generateContent(params.user);
      text = result.response.text();
    } catch (err) {
      throw new GeminiResponseError(
        `Gemini company-intel failed all attempts. Last error: ${
          (lastErr instanceof Error ? lastErr.message : String(lastErr)) ||
          (err instanceof Error ? err.message : String(err))
        }`,
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
    const parsed = companyIntelSchema.safeParse(clean);
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
