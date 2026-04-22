# Pipeline Depth (#2c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a company research stage (Claude + `web_search_20250305`) to the prep pipeline and render the structured intel as a new "🏢 Company Intel" tab, while also feeding the intel into every section prompt so answers cite specific company facts.

**Architecture:** New `runPipeline` orchestrator runs Stage A (company research via multi-turn tool-use loop) before Stage B (the existing 5 parallel section calls). Stage A failure degrades gracefully — sections still run. Intel persists as JSONB on `prep_sessions` with status columns for debug. UI prepends a synthetic "Company Intel" section to the tab nav when intel is available.

**Tech Stack:** Anthropic SDK `web_search_20250305` server tool + custom `submit_company_intel` tool, Next.js 15 Server Actions, Zod validation, Vitest, Playwright.

**Branch:** `pipeline-depth/2c` (already checked out)

**Spec:** `docs/superpowers/specs/2026-04-22-pipeline-depth-design.md`

---

## File Structure

### Created
| Path | Purpose |
|---|---|
| `supabase/migrations/0006_company_intel.sql` | Add `company_intel` JSONB + status columns to `prep_sessions` |
| `src/lib/ai/pipeline.ts` | Orchestrator: Stage A (research) + Stage B (sections), graceful degradation |
| `src/lib/ai/prompts/company-research.ts` | `buildCompanyResearchPrompt` |
| `src/lib/ai/prompts/section-generator.test.ts` | Unit tests for intel block inclusion |
| `src/components/prep/CompanyIntelCards.tsx` | Renders intel: overview, developments, people, culture, questions |
| `tests/e2e/company-intel.spec.ts` | E2E: intel tab visible, renders all fields, deep link works |

### Modified
| Path | Change |
|---|---|
| `src/lib/ai/schemas.ts` | Add `companyIntelSchema` + `CompanyIntel` type |
| `src/lib/ai/schemas.test.ts` | Add 4 tests for the new schema |
| `src/lib/ai/anthropic.ts` | Add `generateCompanyIntel` (multi-turn tool-use) + `MOCK_COMPANY_INTEL` fixture + JSON Schema mirror |
| `src/lib/ai/prompts/section-generator.ts` | `buildSectionPrompt` accepts optional `companyIntel` and appends intel block |
| `src/app/prep/new/generation.ts` | Becomes a thin wrapper delegating to `runPipeline` |
| `src/app/prep/[id]/page.tsx` | Read `company_intel` + pass to `PrepGuide` |
| `src/components/prep/PrepGuide.tsx` | Prepend synthetic "Company Intel" tab; render `CompanyIntelCards` when active |
| `src/components/prep/NewPrepForm.tsx` | Spinner text: "Researching company and writing your prep… about 60 seconds" |
| `src/components/prep/PrepSkeleton.tsx` | Add leading intel skeleton card |
| `supabase/migrations/README.md` | 0006 row + deploy steps |

### Unchanged
- `createPrep`, `uploadCv`, ATS flow, auth, dashboard, runGeneration entry name (still exported, now delegates)

---

## Task 1: Migration 0006

**Files:**
- Create: `supabase/migrations/0006_company_intel.sql`

- [ ] **Step 1.1: Write migration**

`supabase/migrations/0006_company_intel.sql`:

```sql
ALTER TABLE public.prep_sessions
  ADD COLUMN company_intel JSONB,
  ADD COLUMN company_intel_status TEXT
    CHECK (company_intel_status IN ('pending','researching','complete','failed','skipped')),
  ADD COLUMN company_intel_error TEXT;
```

- [ ] **Step 1.2: Commit**

```bash
git add supabase/migrations/0006_company_intel.sql
git commit -m "feat(db,2c): migration 0006 company_intel columns on prep_sessions"
```

---

## Task 2: Zod schema + tests (TDD)

**Files:**
- Modify: `src/lib/ai/schemas.ts`
- Modify: `src/lib/ai/schemas.test.ts`

- [ ] **Step 2.1: Write failing tests**

Append to `src/lib/ai/schemas.test.ts` (after the existing `atsAnalysisSchema` describe block):

```typescript
import { companyIntelSchema } from "./schemas";

const validIntel = {
  overview:
    "Hexion is a $3B specialty chemicals company headquartered in Columbus, OH, sponsor-owned by Apollo Global Management.",
  recent_developments: [
    {
      headline: "Filed for IPO March 2026",
      why_it_matters:
        "Signals a liquidity event; leadership is under shareholder pressure to accelerate AI and cost transformation.",
    },
  ],
  key_people: [
    {
      name: "Jane Doe",
      role: "Chief Procurement Officer",
      background_snippet:
        "Joined 2024 from Bayer to lead procurement transformation.",
    },
  ],
  culture_signals: ["PE-owned speed", "hands-on leadership"],
  strategic_context:
    "Specialty chemicals is consolidating; the PE sponsor is targeting a 2027 exit and needs EBITDA expansion via operational efficiency.",
  questions_this_creates: [
    "How does the IPO timeline affect the procurement transformation roadmap?",
  ],
};

describe("companyIntelSchema", () => {
  it("accepts a valid intel", () => {
    expect(() => companyIntelSchema.parse(validIntel)).not.toThrow();
  });
  it("accepts all-empty arrays", () => {
    const empty = {
      ...validIntel,
      recent_developments: [],
      key_people: [],
      culture_signals: [],
      questions_this_creates: [],
    };
    expect(() => companyIntelSchema.parse(empty)).not.toThrow();
  });
  it("rejects overview shorter than 20 chars", () => {
    expect(() =>
      companyIntelSchema.parse({ ...validIntel, overview: "too short" }),
    ).toThrow();
  });
  it("rejects more than 6 recent_developments", () => {
    const dev = validIntel.recent_developments[0];
    expect(() =>
      companyIntelSchema.parse({
        ...validIntel,
        recent_developments: [dev, dev, dev, dev, dev, dev, dev],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2.2: Run — expect FAIL**

```bash
pnpm test src/lib/ai/schemas.test.ts
```

Expected: fails with "companyIntelSchema is not exported" (or undefined).

- [ ] **Step 2.3: Add schema to `src/lib/ai/schemas.ts`**

Append to the file (after `atsAnalysisSchema` + its type exports):

```typescript
export const companyIntelSchema = z.object({
  overview: z.string().min(20).max(600),
  recent_developments: z
    .array(
      z.object({
        headline: z.string().min(1).max(200),
        why_it_matters: z.string().min(10).max(400),
        source_url: z.string().url().optional(),
      }),
    )
    .min(0)
    .max(6),
  key_people: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        role: z.string().min(1).max(120),
        background_snippet: z.string().min(1).max(400),
      }),
    )
    .min(0)
    .max(5),
  culture_signals: z.array(z.string().min(1).max(150)).min(0).max(6),
  strategic_context: z.string().min(20).max(600),
  questions_this_creates: z.array(z.string().min(5).max(200)).min(0).max(4),
});

