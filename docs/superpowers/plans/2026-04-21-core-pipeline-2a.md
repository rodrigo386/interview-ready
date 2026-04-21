# Core Pipeline 2a (Skinny E2E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authenticated user pastes CV + JD, single Claude Sonnet 4.6 call generates a personalized prep guide (rich JSON), persists to `prep_sessions`, renders at `/prep/[id]` as tabs + expandable cards.

**Architecture:** Next.js Server Action runs Anthropic SDK call synchronously (Railway has no serverless timeout). Zod-validated JSON output stored in `prep_sessions.prep_guide` JSONB. Viewer is a server component with `?section=<id>` query-param tab state. Failed/generating states render dedicated UI.

**Tech Stack:** Next.js 15, React 19, `@anthropic-ai/sdk`, Zod, Supabase (Postgres + RLS), Tailwind v4, Vitest, Playwright.

**Working directory:** `C:/Users/rgoal/Desktop/IAgentics/InterviewGuide` (Windows, bash).
**Branch:** `core-pipeline/2a-skinny` (already exists, spec commit `4e0d897`).
**Model:** Use `claude-sonnet-4-6` (Anthropic Sonnet 4.6 model ID per current API). If API returns a "model not found" 404, check https://docs.anthropic.com/en/docs/models-overview for the current Sonnet 4 ID and update `src/lib/ai/anthropic.ts` accordingly.

**Pre-existing state (do not regress):**
- Foundation merged in main (commit `4881182`); main has 28 commits to the current head.
- Supabase local running with migration `0001_initial.sql` applied (profiles table).
- `.env.local` points to local Supabase (`http://127.0.0.1:54321`).
- `ARCHITECTURE.md`, `docs/superpowers/specs/2026-04-21-core-pipeline-2a-design.md` exist.

**Spec reference:** `docs/superpowers/specs/2026-04-21-core-pipeline-2a-design.md`

---

## Task 1: Migration `0002_prep_sessions.sql` + apply locally

**Files:**
- Create: `supabase/migrations/0002_prep_sessions.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_prep_sessions.sql`:
```sql
CREATE TABLE public.prep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  cv_text TEXT NOT NULL,
  job_description TEXT NOT NULL,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'pt-br', 'es')),
  prep_guide JSONB,
  generation_status TEXT DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'generating', 'complete', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prep_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prep sessions"
  ON public.prep_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prep sessions"
  ON public.prep_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prep sessions"
  ON public.prep_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own prep sessions"
  ON public.prep_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_prep_sessions_user ON public.prep_sessions(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prep_sessions_touch_updated
  BEFORE UPDATE ON public.prep_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
```

- [ ] **Step 2: Apply to local Supabase**

```bash
pnpm exec supabase db reset
```
Expected: stops local stack, recreates DB, applies migrations 0001 + 0002. Final message "Finished supabase db reset on branch local."

- [ ] **Step 3: Verify table exists**

```bash
docker exec supabase_db_interview-ready psql -U postgres -d postgres -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='prep_sessions';"
```
Expected: `count = 1`.

- [ ] **Step 4: Verify RLS policies + trigger**

```bash
docker exec supabase_db_interview-ready psql -U postgres -d postgres -c "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='prep_sessions';"
```
Expected: `count = 4` (read, insert, update, delete policies).

```bash
docker exec supabase_db_interview-ready psql -U postgres -d postgres -c "SELECT tgname FROM pg_trigger WHERE tgname='prep_sessions_touch_updated';"
```
Expected: row returned with `tgname = prep_sessions_touch_updated`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_prep_sessions.sql
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(db): 0002 migration — prep_sessions table with RLS + touch trigger"
```

---

## Task 2: Install `@anthropic-ai/sdk`

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install**

```bash
pnpm add @anthropic-ai/sdk@^0.30.0
```

- [ ] **Step 2: Verify**

```bash
pnpm list @anthropic-ai/sdk
```
Expected: shows `@anthropic-ai/sdk` at version 0.30.x or higher.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "chore: add @anthropic-ai/sdk"
```

---

## Task 3: Add `ANTHROPIC_API_KEY` to env schema

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `src/lib/env.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/env.test.ts` (inside the existing `describe` block, after the other tests):

