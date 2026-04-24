import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { env } from "@/lib/env";
import {
  prepSectionSchema,
  type PrepSection,
} from "@/lib/ai/schemas";
import { type SectionKind } from "@/lib/ai/prompts/section-generator";

// Sections (5 parallel calls in Stage B) blew through Sonnet's 30k input
// tokens/min limit. Gemini 2.5 Flash has much higher rate limits and JSON
// schema-constrained output works comparably for these structured sections.
const MODEL_ID = "gemini-2.5-flash";

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