export type CompanyIntel = z.infer<typeof companyIntelSchema>;
```

- [ ] **Step 2.4: Run tests — expect PASS**

```bash
pnpm test
```

Expected: all 33 tests pass (29 existing + 4 new).

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/ai/schemas.ts src/lib/ai/schemas.test.ts
git commit -m "feat(schemas,2c): companyIntelSchema for research output"
```

---

## Task 3: Company research prompt

**Files:**
- Create: `src/lib/ai/prompts/company-research.ts`

- [ ] **Step 3.1: Write prompt builder**

`src/lib/ai/prompts/company-research.ts`:

```typescript
export function buildCompanyResearchPrompt(params: {
  companyName: string;
  jobTitle: string;
}) {
  const { companyName, jobTitle } = params;

  const system = `You are a corporate intelligence researcher preparing a candidate for an interview at ${companyName} for the role of ${jobTitle}. Use the web_search tool strategically (5-6 searches max) to gather current, relevant information, then call the submit_company_intel tool exactly once with a structured report.

Search priorities in this order:
1. "${companyName} recent news 2026"
2. "${companyName} leadership team CEO CPO"
3. "${companyName} ${jobTitle} strategy"
4. "${companyName} culture values glassdoor"
5. "${companyName} industry competitive landscape"
6. "${companyName} funding private equity acquisition" (only if relevant signals)

Quality rules for the submitted intel:
- overview: 2-3 sentences on what the company does (150-300 chars)
- recent_developments: 3-6 items from the LAST 12 MONTHS. Each needs headline + why_it_matters (the prep angle). Skip filler news.
- key_people: 2-4 executives relevant to the hiring chain or role function. CEO/CPO/CHRO/hiring manager if identifiable.
- culture_signals: short phrases ("aggressive shipping cadence", "PE-owned / speed + accountability"). No fillers like "team-oriented".
- strategic_context: 2-3 sentences on industry pressures, competitive position, or strategic bets relevant to the role.
- questions_this_creates: specific questions the candidate could ask that prove they did this research.

If searches return nothing useful (fresh company, private, generic results), call submit_company_intel with mostly-empty arrays and a short overview based on whatever you found. DO NOT make things up. Empty is acceptable.

Call submit_company_intel exactly once when done. Do not call it more than once.`;

  const user = `Research the company "${companyName}" for a candidate interviewing for the role "${jobTitle}". Start searching now.`;

  return { system, user };
}
```

- [ ] **Step 3.2: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/ai/prompts/company-research.ts
git commit -m "feat(ai,2c): buildCompanyResearchPrompt for Claude + web_search tool"
```

---

## Task 4: Section generator accepts optional intel (TDD)

**Files:**
- Modify: `src/lib/ai/prompts/section-generator.ts`
- Create: `src/lib/ai/prompts/section-generator.test.ts`

- [ ] **Step 4.1: Write failing tests**

`src/lib/ai/prompts/section-generator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSectionPrompt } from "./section-generator";
import type { CompanyIntel } from "@/lib/ai/schemas";

const baseParams = {
  kind: "likely" as const,
  cvText: "CV content here",
  jdText: "JD content here",
  jobTitle: "Senior Director",
  companyName: "Acme",
};

const sampleIntel: CompanyIntel = {
  overview: "Acme is a $3B specialty chemicals company.",
  recent_developments: [
    { headline: "IPO filed", why_it_matters: "Liquidity pressure on leadership." },
  ],
  key_people: [
    { name: "Jane Doe", role: "CPO", background_snippet: "Ex-Bayer, joined 2024." },
  ],
  culture_signals: ["PE-owned speed"],
  strategic_context: "Targeting 2027 exit; needs EBITDA expansion.",
  questions_this_creates: ["How will the IPO timeline shape priorities?"],
};

describe("buildSectionPrompt", () => {
  it("omits COMPANY INTELLIGENCE block when intel is null", () => {
    const { user } = buildSectionPrompt({ ...baseParams, companyIntel: null });
    expect(user).not.toMatch(/COMPANY INTELLIGENCE/);
  });

  it("omits COMPANY INTELLIGENCE block when intel is undefined", () => {
    const { user } = buildSectionPrompt(baseParams);
    expect(user).not.toMatch(/COMPANY INTELLIGENCE/);
  });

  it("includes intel fields when companyIntel provided", () => {
    const { user } = buildSectionPrompt({ ...baseParams, companyIntel: sampleIntel });
    expect(user).toMatch(/COMPANY INTELLIGENCE/);
    expect(user).toContain("Acme is a $3B specialty chemicals");
    expect(user).toContain("IPO filed");
    expect(user).toContain("Jane Doe");
    expect(user).toContain("PE-owned speed");
    expect(user).toContain("2027 exit");
  });

  it("system prompt mentions COMPANY INTELLIGENCE guidance", () => {
    const { system } = buildSectionPrompt({ ...baseParams, companyIntel: sampleIntel });
    expect(system).toMatch(/COMPANY INTELLIGENCE/);
  });
});
```

- [ ] **Step 4.2: Run — expect FAIL**

```bash
pnpm test src/lib/ai/prompts/section-generator.test.ts
```

Expected: tests fail (either type error because `companyIntel` arg doesn't exist, or assertions fail because intel is never rendered).

- [ ] **Step 4.3: Extend `buildSectionPrompt`**

Replace `src/lib/ai/prompts/section-generator.ts` with:

```typescript
import { prepSectionSchema } from "@/lib/ai/schemas";
import { z } from "zod";
import type { CompanyIntel } from "@/lib/ai/schemas";