```ts
  it("exposes ANTHROPIC_API_KEY when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const { env } = await import("./env");
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-test");
  });

  it("ANTHROPIC_API_KEY is optional (undefined when unset)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { env } = await import("./env");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm test src/lib/env.test.ts
```
Expected: FAIL — `env.ANTHROPIC_API_KEY` is `undefined` (first test fails because field isn't in schema).

- [ ] **Step 3: Add field to env schema**

Edit `src/lib/env.ts`. Inside the schema, add `ANTHROPIC_API_KEY` after `NEXT_PUBLIC_APP_URL`:

```ts
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});
```

Inside `parseOrThrow()`, add the corresponding line:
```ts
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
```

Full `parseOrThrow` after edit:
```ts
function parseOrThrow(): Env {
  const result = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables. See .env.example for required keys.");
  }
  return result.data;
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
pnpm test src/lib/env.test.ts
```
Expected: PASS 4 tests.

- [ ] **Step 5: Update `.env.example`**

Append to `.env.example`:
```
# Anthropic
ANTHROPIC_API_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/env.ts src/lib/env.test.ts .env.example
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(env): add optional ANTHROPIC_API_KEY"
```

---

## Task 4: Zod schema for prep guide output

**Files:**
- Create: `src/lib/ai/schemas.ts`
- Create: `src/lib/ai/schemas.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/ai/schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { prepGuideSchema } from "./schemas";

const validCard = {
  id: "q-why-this-role",
  question: "Why are you interested in this role?",
  key_points: ["fit with CV", "growth trajectory", "company mission"],
  sample_answer:
    "I've been following the company's work on X for the last year. Given my 8 years at Y leading Z, I see strong alignment with the role's focus on...",
  tips: "Lead with a specific company fact, then tie to your experience.",
  confidence_level: "high" as const,
  references_cv: ["Y 2018-2026 — Z initiative", "published talk at W"],
};

const validSection = {
  id: "likely-questions",
  title: "Likely Questions",
  icon: "💬",
  summary: "Core behavioral and role-fit questions interviewers open with.",
  cards: [validCard],
};

const validGuide = {
  meta: { role: "Senior Director", company: "Acme", estimated_prep_time_minutes: 45 },
  sections: [validSection, validSection, validSection],
};

describe("prepGuideSchema", () => {
  it("accepts a valid guide", () => {
    expect(() => prepGuideSchema.parse(validGuide)).not.toThrow();
  });

  it("rejects guide with fewer than 3 sections", () => {
    expect(() =>
      prepGuideSchema.parse({ ...validGuide, sections: [validSection] }),
    ).toThrow();
  });

  it("rejects guide missing meta.role", () => {
    const g = JSON.parse(JSON.stringify(validGuide));
    delete g.meta.role;
    expect(() => prepGuideSchema.parse(g)).toThrow();
  });

  it("rejects card with empty key_points", () => {
    const g = JSON.parse(JSON.stringify(validGuide));
    g.sections[0].cards[0].key_points = [];
    expect(() => prepGuideSchema.parse(g)).toThrow();
  });

  it("rejects card with invalid confidence_level", () => {
    const g = JSON.parse(JSON.stringify(validGuide));
    g.sections[0].cards[0].confidence_level = "maybe";
    expect(() => prepGuideSchema.parse(g)).toThrow();
  });

  it("rejects section with zero cards", () => {
    const g = JSON.parse(JSON.stringify(validGuide));
    g.sections[0].cards = [];
    expect(() => prepGuideSchema.parse(g)).toThrow();
  });

  it("rejects sample_answer shorter than 50 chars", () => {
    const g = JSON.parse(JSON.stringify(validGuide));
    g.sections[0].cards[0].sample_answer = "Too short.";
    expect(() => prepGuideSchema.parse(g)).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail (module missing)**

```bash
pnpm test src/lib/ai/schemas.test.ts
```
Expected: FAIL — module `./schemas` not found.

- [ ] **Step 3: Implement schemas**

Create `src/lib/ai/schemas.ts`:
```ts
import { z } from "zod";

export const prepCardSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  key_points: z.array(z.string()).min(1).max(8),
  sample_answer: z.string().min(50),
  tips: z.string(),
  confidence_level: z.enum(["low", "medium", "high"]),
  references_cv: z.array(z.string()),
});

export const prepSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  icon: z.string().min(1).max(4),
  summary: z.string(),
  cards: z.array(prepCardSchema).min(1).max(10),
});

export const prepGuideSchema = z.object({
  meta: z.object({
    role: z.string().min(1),
    company: z.string().min(1),
    estimated_prep_time_minutes: z.number().int().min(10).max(180),
  }),
  sections: z.array(prepSectionSchema).min(3).max(7),
});

export type PrepGuide = z.infer<typeof prepGuideSchema>;
export type PrepSection = z.infer<typeof prepSectionSchema>;
export type PrepCard = z.infer<typeof prepCardSchema>;
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
pnpm test src/lib/ai/schemas.test.ts
```
Expected: PASS 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/schemas.ts src/lib/ai/schemas.test.ts
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(ai): Zod schema for prep guide output"
```

---

## Task 5: Prompt builder