// Runtime type of a PrepSection (import to reuse)
export type SectionKind =
  | "likely"
  | "deep-dive"
  | "tricky"
  | "questions-to-ask"
  | "mindset";

type SectionBrief = {
  id: string;
  title: string;
  icon: string;
  focus: string;
  num_cards: number;
};

const SECTION_BRIEFS: Record<SectionKind, SectionBrief> = {
  likely: {
    id: "likely-questions",
    title: "Likely Questions",
    icon: "💬",
    focus:
      "Core behavioral and role-fit questions an interviewer is most likely to open with. Think motivation, strengths, achievements, and a single 'tell me about yourself' angle.",
    num_cards: 3,
  },
  "deep-dive": {
    id: "deep-dive-questions",
    title: "Deep Dive Questions",
    icon: "🔍",
    focus:
      "Technical and domain-specific questions tied to the role's responsibilities. Examples: how the candidate would approach the first 90 days, complex projects they've led, decision frameworks they use.",
    num_cards: 3,
  },
  "questions-to-ask": {
    id: "questions-to-ask",
    title: "Questions to Ask the Interviewer",
    icon: "❓",
    focus:
      "Strategic questions the candidate should ask that signal research and judgement. Each card's 'question' is the candidate's question; sample_answer is coaching on WHY to ask it and what signal to listen for.",
    num_cards: 3,
  },
  "tricky": {
    id: "tricky-questions",
    title: "Tricky Questions",
    icon: "🎯",
    focus:
      "Difficult, unexpected, or stress-test questions. Examples: why leaving current role, what would you do differently from the previous person in this role, weakness with real mitigation, 'sell me this pen'-style curveballs, handling bad news or pushback. Each card must feel realistic and grounded in the candidate's actual risk areas given their CV.",
    num_cards: 3,
  },
  "mindset": {
    id: "mindset-tips",
    title: "Mindset & Tips",
    icon: "🧠",
    focus:
      "Framing, soft skills, and delivery advice specific to this candidate and role. Examples: how to frame their value vs. lower-cost candidates, pacing for a 45-minute interview, what to emphasize vs. downplay given the CV, video-call setup tips, recovery from a wobble mid-interview. Each card's 'question' is a situation/topic, 'sample_answer' is the coaching they need.",
    num_cards: 3,
  },
};

export function buildSectionPrompt(params: {
  kind: SectionKind;
  cvText: string;
  jdText: string;
  jobTitle: string;
  companyName: string;
  companyIntel?: CompanyIntel | null;
}) {
  const brief = SECTION_BRIEFS[params.kind];
  const intelBlock = params.companyIntel
    ? renderIntelBlock(params.companyIntel)
    : "";

  const intelGuidance = params.companyIntel
    ? `\n\nIf COMPANY INTELLIGENCE is provided, weave specific facts (names, dates, strategic bets) into at least 2 of your sample_answers. Do not fabricate facts beyond what is provided.`
    : "";

  const system = `You are an elite interview coach generating ONE section of a prep guide for a specific candidate applying to a specific role.

Section focus: ${brief.focus}

You MUST call the submit_section tool with exactly ${brief.num_cards} cards.

Rules per card:
- question: the likely interview question (or for "Questions to Ask", the question the candidate should ask)
- key_points: 3-4 bullets, each ≤ 15 words, that the candidate hits in their answer
- sample_answer: 3-4 sentences (60-100 words) of natural conversational scripted answer, using SPECIFIC details from the candidate's CV — company names, metrics, project titles
- tips: ONE sentence (≤ 25 words) of delivery advice
- confidence_level: "high" if CV strongly supports the answer, "medium" if partial, "low" if weak
- references_cv: 1-3 concrete CV items the answer draws from (company + year + initiative)

NEVER give generic advice. ALWAYS reference the candidate's specific experience.${intelGuidance}

Use these fixed values for the section:
- id: "${brief.id}"
- title: "${brief.title}"
- icon: "${brief.icon}"
- summary: one sentence (≤ 20 words) describing what this section covers

Call submit_section now.`;

  const user = `CANDIDATE CV:
${params.cvText}

TARGET JOB DESCRIPTION:
${params.jdText}

TARGET ROLE: ${params.jobTitle}
TARGET COMPANY: ${params.companyName}${intelBlock}`;

  return { system, user, brief };
}

function renderIntelBlock(intel: CompanyIntel): string {
  const devs = intel.recent_developments
    .map((d) => `- ${d.headline}: ${d.why_it_matters}`)
    .join("\n");
  const people = intel.key_people
    .map((p) => `- ${p.name} (${p.role}): ${p.background_snippet}`)
    .join("\n");
  const culture = intel.culture_signals.join(", ");
  return `

COMPANY INTELLIGENCE (use these specific facts in your answers):

Overview: ${intel.overview}

Recent developments:
${devs || "(none)"}

Key people:
${people || "(none)"}

Culture signals: ${culture || "(none)"}

Strategic context: ${intel.strategic_context}`;
}

export const SECTION_KINDS: SectionKind[] = [
  "likely",
  "deep-dive",
  "tricky",
  "questions-to-ask",
  "mindset",
];
```

- [ ] **Step 4.4: Run tests — expect PASS**

```bash
pnpm test
```

Expected: all 37 tests pass (33 + 4 new).

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/ai/prompts/section-generator.ts src/lib/ai/prompts/section-generator.test.ts
git commit -m "feat(ai,2c): buildSectionPrompt accepts optional companyIntel"
```

---

## Task 5: `generateCompanyIntel` (multi-turn tool-use loop)

**Files:**
- Modify: `src/lib/ai/anthropic.ts`

This is the largest single task. Multi-turn tool-use requires manually iterating until Claude either calls `submit_company_intel` or ends the loop. Anthropic's SDK does not auto-loop — the controller code does.

- [ ] **Step 5.1: Add JSON Schema for `submit_company_intel` tool**

Insert into `src/lib/ai/anthropic.ts` (after the `atsToolSchema` / `keywordItemSchema` section, before any function definitions if possible — file is already large, just keep it contiguous with other tool schemas):

```typescript
const companyIntelToolSchema = {
  type: "object" as const,
  required: [
    "overview",
    "recent_developments",
    "key_people",
    "culture_signals",
    "strategic_context",
    "questions_this_creates",
  ],
  properties: {
    overview: { type: "string" as const, minLength: 20, maxLength: 600 },
    recent_developments: {
      type: "array" as const,
      maxItems: 6,
      items: {
        type: "object" as const,
        required: ["headline", "why_it_matters"],
        properties: {
          headline: { type: "string" as const, minLength: 1, maxLength: 200 },
          why_it_matters: { type: "string" as const, minLength: 10, maxLength: 400 },
          source_url: { type: "string" as const, format: "uri" as const },
        },
      },
    },
    key_people: {
      type: "array" as const,
      maxItems: 5,
      items: {
        type: "object" as const,
        required: ["name", "role", "background_snippet"],
        properties: {
          name: { type: "string" as const, minLength: 1, maxLength: 120 },
          role: { type: "string" as const, minLength: 1, maxLength: 120 },
          background_snippet: { type: "string" as const, minLength: 1, maxLength: 400 },
        },
      },
    },
    culture_signals: {
      type: "array" as const,
      maxItems: 6,
      items: { type: "string" as const, minLength: 1, maxLength: 150 },
    },
    strategic_context: { type: "string" as const, minLength: 20, maxLength: 600 },
    questions_this_creates: {
      type: "array" as const,
      maxItems: 4,
      items: { type: "string" as const, minLength: 5, maxLength: 200 },
    },
  },
};
```

- [ ] **Step 5.2: Add MOCK_COMPANY_INTEL fixture**

Insert into `src/lib/ai/anthropic.ts` (near the other MOCK_* fixtures, before the functions that use them):

```typescript
import { companyIntelSchema, type CompanyIntel } from "@/lib/ai/schemas";

const MOCK_COMPANY_INTEL: CompanyIntel = {
  overview:
    "Mock Co is a $3B specialty chemicals company headquartered in Columbus, OH, private-equity owned by Apollo Global Management.",
  recent_developments: [
    {
      headline: "IPO filed March 2026",
      why_it_matters:
        "Signals a liquidity event — leadership is under shareholder pressure to accelerate AI and cost transformation.",
    },
    {
      headline: "New CFO appointed",
      why_it_matters:
        "Brings an ex-Goldman background; historically pushes hard on cost and margin discipline.",
    },
  ],
  key_people: [
    {
      name: "Jane Doe",
      role: "Chief Procurement Officer",
      background_snippet: "Ex-Bayer, joined 2024 to lead procurement transformation.",
    },
  ],
  culture_signals: ["fast-paced", "sponsor-owned speed", "hands-on leadership"],
  strategic_context:
    "Specialty chemicals is consolidating; the PE sponsor is targeting a 2027 exit and needs EBITDA expansion via operational efficiency.",
  questions_this_creates: [
    "How does the IPO timeline affect the procurement transformation roadmap?",
    "What are the quick wins the new CFO expects in the first 6 months?",
  ],
};
```

- [ ] **Step 5.3: Add `generateCompanyIntel` function**

Append to `src/lib/ai/anthropic.ts` (after the existing exported functions):

```typescript
/**
 * Multi-turn tool-use loop. Claude may call web_search multiple times before
 * calling submit_company_intel. We iterate, feeding tool results back as a
 * new user turn, until one of:
 *  - Claude calls submit_company_intel → validate + return CompanyIntel
 *  - Claude stops without calling the tool → return null (skipped)
 *  - Iteration cap reached → return null (skipped)
 *  - Claude errors or schema validation fails → throw ClaudeResponseError
 *
 * With MOCK_ANTHROPIC=1, returns MOCK_COMPANY_INTEL immediately. No web_search
 * call is ever made in CI.
 */
export async function generateCompanyIntel(params: {
  system: string;
  user: string;
}): Promise<CompanyIntel | null> {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return MOCK_COMPANY_INTEL;
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const start = Date.now();
  console.log("[anthropic] company-intel starting");

  const tools: Anthropic.Messages.Tool[] = [
    // Server-managed web_search tool
    {
      // @ts-expect-error Anthropic server tool not yet in SDK types
      type: "web_search_20250305",
      name: "web_search",
    } as unknown as Anthropic.Messages.Tool,
    {
      name: "submit_company_intel",
      description:
        "Submit the structured company intelligence report after research is complete.",
      input_schema: companyIntelToolSchema,
    },
  ];

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: params.user },
  ];

  const MAX_ITERATIONS = 8;
  let lastResponse: Anthropic.Messages.Message | null = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create(
      {
        model: MODEL_ID,
        max_tokens: 4000,
        system: params.system,
        messages,
        tools,
      },
      { timeout: 120_000 },
    );
    lastResponse = response;

    console.log(
      `[anthropic] company-intel turn ${i + 1} stop_reason=${response.stop_reason} output_tokens=${response.usage?.output_tokens ?? "?"}`,
    );

    // Check for submit_company_intel
    const submit = response.content.find(
      (b) => b.type === "tool_use" && b.name === "submit_company_intel",
    );
    if (submit && submit.type === "tool_use") {
      const parsed = companyIntelSchema.safeParse(submit.input);
      if (!parsed.success) {
        throw new ClaudeResponseError(
          `Company intel failed schema validation: ${parsed.error.message}`,
          dumpResponse(response),
          response.stop_reason,
        );
      }
      console.log(
        `[anthropic] company-intel completed in ${Date.now() - start}ms`,
      );
      return parsed.data;
    }

    // If Claude ended without calling submit_company_intel and isn't using
    // web_search this turn, it's done — treat as skipped.
    const webSearchCalls = response.content.filter(
      (b) => b.type === "server_tool_use" || (b.type === "tool_use" && b.name === "web_search"),
    );
    if (response.stop_reason === "end_turn" && webSearchCalls.length === 0) {
      console.warn(
        `[anthropic] company-intel ended without submit; returning null (skipped)`,
      );
      return null;
    }

    // Claude used web_search this turn — append the assistant message so the
    // next turn has the context, then continue the loop. Server-managed
    // web_search results are in the response.content; we mirror the full
    // assistant message and give Claude another user turn to continue.
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: "Continue your research, then call submit_company_intel when you have enough to write a useful report. You can skip the tool call if searches returned nothing useful — empty arrays are acceptable.",
    });
  }

  console.warn(
    `[anthropic] company-intel hit MAX_ITERATIONS without submit; returning null`,
  );
  if (lastResponse) {
    console.warn(
      `[anthropic] last stop_reason=${lastResponse.stop_reason}`,
    );
  }
  return null;
}
```