**Files:**
- Create: `src/lib/ai/prompts/prep-generator.ts`
- Create: `src/lib/ai/prompts/prep-generator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/ai/prompts/prep-generator.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildPrepPrompt } from "./prep-generator";

describe("buildPrepPrompt", () => {
  const params = {
    cvText: "Rodrigo Costa — 10 years in procurement. Led Bayer digital transformation 2019-2022.",
    jdText: "Senior Director, AI & Digital Procurement Transformation at Hexion. $300M+ spend.",
    jobTitle: "Senior Director, AI & Digital Procurement",
    companyName: "Hexion",
  };

  it("includes CV, JD, role, and company in user message", () => {
    const { user } = buildPrepPrompt(params);
    expect(user).toContain("Rodrigo Costa");
    expect(user).toContain("Senior Director, AI & Digital Procurement Transformation at Hexion");
    expect(user).toContain("Senior Director, AI & Digital Procurement");
    expect(user).toContain("Hexion");
  });

  it("system prompt instructs JSON-only output", () => {
    const { system } = buildPrepPrompt(params);
    expect(system).toMatch(/Return ONLY the JSON object/i);
    expect(system).not.toMatch(/```json/);
  });

  it("system prompt enumerates required sections", () => {
    const { system } = buildPrepPrompt(params);
    expect(system).toContain("Likely Questions");
    expect(system).toContain("Deep Dive Questions");
    expect(system).toContain("Tricky Questions");
    expect(system).toContain("Questions to Ask");
    expect(system).toContain("Mindset & Tips");
  });

  it("system prompt forbids generic advice", () => {
    const { system } = buildPrepPrompt(params);
    expect(system).toMatch(/NEVER generic/i);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm test src/lib/ai/prompts/prep-generator.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/ai/prompts/prep-generator.ts`:
```ts
export function buildPrepPrompt(params: {
  cvText: string;
  jdText: string;
  jobTitle: string;
  companyName: string;
}) {
  const { cvText, jdText, jobTitle, companyName } = params;

  const schemaInline = `{
  "meta": {
    "role": "string",
    "company": "string",
    "estimated_prep_time_minutes": number (10-180)
  },
  "sections": [
    {
      "id": "kebab-case-id",
      "title": "string",
      "icon": "string (single emoji)",
      "summary": "string (one-line description of what this section covers)",
      "cards": [
        {
          "id": "kebab-case-id",
          "question": "string (likely interview question)",
          "key_points": ["3-5 bullet points the candidate should hit in their answer"],
          "sample_answer": "string (a complete, natural-sounding scripted answer the candidate can practice, using THEIR SPECIFIC experience and metrics)",
          "tips": "string (1-2 sentences of delivery advice)",
          "confidence_level": "low" | "medium" | "high",
          "references_cv": ["list of specific CV items this answer draws from"]
        }
      ]
    }
  ]
}`;

  const system = `You are an elite interview coach preparing a candidate for a specific role at a specific company. Your job: analyze the candidate's CV + the target JD, then produce a hyper-personalized prep guide as JSON.

Your output MUST match this JSON schema exactly (no markdown fences, no preamble, no trailing commentary — pure JSON):

${schemaInline}

Generate 4-5 sections using these EXACT titles:
- "Likely Questions" — core behavioral + role-fit questions
- "Deep Dive Questions" — technical/domain questions specific to the role
- "Tricky Questions" — difficult, unexpected, or stress-test questions
- "Questions to Ask the Interviewer" — strategic, research-signaling questions
- "Mindset & Tips" — framing + soft skills + delivery guidance

4-6 cards per section.

CRITICAL RULES:
- NEVER generic advice. EVERY sample_answer must reference the candidate's SPECIFIC experience: company names, project titles, metrics, team sizes, dates.
- ALWAYS connect CV experience to JD requirements.
- sample_answer is a COMPLETE scripted answer (multiple sentences, natural speech cadence), not bullet points.
- key_points are the checklist the candidate mentally reviews before answering.
- confidence_level reflects how strongly the candidate's CV supports the answer: "high" = strong CV evidence, "medium" = some relevant experience, "low" = weak CV fit, answer with care.
- references_cv lists concrete CV items the answer uses (e.g., company name + year + initiative).
- All content in English.
- Return ONLY the JSON object. No markdown code fences. No explanation before or after.`;

  const user = `CANDIDATE CV:
${cvText}

TARGET JOB DESCRIPTION:
${jdText}

TARGET ROLE: ${jobTitle}
TARGET COMPANY: ${companyName}

Generate the prep guide now.`;

  return { system, user };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm test src/lib/ai/prompts/prep-generator.test.ts
```
Expected: PASS 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/prompts/prep-generator.ts src/lib/ai/prompts/prep-generator.test.ts
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(ai): prep-generator prompt builder with unit tests"
```

---

## Task 6: Anthropic client with mock support

**Files:**
- Create: `src/lib/ai/anthropic.ts`

- [ ] **Step 1: Create client**

Create `src/lib/ai/anthropic.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { PrepGuide } from "./schemas";

/**
 * When MOCK_ANTHROPIC=1 (CI + local dev without key), returns a fake client
 * whose messages.create resolves with a canned valid PrepGuide.
 */

const MOCK_PREP_GUIDE: PrepGuide = {
  meta: {
    role: "Mock Role",
    company: "Mock Co",
    estimated_prep_time_minutes: 30,
  },
  sections: [
    {
      id: "likely-questions",
      title: "Likely Questions",
      icon: "💬",
      summary: "Core behavioral and role-fit questions.",
      cards: [
        {
          id: "why-this-role",
          question: "Why are you interested in this role?",
          key_points: [
            "Fit with CV and specific experience",
            "Company mission alignment",
            "Growth trajectory in the role",
          ],
          sample_answer:
            "I've been following Mock Co's work for the last year. Given my experience leading procurement transformation at Prior Co, I see strong alignment with the role's focus on AI-native sourcing. In particular, the addressable spend scale matches what I've delivered before, and the three-pillar operating model excites me.",
          tips: "Lead with a specific company fact, then tie to your experience.",
          confidence_level: "high",
          references_cv: ["Prior Co 2019-2022 digital transformation"],
        },
        {
          id: "greatest-achievement",
          question: "What's your greatest professional achievement?",
          key_points: ["STAR format", "Quantified impact", "Personal role"],
          sample_answer:
            "At Prior Co I led a digital procurement transformation that cut cycle time by 40% and saved $30M over two years. My role was defining the target operating model and leading the rollout across LATAM.",
          tips: "Use STAR. End with the metric.",
          confidence_level: "high",
          references_cv: ["Prior Co $30M savings", "LATAM rollout 2020-2022"],
        },
        {
          id: "biggest-failure",
          question: "Tell me about a time you failed.",
          key_points: ["Real failure", "Lesson learned", "What you'd do differently"],
          sample_answer:
            "Early in my time at Prior Co I pushed a central sourcing model too aggressively without piloting. Adoption stalled. I pulled back, ran a 90-day pilot with one BU, incorporated the feedback, and relaunched — ending at 85% adoption.",
          tips: "Own the failure. Don't blame the team.",
          confidence_level: "medium",
          references_cv: ["Prior Co central sourcing pilot"],
        },
        {
          id: "strengths",
          question: "What are your key strengths?",
          key_points: ["Technical + soft split", "Backed by examples", "Role-relevant"],
          sample_answer:
            "Two strengths: first, connecting digital capability to business outcome — I don't just deploy tools, I redesign processes so the tools actually deliver value. Second, cross-functional leadership — I've led teams spanning finance, IT, and operations on $100M+ initiatives.",
          tips: "Pick two, not five.",
          confidence_level: "high",
          references_cv: ["Prior Co cross-functional leadership"],
        },
      ],
    },
    {
      id: "deep-dive",
      title: "Deep Dive Questions",
      icon: "🔍",
      summary: "Technical and domain questions.",
      cards: [
        {
          id: "deep-1",
          question: "How would you approach the first 90 days in this role?",
          key_points: ["Listen/observe/design cadence", "Stakeholder map", "Early wins"],
          sample_answer:
            "First 30 days, I would run a listening tour with the top 20 stakeholders and review the current spend baseline. Days 31-60, I'd draft the target operating model and identify 2-3 early wins (like automating tail spend in one category). Days 61-90, I'd pilot one capability and start the hiring plan for the Agile Pods.",
          tips: "Show a structured cadence, not just activities.",
          confidence_level: "high",
          references_cv: ["Prior Co 90-day plan template"],
        },
        {
          id: "deep-2",
          question: "Walk me through a complex procurement transformation you led.",
          key_points: ["Starting baseline", "Strategic choices", "Execution challenges", "Results"],
          sample_answer:
            "At Prior Co, we had a fragmented sourcing function across 12 LATAM countries with $500M in addressable spend and no central data. I led a 24-month transformation. Key choices: consolidated 4 ERP instances, built a central COE, deployed an e-sourcing platform. Biggest challenge: change management with country GMs who owned the spend. We overcame it with quarterly value-share reviews. Result: 18% cost takeout, 40% cycle time reduction.",
          tips: "Narrative arc — baseline, bet, execution, result.",
          confidence_level: "high",
          references_cv: ["Prior Co LATAM transformation"],
        },
        {
          id: "deep-3",
          question: "How do you measure success for an AI-driven procurement team?",
          key_points: ["Value metrics", "Adoption metrics", "Quality metrics"],
          sample_answer:
            "Three layers. Value: $ savings per requisition, cycle time, touchless P2P rate. Adoption: % of spend running through AI sourcing agents, stakeholder NPS. Quality: risk coverage, compliance audit findings. I tie team bonus to the value layer.",
          tips: "Avoid vanity metrics.",
          confidence_level: "medium",
          references_cv: ["Prior Co KPI framework"],
        },
        {
          id: "deep-4",
          question: "Describe your approach to building an AI-native team.",
          key_points: ["Hybrid skills", "Career paths", "Hiring principles"],
          sample_answer:
            "I build for hybrid skills — procurement domain knowledge plus AI fluency. I've created career pathways for three archetypes: category managers who upskill on AI tools, data scientists embedded in pods, and platform engineers for the P2P backbone. Hiring principle: curiosity over credentials.",
          tips: "Show the org chart thinking.",
          confidence_level: "medium",
          references_cv: ["Prior Co talent model"],
        },
      ],
    },
    {
      id: "tricky-questions",
      title: "Tricky Questions",
      icon: "🎯",
      summary: "Stress-test and unexpected questions.",
      cards: [
        {
          id: "tricky-1",
          question: "Why are you leaving your current role?",
          key_points: ["Forward-looking", "No blame", "Tie to new role"],
          sample_answer:
            "I've built what I wanted to build at Prior Co. The next chapter I'm chasing is AI-native transformation at scale, which is exactly what this role is about. Prior Co's next wave is operational optimization, and that's a different challenge than the one I want.",
          tips: "Never bad-mouth. Always forward.",
          confidence_level: "medium",
          references_cv: [],
        },
        {
          id: "tricky-2",
          question: "Our last director didn't work out. What would be different about you?",
          key_points: ["Humility", "Specific capability gaps you'd fill", "Collaboration style"],
          sample_answer:
            "I can't know what didn't work without more context, but what I'd bring: a clear 90-day plan, explicit stakeholder contracts on day 30, and a bias toward quick pilots over big launches. If there were execution challenges, that's my wheelhouse.",
          tips: "Show self-awareness. Don't overpromise.",
          confidence_level: "medium",
          references_cv: ["Prior Co 90-day plan template"],
        },
        {
          id: "tricky-3",
          question: "What's your weakness?",
          key_points: ["Real weakness", "Active mitigation", "Not a humble-brag"],
          sample_answer:
            "I tend to over-invest in building consensus before deciding. I've mitigated it by giving myself a decision deadline on key calls — if I don't have 80% alignment in two weeks, I decide and move. It's made me faster.",
          tips: "Pick one real thing. Show the mitigation.",
          confidence_level: "medium",
          references_cv: [],
        },
      ],
    },
    {
      id: "questions-to-ask",
      title: "Questions to Ask the Interviewer",
      icon: "❓",
      summary: "Strategic questions that signal research and judgment.",
      cards: [
        {
          id: "q-ask-1",
          question: "What does success look like in the first 12 months of this role?",
          key_points: ["Sets the bar", "Shows goal orientation"],
          sample_answer:
            "A great opener. Follow up with: 'And what are the blockers you foresee to getting there?'",
          tips: "Always follow up with the blockers question.",
          confidence_level: "high",
          references_cv: [],
        },
        {
          id: "q-ask-2",
          question: "How does the AI + Digital Procurement team interface with Finance and IT?",
          key_points: ["Reveals org dynamics", "Specific to role"],
          sample_answer:
            "Listen for: is Procurement a cost center or a strategic function? Does IT have budget authority over tools? This tells you how much runway you'll have.",
          tips: "Good intel question.",
          confidence_level: "high",
          references_cv: [],
        },
        {
          id: "q-ask-3",
          question: "What's the board's view on AI investment in non-core functions?",
          key_points: ["Shows strategic awareness", "Gauges exec support"],
          sample_answer:
            "This signals you think at the investment-committee level. Good for final-round questions.",
          tips: "Save for final round.",
          confidence_level: "medium",
          references_cv: [],
        },
      ],
    },
    {
      id: "mindset",
      title: "Mindset & Tips",
      icon: "🧠",
      summary: "Framing and delivery advice.",
      cards: [
        {
          id: "mindset-1",
          question: "How to frame your value vs. lower-cost candidates",
          key_points: ["Lead with outcomes", "Speed-to-value", "Risk-adjusted"],
          sample_answer:
            "You're more expensive than a newly-promoted director. Your case: you've done this transformation before, you can de-risk the first 12 months, and your pattern library means no 3-month ramp. Quantify it: 'I'm effectively 6 months of execution you don't have to pay for.'",
          tips: "Own the premium.",
          confidence_level: "high",
          references_cv: ["Prior Co transformation experience"],
        },
        {
          id: "mindset-2",
          question: "Pacing for a 45-minute interview",
          key_points: ["STAR tight", "Buy time with a framework", "Mind the clock"],
          sample_answer:
            "Keep each STAR under 90 seconds. When you need a moment, say 'Let me frame this with three angles' — gives you time to think. Leave 5 minutes for your questions.",
          tips: "Practice your two best STARs out loud.",
          confidence_level: "medium",
          references_cv: [],
        },
        {
          id: "mindset-3",
          question: "What to wear / set up (video)",
          key_points: ["Ring light", "Camera height", "Plain background"],
          sample_answer:
            "Camera at eye level, ring light in front, plain wall or bookshelf behind. Business casual. Test Zoom and have a backup on phone.",
          tips: "Test the setup 30 min before.",
          confidence_level: "high",
          references_cv: [],
        },
      ],
    },
  ],
};

export async function createPrepGuide(params: {
  system: string;
  user: string;
}): Promise<string> {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return JSON.stringify(MOCK_PREP_GUIDE);
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: params.system,
    messages: [{ role: "user", content: params.user }],
  });

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/anthropic.ts
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(ai): Anthropic client with MOCK_ANTHROPIC fixture"
```

---

## Task 7: Server Action `createPrep`

**Files:**
- Create: `src/app/prep/new/actions.ts`

- [ ] **Step 1: Implement**

Create `src/app/prep/new/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildPrepPrompt } from "@/lib/ai/prompts/prep-generator";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { createPrepGuide } from "@/lib/ai/anthropic";

const formSchema = z.object({
  jobTitle: z.string().min(2, "Job title is required").max(120),
  companyName: z.string().min(2, "Company name is required").max(120),
  cvText: z
    .string()
    .min(200, "Paste a longer CV — at least 200 characters"),
  jobDescription: z
    .string()
    .min(200, "Paste a longer job description — at least 200 characters"),
});

export type CreatePrepState = { error?: string };

export async function createPrep(
  _prev: CreatePrepState,
  formData: FormData,
): Promise<CreatePrepState> {
  const parsed = formSchema.safeParse({
    jobTitle: formData.get("jobTitle"),
    companyName: formData.get("companyName"),
    cvText: formData.get("cvText"),
    jobDescription: formData.get("jobDescription"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to create a prep." };

  const { data: session, error: insertError } = await supabase
    .from("prep_sessions")
    .insert({
      user_id: user.id,
      job_title: parsed.data.jobTitle,
      company_name: parsed.data.companyName,
      cv_text: parsed.data.cvText,
      job_description: parsed.data.jobDescription,
      generation_status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !session) {
    console.error("[createPrep] insert failed:", insertError);
    return {
      error: "Could not save your prep session. Please try again.",
    };
  }

  try {
    const { system, user: userMsg } = buildPrepPrompt({
      cvText: parsed.data.cvText,
      jdText: parsed.data.jobDescription,
      jobTitle: parsed.data.jobTitle,
      companyName: parsed.data.companyName,
    });

    const rawText = await createPrepGuide({ system, user: userMsg });

    // Strip fences if Claude added any, then parse + validate.
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const parsedJson = JSON.parse(jsonText);
    const validated = prepGuideSchema.parse(parsedJson);

    await supabase
      .from("prep_sessions")
      .update({
        prep_guide: validated,
        generation_status: "complete",
      })
      .eq("id", session.id);
  } catch (err) {
    console.error("[createPrep] generation failed:", err);
    const message =
      err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
    await supabase
      .from("prep_sessions")
      .update({
        generation_status: "failed",
        error_message: message,
      })
      .eq("id", session.id);
  }

  redirect(`/prep/${session.id}`);
}

export async function deleteFailedPrep(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("prep_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  redirect("/prep/new");
}
```

- [ ] **Step 2: Typecheck + build**

```bash
pnpm typecheck && pnpm build
```
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add "src/app/prep/new/actions.ts"
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(prep): createPrep + deleteFailedPrep Server Actions"
```

---

## Task 8: `/prep/new` page + NewPrepForm component

**Files:**
- Create: `src/app/prep/new/page.tsx`
- Create: `src/components/prep/NewPrepForm.tsx`

- [ ] **Step 1: Create form client component**

Create `src/components/prep/NewPrepForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPrep, type CreatePrepState } from "@/app/prep/new/actions";

export function NewPrepForm() {
  const [state, formAction, pending] = useActionState<CreatePrepState, FormData>(
    createPrep,
    {},
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="companyName" className="block text-sm text-zinc-300">
            Company
          </label>
          <Input
            id="companyName"
            name="companyName"
            placeholder="Acme Corp"
            required
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="jobTitle" className="block text-sm text-zinc-300">
            Role
          </label>
          <Input
            id="jobTitle"
            name="jobTitle"
            placeholder="Senior Director, AI Procurement"
            required
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <label htmlFor="cvText" className="block text-sm text-zinc-300">
          Your CV (paste text)
        </label>
        <textarea
          id="cvText"
          name="cvText"
          rows={12}
          required
          minLength={200}
          placeholder="Paste your CV text here. More detail = better prep (aim for 500+ words)."
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <div>
        <label htmlFor="jobDescription" className="block text-sm text-zinc-300">
          Job Description (paste text)
        </label>
        <textarea
          id="jobDescription"
          name="jobDescription"
          rows={12}
          required
          minLength={200}
          placeholder="Paste the full job description here."
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Generating your prep… about 30 seconds" : "Generate prep guide"}
      </Button>

      {pending && (
        <p className="text-center text-xs text-zinc-500">
          You can stay on this page. We&apos;ll redirect you when it&apos;s ready.
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Create page**

Create `src/app/prep/new/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPrepForm } from "@/components/prep/NewPrepForm";

export default async function NewPrepPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-400 hover:text-zinc-100"
        >
          ← Back to dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-semibold">Create a prep guide</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Paste your CV and the job description. Takes about 30 seconds.
      </p>

      <div className="mt-10">
        <NewPrepForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build + dev-server smoke**

```bash
pnpm build
```
Expected: `/prep/new` appears in the route list and build succeeds.

Start dev server briefly and load the page:
```bash
pnpm dev &
DEV_PID=$!
sleep 10
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/prep/new
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
```
Expected: 307 (redirect to login) — form is auth-gated.

- [ ] **Step 4: Commit**

```bash
git add "src/app/prep/new/page.tsx" src/components/prep/NewPrepForm.tsx
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(prep): /prep/new page with NewPrepForm"
```

---

## Task 9: PrepSkeleton + PrepFailed components

**Files:**
- Create: `src/components/prep/PrepSkeleton.tsx`
- Create: `src/components/prep/PrepFailed.tsx`

- [ ] **Step 1: PrepSkeleton**

Create `src/components/prep/PrepSkeleton.tsx`:
```tsx
export function PrepSkeleton() {
  return (
    <>
      {/* Auto-refresh page every 3s until generation_status changes */}
      <meta httpEquiv="refresh" content="3" />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-brand" />
            <p className="text-sm text-zinc-300">Generating your prep guide…</p>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Takes about 30 seconds. You can close this tab and come back.
          </p>
        </div>

        <div className="mt-10 space-y-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/40"
            />
          ))}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: PrepFailed**

Create `src/components/prep/PrepFailed.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { deleteFailedPrep } from "@/app/prep/new/actions";

export function PrepFailed({
  id,
  errorMessage,
}: {
  id: string;
  errorMessage: string | null;
}) {
  const deleteAction = deleteFailedPrep.bind(null, id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-lg border border-red-900 bg-red-950/30 p-6">
        <h1 className="text-xl font-semibold text-red-200">
          We couldn&apos;t generate your prep.
        </h1>
        <p className="mt-2 text-sm text-red-300">
          Something went wrong while calling the AI. Try again in a moment.
        </p>
        {errorMessage && (
          <pre className="mt-4 overflow-x-auto rounded bg-black/40 p-3 font-mono text-xs text-red-300">
            {errorMessage}
          </pre>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <form action={deleteAction}>
          <Button type="submit">Delete and try again</Button>
        </form>
        <Link href="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/prep/PrepSkeleton.tsx src/components/prep/PrepFailed.tsx
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(prep): PrepSkeleton + PrepFailed components"
```

---

## Task 10: PrepCard (client, expandable)

**Files:**
- Create: `src/components/prep/PrepCard.tsx`

- [ ] **Step 1: Implement**

Create `src/components/prep/PrepCard.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { PrepCard as PrepCardType } from "@/lib/ai/schemas";

const CONFIDENCE_STYLES: Record<PrepCardType["confidence_level"], string> = {
  high: "bg-emerald-950/40 text-emerald-300 border-emerald-900",
  medium: "bg-amber-950/40 text-amber-300 border-amber-900",
  low: "bg-red-950/40 text-red-300 border-red-900",
};

export function PrepCard({ card }: { card: PrepCardType }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-4 p-5 text-left hover:bg-zinc-900/60"
        aria-expanded={open}
      >
        <div className="flex-1">
          <h3 className="text-base font-medium text-zinc-100">{card.question}</h3>
          <span
            className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${CONFIDENCE_STYLES[card.confidence_level]}`}
          >
            {card.confidence_level} confidence
          </span>
        </div>
        <span className="mt-1 text-zinc-500" aria-hidden>
          {open ? "–" : "+"}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-zinc-800 px-5 py-5">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Key points
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
              {card.key_points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Sample answer
            </h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {card.sample_answer}
            </p>
          </section>

          {card.tips && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Tips
              </h4>
              <p className="mt-2 text-sm italic text-zinc-300">{card.tips}</p>
            </section>
          )}

          {card.references_cv.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Draws from your CV
              </h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {card.references_cv.map((r, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/prep/PrepCard.tsx
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(prep): PrepCard expandable component"
```

---

## Task 11: PrepGuide (server, tabs + sections)

**Files:**
- Create: `src/components/prep/PrepGuide.tsx`

- [ ] **Step 1: Implement**

Create `src/components/prep/PrepGuide.tsx`:
```tsx
import Link from "next/link";
import type { PrepGuide as PrepGuideType } from "@/lib/ai/schemas";
import { PrepCard } from "./PrepCard";

export function PrepGuide({
  guide,
  sessionId,
  activeSectionId,
}: {
  guide: PrepGuideType;
  sessionId: string;
  activeSectionId?: string;
}) {
  const active =
    guide.sections.find((s) => s.id === activeSectionId) ?? guide.sections[0];

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
        {guide.sections.map((section) => {
          const isActive = section.id === active.id;
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

      <section>
        <h2 className="text-xl font-semibold">
          <span className="mr-2" aria-hidden>
            {active.icon}
          </span>
          {active.title}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">{active.summary}</p>

        <div className="mt-6 space-y-3">
          {active.cards.map((card) => (
            <PrepCard key={card.id} card={card} />
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + build**

```bash
pnpm typecheck && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/prep/PrepGuide.tsx
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(prep): PrepGuide server component with tabs + sections"
```

---

## Task 12: `/prep/[id]` viewer page

**Files:**
- Create: `src/app/prep/[id]/page.tsx`

- [ ] **Step 1: Implement**

Create `src/app/prep/[id]/page.tsx`:
```tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { PrepGuide } from "@/components/prep/PrepGuide";
import { PrepFailed } from "@/components/prep/PrepFailed";
import { PrepSkeleton } from "@/components/prep/PrepSkeleton";

export default async function PrepViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { section } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select("id, generation_status, prep_guide, error_message")
    .eq("id", id)
    .single();

  if (error || !session) {
    notFound();
  }

  if (session.generation_status === "generating" || session.generation_status === "pending") {
    return <PrepSkeleton />;
  }

  if (session.generation_status === "failed") {
    return <PrepFailed id={session.id} errorMessage={session.error_message} />;
  }

  // complete
  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) {
    console.error("[prep/view] stored guide failed schema:", parsed.error);
    return <PrepFailed id={session.id} errorMessage="Stored guide is malformed." />;
  }

  return (
    <PrepGuide
      guide={parsed.data}
      sessionId={session.id}
      activeSectionId={section}
    />
  );
}
```

- [ ] **Step 2: Typecheck + build**

```bash
pnpm typecheck && pnpm build
```
Expected: `/prep/[id]` appears as dynamic route.

- [ ] **Step 3: Commit**

```bash
git add "src/app/prep/[id]/page.tsx"
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(prep): /prep/[id] viewer with state-based rendering"
```

---

## Task 13: Update Dashboard with session list + real "New prep" CTA

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Replace page content**

Overwrite `src/app/dashboard/page.tsx`:
```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";

type SessionRow = {
  id: string;
  company_name: string;
  job_title: string;
  generation_status: string;
  created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  complete: "bg-emerald-950/40 text-emerald-300 border-emerald-900",
  generating: "bg-amber-950/40 text-amber-300 border-amber-900",
  pending: "bg-amber-950/40 text-amber-300 border-amber-900",
  failed: "bg-red-950/40 text-red-300 border-red-900",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // layout already redirects

  const { data: sessions } = await supabase
    .from("prep_sessions")
    .select("id, company_name, job_title, generation_status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const list: SessionRow[] = sessions ?? [];

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-zinc-900 p-4 text-4xl">✨</div>
        <h1 className="mt-6 text-2xl font-semibold">Create your first prep</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          Upload your CV and paste a job description — we&apos;ll generate
          a personalized interview playbook in about 30 seconds.
        </p>
        <Link href="/prep/new" className="mt-8">
          <Button>New prep</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your preps</h1>
        <Link href="/prep/new">
          <Button>New prep</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {list.map((s) => (
          <Link
            key={s.id}
            href={`/prep/${s.id}`}
            className="block rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-medium">{s.company_name}</h2>
                <p className="mt-1 truncate text-sm text-zinc-400">{s.job_title}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[s.generation_status] ?? ""}`}
              >
                {s.generation_status}
              </span>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              {new Date(s.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

```bash
pnpm typecheck && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat(dashboard): list prep sessions + real New prep CTA"
```

---

## Task 14: Playwright E2E with MOCK_ANTHROPIC

**Files:**
- Create: `tests/e2e/prep.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Ensure local Supabase + dev build + MOCK_ANTHROPIC available**

```bash
pnpm exec supabase status
```
Expected: running. If not: `pnpm exec supabase start`.

Confirm the auto-confirm-off toggle is still in `supabase/config.toml` (`[auth.email]` has `enable_confirmations = false`).

- [ ] **Step 2: Add MOCK_ANTHROPIC to playwright.config.ts webServer env**

Open `playwright.config.ts`. If it has `webServer: { env: { ... } }`, add `MOCK_ANTHROPIC: "1"`. If there's no `webServer`, add:

```ts
  webServer: {
    command: "pnpm start",
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      MOCK_ANTHROPIC: "1",
    },
  },
```

If `webServer` block already exists (from earlier Foundation work), just add `MOCK_ANTHROPIC: "1"` to its `env` map.

- [ ] **Step 3: Write E2E test**

Create `tests/e2e/prep.spec.ts`:
```ts
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

test("signup + create prep + view prep guide", async ({ page }) => {
  const email = `e2e-prep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  // Signup
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Prep Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  // Click New prep
  await page.getByRole("link", { name: /new prep/i }).first().click();
  await page.waitForURL("**/prep/new");
  await expect(page.getByRole("heading", { name: /create a prep guide/i })).toBeVisible();

  // Fill form
  await page.getByLabel("Company").fill("Hexion");
  await page.getByLabel("Role").fill("Senior Director, AI Procurement");
  await page.getByLabel("Your CV (paste text)").fill(CV_TEXT);
  await page.getByLabel("Job Description (paste text)").fill(JD_TEXT);

  // Submit
  await page.getByRole("button", { name: /generate prep guide/i }).click();

  // Wait for redirect to /prep/[id] — MOCK_ANTHROPIC returns instantly
  await page.waitForURL("**/prep/**", { timeout: 20_000 });

  // Assert guide rendered
  await expect(page.getByRole("heading", { name: /Prep for Mock Co/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Likely Questions")).toBeVisible();

  // Expand a card
  await page
    .getByRole("button", { name: /why are you interested in this role/i })
    .click();
  await expect(page.getByText("Key points")).toBeVisible();
  await expect(page.getByText("Sample answer")).toBeVisible();
});
```

- [ ] **Step 4: Run the test locally**

```bash
pnpm build
MOCK_ANTHROPIC=1 pnpm test:e2e -- tests/e2e/prep.spec.ts
```
Expected: PASS 1 test in ~10-15 seconds.

If the test fails waiting for the dashboard, verify:
- Local Supabase is up (`pnpm exec supabase status`)
- Migration `0002` is applied (`docker exec supabase_db_interview-ready psql -U postgres -d postgres -c "\dt public.*"` — should list `prep_sessions`)

- [ ] **Step 5: Verify foundation auth test still passes**

```bash
MOCK_ANTHROPIC=1 pnpm test:e2e
```
Expected: both `auth.spec.ts` and `prep.spec.ts` pass.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/prep.spec.ts playwright.config.ts
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "test(e2e): prep creation flow with MOCK_ANTHROPIC"
```

---

## Task 15: Update CI workflow with MOCK_ANTHROPIC

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `MOCK_ANTHROPIC` env to CI job**

Open `.github/workflows/ci.yml`. In the `test` job's `env:` block (sibling of `runs-on`), add:
```yaml
      MOCK_ANTHROPIC: "1"
```

After edit, the env block should look like:
```yaml
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.STAGING_SUPABASE_SERVICE_ROLE_KEY }}
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      MOCK_ANTHROPIC: "1"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "ci: set MOCK_ANTHROPIC=1 so e2e prep test doesn't call the real API"
```

---

## Task 16: Deploy prep to production

This task is **manual + code-free**. Execute these steps in the order listed.

- [ ] **Step 1: Push branch and open PR**

```bash
git push -u origin core-pipeline/2a-skinny
gh pr create --title "Core Pipeline 2a: skinny E2E prep generation" \
  --body "$(cat <<'EOF'
## Summary

Sub-project #2a of Core Pipeline — the skinny vertical slice.

- User pastes CV + JD → single Claude Sonnet 4.6 call → rich JSON prep guide → persisted + rendered
- New table `prep_sessions` with RLS
- New routes: `/prep/new`, `/prep/[id]`
- Dashboard upgraded to list prep sessions
- Zod-validated prep output schema
- Playwright E2E with MOCK_ANTHROPIC fixture

## Out of scope (future slices)

- PDF/DOCX upload → 2b
- 3-stage pipeline (CV analyzer + company research via web_search + prep generator) → 2c
- ATS gap analyzer → 2d

## Test plan

- [x] Unit tests (Vitest) pass for schema + prompt builder + env
- [x] E2E Playwright passes (signup + create prep + view + expand card)
- [ ] Apply migration `0002_prep_sessions.sql` to production Supabase
- [ ] Add `ANTHROPIC_API_KEY` to Railway variables
- [ ] Add `STAGING_ANTHROPIC_API_KEY` to GitHub secrets (can use same key for now)
- [ ] Verify CI green
- [ ] Manual smoke in production: create 1 prep end-to-end

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Add `STAGING_ANTHROPIC_API_KEY` to GitHub Secrets**

Although CI uses `MOCK_ANTHROPIC=1` (doesn't call the real API), add the secret anyway so future real-API tests are unblocked. Use the same key from Anthropic Console or create a dev key.

In bash:
```bash
# Replace <YOUR_KEY> with your Anthropic API key (keep it out of shell history).
read -s ANTHROPIC_KEY
gh secret set STAGING_ANTHROPIC_API_KEY --repo rodrigo386/interview-ready --body "$ANTHROPIC_KEY"
unset ANTHROPIC_KEY
```

- [ ] **Step 3: Wait for CI green on the PR**

```bash
gh pr checks --repo rodrigo386/interview-ready --watch
```
Expected: all checks pass.

- [ ] **Step 4: Apply migration `0002` to production Supabase**

In a browser, go to https://supabase.com/dashboard/project/reslmtzofwczxrswulca → SQL Editor → New query → paste the contents of `supabase/migrations/0002_prep_sessions.sql` → Run.

Verify the table exists (same SQL Editor):
```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name='prep_sessions';
```
Expected: `1`.

```sql
SELECT count(*) FROM pg_policies
WHERE schemaname='public' AND tablename='prep_sessions';
```
Expected: `4`.

- [ ] **Step 5: Set `ANTHROPIC_API_KEY` in Railway**

Railway dashboard → service → Variables → **New Variable**:
- Name: `ANTHROPIC_API_KEY`
- Value: your Anthropic API key (real, production)

Railway will trigger a redeploy automatically when the variable changes.

- [ ] **Step 6: Merge PR**

```bash
gh pr merge --repo rodrigo386/interview-ready --merge --delete-branch
git checkout main
git pull origin main
git branch -d core-pipeline/2a-skinny
```

- [ ] **Step 7: Wait for Railway to deploy `main`**

```bash
until [ "$(curl -sS -o /dev/null -w "%{http_code}" https://interview-ready-production.up.railway.app/dashboard)" = "307" ]; do sleep 20; done
echo "Deploy rolled out"
```

- [ ] **Step 8: Production smoke test**

In a browser:
1. Open https://interview-ready-production.up.railway.app
2. Sign in with an existing test account (or create one via `/signup`)
3. Click "New prep"
4. Paste sample CV (use your own CV or the one from `tests/e2e/prep.spec.ts`)
5. Paste a real JD
6. Submit and wait ~30 seconds
7. Verify you land on `/prep/[id]` with a rendered guide
8. Expand a card and verify `key_points`, `sample_answer`, `tips`, `references_cv` all render
9. Go back to `/dashboard` → confirm the session is listed

- [ ] **Step 9: Tag release**

```bash
git tag -a core-pipeline-2a-v1 -m "Core Pipeline 2a (skinny E2E) complete

- Single-call Claude Sonnet 4.6 prep generator
- prep_sessions table with RLS
- /prep/new form + /prep/[id] viewer (tabs + expandable cards)
- Dashboard lists sessions
- MOCK_ANTHROPIC for CI/E2E"
git push origin core-pipeline-2a-v1
```

---

## Post-implementation notes

- **Cost envelope:** ~$0.15 per prep with Sonnet 4.6 at current Anthropic pricing (8k output tokens). Revisit if unit economics change.
- **Sub-project #2b** will introduce PDF/DOCX upload via Supabase Storage, a `cvs` table to cache parsed text, and `pdf-parse`/`mammoth` in a server-only util.
- **Sub-project #2c** will replace the single Claude call with a 3-stage pipeline orchestrator (`src/lib/ai/pipeline.ts`) that calls CV analyzer, company researcher (with `web_search_20250305` tool), and prep generator sequentially. The `prep-generator` prompt will receive structured `cvData` + `companyIntel` instead of raw text.
- **Sub-project #2d** will add Stage 0 (ATS analyzer), render it as the first section of the prep guide, and refine the viewer UX (animated card transitions, sticky section nav, keyboard shortcuts).
- **Stale "generating" sessions**: if a user closes the tab during generation and the Server Action crashes hard (unlikely with current try/catch coverage), a row could stay `generating` forever. Low priority; address via a 5-minute expiry check in #3 freemium gate when we add rate-limit logic.
- **Race condition**: if the user submits twice rapidly (double-click), two rows get inserted and two Claude calls fire. Not critical for skinny thread. Can add idempotency key in #3.