- [ ] **Step 5.4: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0. If TypeScript complains about `web_search_20250305` not being in `Anthropic.Messages.Tool`, the `@ts-expect-error` above suppresses it. If it complains about something else, read the error and adjust — likely the `tools` array type needs to be widened with `as unknown as Anthropic.Messages.Tool[]`.

- [ ] **Step 5.5: Run tests — mock path is exercised**

```bash
pnpm test
```

Expected: all 37 tests pass. No test directly exercises `generateCompanyIntel`, but the typecheck + mock fixture import proves the code is valid.

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/ai/anthropic.ts
git commit -m "feat(ai,2c): generateCompanyIntel via multi-turn tool-use + web_search"
```

---

## Task 6: Pipeline orchestrator

**Files:**
- Create: `src/lib/ai/pipeline.ts`

- [ ] **Step 6.1: Write `runPipeline`**

`src/lib/ai/pipeline.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import {
  generateCompanyIntel,
  generateSection,
  ClaudeResponseError,
} from "@/lib/ai/anthropic";
import { buildCompanyResearchPrompt } from "@/lib/ai/prompts/company-research";
import {
  buildSectionPrompt,
  SECTION_KINDS,
  type SectionKind,
} from "@/lib/ai/prompts/section-generator";
import type { CompanyIntel, PrepSection } from "@/lib/ai/schemas";

/**
 * Orchestrates the full prep generation pipeline:
 *   Stage A — Company research (optional, graceful degradation)
 *   Stage B — 5 parallel section calls enriched with intel
 *
 * Never throws — always writes a terminal status.
 */
export async function runPipeline(sessionId: string): Promise<void> {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, cv_text, job_description, job_title, company_name, generation_status",
    )
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    console.error(`[pipeline ${sessionId}] session not found`);
    return;
  }

  if (
    session.generation_status !== "pending" &&
    session.generation_status !== "failed"
  ) {
    return;
  }

  const meta = {
    role: session.job_title,
    company: session.company_name,
    estimated_prep_time_minutes: 30,
  };

  await supabase
    .from("prep_sessions")
    .update({
      generation_status: "generating",
      company_intel_status: "researching",
      error_message: null,
      company_intel: null,
      company_intel_error: null,
      prep_guide: { meta, sections: [] },
    })
    .eq("id", sessionId);

  // ---------------- Stage A: Company research ----------------
  const intel = await runStageA(sessionId, session, supabase);

  // ---------------- Stage B: 5 parallel sections ----------------
  await runStageB(sessionId, session, intel, meta, supabase);
}

async function runStageA(
  sessionId: string,
  session: {
    company_name: string;
    job_title: string;
  },
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CompanyIntel | null> {
  const prompt = buildCompanyResearchPrompt({
    companyName: session.company_name,
    jobTitle: session.job_title,
  });

  try {
    const intel = await generateCompanyIntel(prompt);
    if (intel) {
      await supabase
        .from("prep_sessions")
        .update({
          company_intel: intel,
          company_intel_status: "complete",
        })
        .eq("id", sessionId);
      return intel;
    }
    // Skipped (web_search unavailable, no submit, iteration cap)
    await supabase
      .from("prep_sessions")
      .update({ company_intel_status: "skipped" })
      .eq("id", sessionId);
    return null;
  } catch (err) {
    console.error(`[pipeline ${sessionId}] Stage A failed:`, err);
    const message = formatIntelError(err).slice(0, 8000);
    await supabase
      .from("prep_sessions")
      .update({
        company_intel_status: "failed",
        company_intel_error: message,
      })
      .eq("id", sessionId);
    return null;
  }
}

async function runStageB(
  sessionId: string,
  session: {
    cv_text: string;
    job_description: string;
    job_title: string;
    company_name: string;
  },
  intel: CompanyIntel | null,
  meta: { role: string; company: string; estimated_prep_time_minutes: number },
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  const promises = SECTION_KINDS.map((kind) => generateOne(kind, session, intel));
  const results = await Promise.allSettled(promises);

  const sections: PrepSection[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      sections.push(r.value);
    } else {
      errors.push(formatReason(r.reason));
    }
  }

  if (errors.length > 0) {
    console.error(
      `[pipeline ${sessionId}] Stage B: ${errors.length} sections failed`,
    );
    await supabase
      .from("prep_sessions")
      .update({
        generation_status: "failed",
        error_message: errors.join("\n\n---\n\n").slice(0, 8000),
      })
      .eq("id", sessionId);
    return;
  }

  await supabase
    .from("prep_sessions")
    .update({
      prep_guide: { meta, sections },
      generation_status: "complete",
      error_message: null,
    })
    .eq("id", sessionId);
}

async function generateOne(
  kind: SectionKind,
  session: {
    cv_text: string;
    job_description: string;
    job_title: string;
    company_name: string;
  },
  intel: CompanyIntel | null,
): Promise<PrepSection> {
  const { system, user } = buildSectionPrompt({
    kind,
    cvText: session.cv_text,
    jdText: session.job_description,
    jobTitle: session.job_title,
    companyName: session.company_name,
    companyIntel: intel,
  });
  return generateSection({ kind, system, user });
}

function formatReason(reason: unknown): string {
  if (reason instanceof ClaudeResponseError) {
    return `${reason.message}\n\nRAW RESPONSE:\n${reason.rawResponse}`;
  }
  if (reason instanceof Error) {
    return reason.stack ?? reason.message;
  }
  return String(reason);
}

function formatIntelError(err: unknown): string {
  if (err instanceof ClaudeResponseError) {
    return `${err.message}\n\nRAW RESPONSE:\n${err.rawResponse}`;
  }
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  return String(err);
}
```

- [ ] **Step 6.2: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 6.3: Commit**

```bash
git add src/lib/ai/pipeline.ts
git commit -m "feat(ai,2c): runPipeline orchestrator with graceful Stage A degradation"
```

---

## Task 7: Point `runGeneration` at the new pipeline

**Files:**
- Modify: `src/app/prep/new/generation.ts`

- [ ] **Step 7.1: Replace the file entirely**

`src/app/prep/new/generation.ts`:

```typescript
import { runPipeline } from "@/lib/ai/pipeline";

/**
 * Preserved as the public entry for retryPrep and createPrep. Delegates
 * to the new multi-stage pipeline.
 */
export async function runGeneration(sessionId: string): Promise<void> {
  return runPipeline(sessionId);
}
```

- [ ] **Step 7.2: Typecheck + build**

```bash
pnpm typecheck && pnpm build
```

Expected: both succeed.

- [ ] **Step 7.3: Run full test suite**

```bash
pnpm test
```

Expected: 37/37 passing. `src/app/prep/new/actions.test.ts` is unaffected (still tests the schema only).

- [ ] **Step 7.4: Commit**

```bash
git add src/app/prep/new/generation.ts
git commit -m "refactor(prep,2c): runGeneration delegates to runPipeline"
```

---

## Task 8: Expose intel in the viewer (Server Component)

**Files:**
- Modify: `src/app/prep/[id]/page.tsx`

- [ ] **Step 8.1: Update query + prop forwarding**

Read the current file first, then replace the relevant section. Full replacement:

```typescript
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  prepGuideSchema,
  atsAnalysisSchema,
  companyIntelSchema,
} from "@/lib/ai/schemas";
import { PrepGuide } from "@/components/prep/PrepGuide";
import { PrepFailed } from "@/components/prep/PrepFailed";
import { PrepSkeleton } from "@/components/prep/PrepSkeleton";
import { AtsCtaCard } from "@/components/prep/AtsCtaCard";
import { AtsScoreCard } from "@/components/prep/AtsScoreCard";
import { AtsFailed } from "@/components/prep/AtsFailed";
import { AtsSkeleton } from "@/components/prep/AtsSkeleton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("prep_sessions")
    .select("generation_status")
    .eq("id", id)
    .single();

  const isGenerating =
    data?.generation_status === "generating" ||
    data?.generation_status === "pending";

  return {
    title: "Prep — InterviewReady",
    other: isGenerating ? { "http-equiv": "refresh", content: "3" } : {},
  };
}

export default async function PrepViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string; card?: string }>;
}) {
  const { id } = await params;
  const { section, card } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, generation_status, prep_guide, error_message, ats_status, ats_analysis, ats_error_message, company_intel, company_intel_status",
    )
    .eq("id", id)
    .single();

  if (error || !session) {
    notFound();
  }

  if (
    session.generation_status === "generating" ||
    session.generation_status === "pending"
  ) {
    return <PrepSkeleton />;
  }

  if (session.generation_status === "failed") {
    return <PrepFailed id={session.id} errorMessage={session.error_message} />;
  }

  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) {
    console.error("[prep/view] stored guide failed schema:", parsed.error);
    return <PrepFailed id={session.id} errorMessage="Stored guide is malformed." />;
  }

  const intel =
    session.company_intel_status === "complete"
      ? companyIntelSchema.safeParse(session.company_intel)
      : null;
  const validIntel = intel?.success ? intel.data : null;

  const ats = renderAtsBlock(session);
  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-10">{ats}</div>
      <PrepGuide
        guide={parsed.data}
        sessionId={session.id}
        activeSectionId={section}
        activeCardId={card}
        companyIntel={validIntel}
      />
    </>
  );
}

function renderAtsBlock(session: {
  id: string;
  ats_status: string | null;
  ats_analysis: unknown;
  ats_error_message: string | null;
}) {
  if (session.ats_status === "generating") return <AtsSkeleton />;
  if (session.ats_status === "failed") {
    return <AtsFailed sessionId={session.id} errorMessage={session.ats_error_message} />;
  }
  if (session.ats_status === "complete") {
    const parsed = atsAnalysisSchema.safeParse(session.ats_analysis);
    if (!parsed.success) {
      return <AtsFailed sessionId={session.id} errorMessage="Stored analysis is malformed." />;
    }
    return <AtsScoreCard analysis={parsed.data} />;
  }
  return <AtsCtaCard sessionId={session.id} />;
}
```

- [ ] **Step 8.2: Typecheck**

```bash
pnpm typecheck
```

Expected: `PrepGuide` will complain because the prop doesn't exist yet. That's OK — Task 9 adds it. Commit this step as WIP-compatible: actually defer the commit until Task 9 is done, to keep each commit's typecheck green.

**Do NOT commit yet.** Continue to Task 9.

---

## Task 9: `PrepGuide` prepends synthetic intel tab + renders `CompanyIntelCards`

**Files:**
- Modify: `src/components/prep/PrepGuide.tsx`
- Create: `src/components/prep/CompanyIntelCards.tsx`

- [ ] **Step 9.1: Create `CompanyIntelCards`**

`src/components/prep/CompanyIntelCards.tsx`:

```typescript
"use client";

import type { CompanyIntel } from "@/lib/ai/schemas";

export function CompanyIntelCards({ intel }: { intel: CompanyIntel }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Overview">{intel.overview}</Panel>
        <Panel title="Strategic context">{intel.strategic_context}</Panel>
      </div>

      {intel.recent_developments.length > 0 && (
        <Section title="Recent developments">
          <div className="space-y-3">
            {intel.recent_developments.map((d, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <h4 className="text-sm font-semibold text-zinc-100">
                  {d.headline}
                </h4>
                <p className="mt-2 text-sm text-zinc-300">{d.why_it_matters}</p>
                {d.source_url && (
                  <a
                    href={d.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-brand hover:underline"
                  >
                    source →
                  </a>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {intel.key_people.length > 0 && (
        <Section title="Key people">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {intel.key_people.map((p, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <h4 className="text-sm font-semibold text-zinc-100">
                  {p.name}
                </h4>
                <p className="mt-1 text-xs text-zinc-400">{p.role}</p>
                <p className="mt-2 text-sm text-zinc-300">
                  {p.background_snippet}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {intel.culture_signals.length > 0 && (
        <Section title="Culture signals">
          <div className="flex flex-wrap gap-2">
            {intel.culture_signals.map((s, i) => (
              <span
                key={i}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-200"
              >
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {intel.questions_this_creates.length > 0 && (
        <Section title="Questions this creates">
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            {intel.questions_this_creates.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-200">{children}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      {children}
    </div>
  );
}
```

- [ ] **Step 9.2: Update `PrepGuide`**

`src/components/prep/PrepGuide.tsx`:

```typescript
import Link from "next/link";
import type { PrepGuide as PrepGuideType, CompanyIntel } from "@/lib/ai/schemas";
import { PrepCard } from "./PrepCard";
import { CompanyIntelCards } from "./CompanyIntelCards";

const INTEL_TAB_ID = "company-intel";

export function PrepGuide({
  guide,
  sessionId,
  activeSectionId,
  activeCardId,
  companyIntel,
}: {
  guide: PrepGuideType;
  sessionId: string;
  activeSectionId?: string;
  activeCardId?: string;
  companyIntel?: CompanyIntel | null;
}) {
  const showIntelTab = Boolean(companyIntel);

  const sectionContainingCard = activeCardId
    ? guide.sections.find((s) => s.cards.some((c) => c.id === activeCardId))
    : undefined;

  // If intel exists and no section is explicitly selected, intel is the default active tab.
  // If activeSectionId is explicitly the intel id, intel is active.
  // Otherwise, find the matching section (fallback to card's section, then first section).
  const intelIsActive =
    showIntelTab &&
    (activeSectionId === INTEL_TAB_ID || (!activeSectionId && !sectionContainingCard));

  const activeSection = intelIsActive
    ? null
    : guide.sections.find((s) => s.id === activeSectionId) ??
      sectionContainingCard ??
      guide.sections[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <div className="mb-2">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-100"
          >
            ← Back to dashboard
          </Link>
        </div>
        <h1 className="text-3xl font-semibold">
          Prep for <span className="text-brand">{guide.meta.company}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {guide.meta.role} · est. {guide.meta.estimated_prep_time_minutes} min prep
        </p>
      </header>

      <nav className="mb-8 -mx-2 flex gap-2 overflow-x-auto px-2 pb-2">
        {showIntelTab && (
          <Link
            key={INTEL_TAB_ID}
            href={`/prep/${sessionId}?section=${INTEL_TAB_ID}`}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
              intelIsActive
                ? "border-brand bg-brand text-white"
                : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            <span aria-hidden>🏢</span>
            <span>Company Intel</span>
          </Link>
        )}
        {guide.sections.map((section) => {
          const isActive = !intelIsActive && activeSection?.id === section.id;
          return (
            <Link
              key={section.id}
              href={`/prep/${sessionId}?section=${section.id}`}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                isActive
                  ? "border-brand bg-brand text-white"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              <span aria-hidden>{section.icon}</span>
              <span>{section.title}</span>
            </Link>
          );
        })}
      </nav>

      {intelIsActive && companyIntel ? (
        <section>
          <h2 className="text-xl font-semibold">
            <span className="mr-2" aria-hidden>
              🏢
            </span>
            Company Intel
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Research on {guide.meta.company} — weave these into your answers.
          </p>
          <div className="mt-6">
            <CompanyIntelCards intel={companyIntel} />
          </div>
        </section>
      ) : activeSection ? (
        <section>
          <h2 className="text-xl font-semibold">
            <span className="mr-2" aria-hidden>
              {activeSection.icon}
            </span>
            {activeSection.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{activeSection.summary}</p>

          <div className="mt-6 space-y-3">
            {activeSection.cards.map((card) => (
              <PrepCard
                key={card.id}
                card={card}
                defaultOpen={card.id === activeCardId}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 9.3: Typecheck + build**

```bash
pnpm typecheck && pnpm build
```

Expected: both succeed.

- [ ] **Step 9.4: Commit (together with Task 8's page change)**

```bash
git add src/app/prep/[id]/page.tsx src/components/prep/PrepGuide.tsx src/components/prep/CompanyIntelCards.tsx
git commit -m "feat(prep,2c): render Company Intel tab + CompanyIntelCards in viewer"
```

---

## Task 10: Update spinner copy + skeleton

**Files:**
- Modify: `src/components/prep/NewPrepForm.tsx`
- Modify: `src/components/prep/PrepSkeleton.tsx`

- [ ] **Step 10.1: Update spinner text in `NewPrepForm.tsx`**

Find the button copy and overlay messaging. Change these two strings:

- Button: `"Generating your prep… about 30 seconds"` → `"Researching company and writing your prep… about 60 seconds"`
- Overlay paragraph: `"Analyzing your CV and the job description. About 30 seconds."` → `"Researching the company, then writing your prep. About 60 seconds."`

Use Edit tool with replace_all:false, unique surrounding context.

- [ ] **Step 10.2: Update `PrepSkeleton.tsx`**

Read the file first. Add one skeleton card at the top representing the intel tab. The skeleton doesn't need to distinguish between "intel is coming" vs "intel was skipped" — it just shows a placeholder. Concrete change: prepend a skeleton block labeled with a subtle "🏢" placeholder chip.

Example minimal edit — add after the main wrapper opens, before existing section placeholders:

```tsx
<div className="mb-6 h-10 w-40 animate-pulse rounded-full bg-zinc-900" />
```

(Use what already exists in `PrepSkeleton.tsx` as a style guide — if it uses a tab strip skeleton, extend that to have 6 placeholder pills instead of 5.)

- [ ] **Step 10.3: Typecheck + build**

```bash
pnpm typecheck && pnpm build
```

- [ ] **Step 10.4: Commit**

```bash
git add src/components/prep/NewPrepForm.tsx src/components/prep/PrepSkeleton.tsx
git commit -m "feat(prep,2c): update spinner copy + skeleton for 6-tab layout"
```

---

## Task 11: E2E test

**Files:**
- Create: `tests/e2e/company-intel.spec.ts`

- [ ] **Step 11.1: Write E2E**

`tests/e2e/company-intel.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

const CV_TEXT = `Rodrigo Costa — 10 years in procurement leadership.
2019-2022 Bayer LATAM: Head of Digital Procurement Transformation.
Led $500M addressable spend rollout of e-sourcing platform across 12 countries.
Delivered 18% cost takeout and 40% cycle-time reduction over 24 months.
2022-present Private Equity portfolio CFO advisor on procurement.
Education: MBA Insead 2018.`;

const JD_TEXT = `Senior Director, AI & Digital Procurement Transformation.
Hexion is a $3B specialty chemicals company, sponsor-owned (private equity).
You will design and deploy agentic AI sourcing capability across $300M+ addressable spend.
Responsibilities include: build the target operating model, stand up an AI Center of Excellence,
deploy AI Sourcing Agents for autonomous negotiation on tail spend, and drive touchless P2P.
Qualifications: 10+ years procurement transformation, hands-on AI deployment, PE experience preferred.`;

async function signup(page: import("@playwright/test").Page) {
  const email = `e2e-intel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Intel Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  return email;
}

test("Company Intel tab renders and deep-links", async ({ page }) => {
  await signup(page);

  await page.goto("/prep/new");
  await page.getByLabel("Company").fill("Hexion");
  await page.getByLabel("Role").fill("Senior Director, AI Procurement");
  await page.getByRole("button", { name: /paste text instead/i }).click();
  await page.getByLabel("Paste your CV text").fill(CV_TEXT);
  await page.getByLabel("Job Description (paste text)").fill(JD_TEXT);
  await page.getByRole("button", { name: /generate prep guide/i }).click();

  await page.waitForURL("**/prep/**", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Prep for Hexion/i })).toBeVisible({
    timeout: 15_000,
  });

  // Company Intel tab visible
  const intelTab = page.getByRole("link", { name: /Company Intel/i });
  await expect(intelTab).toBeVisible();

  // Click it
  await intelTab.click();
  await expect(page.getByRole("heading", { name: /Company Intel/i })).toBeVisible();

  // Mock fixture renders the key fields
  await expect(page.getByText(/Mock Co is a \$3B specialty chemicals/i)).toBeVisible();
  await expect(page.getByText(/IPO filed March 2026/i)).toBeVisible();
  await expect(page.getByText(/Jane Doe/i)).toBeVisible();
  await expect(page.getByText(/sponsor-owned speed/i)).toBeVisible();
  await expect(
    page.getByText(/How does the IPO timeline affect the procurement/i),
  ).toBeVisible();

  // Deep-link works
  const url = new URL(page.url());
  url.searchParams.set("section", "company-intel");
  await page.goto(url.toString());
  await expect(page.getByRole("heading", { name: /Company Intel/i })).toBeVisible();
});
```

- [ ] **Step 11.2: Commit**

```bash
git add tests/e2e/company-intel.spec.ts
git commit -m "test(e2e,2c): Company Intel tab renders and deep-links"
```

(Do not run locally — the cvs bucket / migration requirements from #2b plus the new migration 0006 mean local Supabase doesn't have this table state. CI will run after the user applies migration 0006 post-merge.)

---

## Task 12: Migration README + PR

**Files:**
- Modify: `supabase/migrations/README.md`

- [ ] **Step 12.1: Append to README**

Read `supabase/migrations/README.md`, then add to the table:

```markdown
| 0006 | `0006_company_intel.sql` | pending |
```

And add a deploy-steps section:

```markdown
## 0006 deploy steps

1. Run `0006_company_intel.sql` in Supabase SQL Editor.
2. Verify: create a prep, watch `company_intel_status` on `prep_sessions` transition `researching → complete` (or `skipped`).
```

- [ ] **Step 12.2: Final local gate**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all green. If lint surfaces new warnings beyond the pre-existing ones (`generation.ts` unused var, `section-generator.ts` unused `z` import), fix them — they're fair game since we're touching these files.

- [ ] **Step 12.3: Commit**

```bash
git add supabase/migrations/README.md
git commit -m "docs(2c): migration 0006 deploy steps"
```

- [ ] **Step 12.4: Push + open PR**

```bash
git push -u origin pipeline-depth/2c
gh pr create --title "feat: pipeline depth — company research (#2c)" --body "$(cat <<'EOF'
## Summary
Adds a Claude + web_search_20250305 research stage before the existing 5 parallel section calls. Structured company_intel JSONB renders as a new "🏢 Company Intel" tab, and every section prompt is enriched with the intel so answers cite specific company facts. Graceful degradation — if research fails, sections still run without intel.

Spec: \`docs/superpowers/specs/2026-04-22-pipeline-depth-design.md\`
Plan: \`docs/superpowers/plans/2026-04-22-pipeline-depth.md\`

## Deploy checklist (post-merge, BEFORE CI runs E2E on main)
- [ ] Run \`supabase/migrations/0006_company_intel.sql\` in Supabase SQL Editor
- [ ] Smoke test: create a prep for a well-known company (e.g., Anthropic, Hexion). Verify Company Intel tab appears with real content in production.

## Test plan
- [x] \`pnpm typecheck\` — clean
- [x] \`pnpm test\` — 37/37 passing (new: companyIntelSchema x4, section-generator x4)
- [x] \`pnpm build\` — production build succeeds
- [ ] \`pnpm test:e2e\` — runs in CI with MOCK_ANTHROPIC=1 (mock fixture exercises intel rendering without real web_search)

## Key design choices
- Multi-turn tool-use loop in \`generateCompanyIntel\` (up to 8 turns) — differs from existing single-shot section calls because Claude needs multiple web_search calls before submitting
- \`company_intel_status\` column: pending | researching | complete | failed | skipped — "skipped" is a happy-path outcome (empty results, not an error)
- \`runGeneration\` name preserved so \`retryPrep\` and \`createPrep\` are untouched; it now delegates to \`runPipeline\`
- No caching across preps for same company — deferred to #2c-v2 if demand emerges

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 12.5: Wait for CI**

```bash
gh pr checks --watch
```

Expected: test check passes. If fails, diagnose from logs — most likely culprits are the nested-form-type issue from #2b experience (already avoided here) or a missed migration column reference.

- [ ] **Step 12.6: Merge (only after user confirms migration 0006 applied to staging Supabase)**

Per project convention, migration must be applied to staging before merge so CI E2E can pass.

```bash
gh pr merge --squash --delete-branch
```

---

## Done Criteria (from spec §13)

- [ ] Migration 0006 applied on Supabase
- [ ] Creating a prep shows updated spinner copy (~60s)
- [ ] Successful prep: 6 tabs (🏢 Company Intel + 5 sections); intel cards render overview / developments / people / culture / questions; at least 2 section sample_answers cite specific company facts
- [ ] web_search failure: 5 tabs only, no error shown to user, `company_intel_status='skipped'` in DB
- [ ] `?section=company-intel` deep link works
- [ ] All tests green; MOCK_ANTHROPIC path exercises intel rendering without real web_search
- [ ] Smoke test on Railway with a real company produces non-empty intel
