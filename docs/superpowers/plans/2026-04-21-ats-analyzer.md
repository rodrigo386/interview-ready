# ATS Analyzer #2d Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Opt-in ATS gap analyzer. User clicks "Run ATS Match" on `/prep/[id]` → 1 Claude tool_use call → score 0-100 + top 5 fixes + keyword tiers persisted + rendered.

**Architecture:** Same tool_use pattern as #2a-v2. Adds `ats_analysis JSONB` + `ats_status` columns. Server Action runs inline (~10-20s). Dedicated UI components above existing PrepGuide.

**Tech Stack:** Next.js 15, React 19, Anthropic SDK, Zod, Supabase, Tailwind.

**Spec:** `docs/superpowers/specs/2026-04-21-ats-analyzer-design.md`
**Branch:** `ats-analyzer/2d` (already exists, spec commit `4ace2b6`)

---

## Task 1: Migration `0004_ats_analysis.sql`

**Files:** `supabase/migrations/0004_ats_analysis.sql`

- [ ] Create the migration file:

```sql
ALTER TABLE public.prep_sessions
  ADD COLUMN ats_analysis JSONB,
  ADD COLUMN ats_status TEXT
    CHECK (ats_status IS NULL OR ats_status IN ('generating', 'complete', 'failed')),
  ADD COLUMN ats_error_message TEXT;
```

- [ ] Apply locally: `pnpm exec supabase db reset`
- [ ] Verify: `docker exec supabase_db_interview-ready psql -U postgres -d postgres -c "\d public.prep_sessions"` — shows 3 new columns
- [ ] Commit: `feat(db): 0004 add ats_analysis/ats_status/ats_error_message columns`

---

## Task 2: Zod schemas in `src/lib/ai/schemas.ts`

**Files:** `src/lib/ai/schemas.ts`, `src/lib/ai/schemas.test.ts`

- [ ] Append to `schemas.ts`:

```ts
export const atsKeywordSchema = z.object({
  keyword: z.string().min(1),
  found: z.boolean(),
  context: z.string().optional(),
});

export const atsFixSchema = z.object({
  priority: z.number().int().min(1).max(10),
  gap: z.string().min(1),
  original_cv_language: z.string(),
  jd_language: z.string().min(1),
  suggested_rewrite: z.string().min(20),
});

export const atsAnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  title_match: z.object({
    cv_title: z.string(),
    jd_title: z.string(),
    match_score: z.number().int().min(0).max(100),
  }),
  keyword_analysis: z.object({
    critical: z.array(atsKeywordSchema).min(0).max(30),
    high: z.array(atsKeywordSchema).min(0).max(40),
    medium: z.array(atsKeywordSchema).min(0).max(40),
  }),
  top_fixes: z.array(atsFixSchema).min(1).max(7),
  overall_assessment: z.string().min(30),
});

export type AtsAnalysis = z.infer<typeof atsAnalysisSchema>;
export type AtsKeyword = z.infer<typeof atsKeywordSchema>;
export type AtsFix = z.infer<typeof atsFixSchema>;
```

- [ ] Append to `schemas.test.ts`:

```ts
import { atsAnalysisSchema } from "./schemas";

const validAts = {
  score: 73,
  title_match: { cv_title: "Head of Procurement", jd_title: "Senior Director, AI Procurement", match_score: 60 },
  keyword_analysis: {
    critical: [{ keyword: "agentic AI", found: false }, { keyword: "AI Sourcing Agents", found: false }],
    high: [{ keyword: "procurement transformation", found: true, context: "led Bayer transformation" }],
    medium: [{ keyword: "change management", found: true }],
  },
  top_fixes: [{
    priority: 1,
    gap: "Missing: agentic AI",
    original_cv_language: "digital tools",
    jd_language: "agentic AI",
    suggested_rewrite: "Deployed agentic AI workflows across sourcing and category management at Bayer.",
  }],
  overall_assessment: "Strong experience but vocabulary mismatch on AI-specific terms will lose ATS ranking.",
};

describe("atsAnalysisSchema", () => {
  it("accepts a valid analysis", () => {
    expect(() => atsAnalysisSchema.parse(validAts)).not.toThrow();
  });
  it("rejects score > 100", () => {
    expect(() => atsAnalysisSchema.parse({ ...validAts, score: 150 })).toThrow();
  });
  it("rejects top_fixes empty", () => {
    expect(() => atsAnalysisSchema.parse({ ...validAts, top_fixes: [] })).toThrow();
  });
  it("rejects suggested_rewrite shorter than 20 chars", () => {
    const g = JSON.parse(JSON.stringify(validAts));
    g.top_fixes[0].suggested_rewrite = "short";
    expect(() => atsAnalysisSchema.parse(g)).toThrow();
  });
});
```

- [ ] Run: `pnpm test src/lib/ai/schemas.test.ts` — expect all pass
- [ ] Commit: `feat(schema): atsAnalysisSchema with keyword/fix validations`

---

## Task 3: Prompt builder `src/lib/ai/prompts/ats-analyzer.ts`

**Files:** Create `src/lib/ai/prompts/ats-analyzer.ts`

- [ ] Create the file:

```ts
export function buildAtsAnalyzerPrompt(params: {
  cvText: string;
  jdText: string;
  jobTitle: string;
  companyName: string;
}) {
  const system = `You are an ATS (Applicant Tracking System) and AI screening expert. Your job: analyze a CV against a specific JD and identify keyword gaps that would cause the CV to be filtered by automated screening.

You MUST call the submit_ats_analysis tool.

Methodology:
1. Extract EXACT keywords/phrases from the JD in three tiers:
   - critical (3x weight): phrases in the job title, key responsibilities, AND minimum qualifications
   - high (2x): phrases in responsibilities OR qualifications
   - medium (1x): mentioned once, or in preferred qualifications
2. Match each keyword LITERALLY against the CV (exact phrase, not semantic).
   - "digital transformation" and "procurement transformation" are DIFFERENT keywords.
   - If a phrase doesn't appear verbatim, mark it as not found.
3. Compute \`score\` as the weighted percentage of critical keywords found plus partial credit for high/medium.
4. Compute \`title_match.match_score\` based on overlap between cv_title and jd_title.
5. Generate \`top_fixes\`: the 5 highest-priority missing keywords. For each:
   - \`original_cv_language\`: the phrase currently in the CV that should be rewritten (or empty string if the topic is completely absent)
   - \`jd_language\`: the exact phrase from the JD
   - \`suggested_rewrite\`: a complete CV bullet rewritten to incorporate the JD language, using specifics from the CV (company, year, metric)
6. \`overall_assessment\`: 2-3 sentences diagnosing the candidate's ATS readiness for this specific JD.

Rules:
- Keywords are EXACT PHRASES from the JD, never synonyms.
- Prioritize critical keywords in top_fixes.
- suggested_rewrite must be at least 20 characters and should be a single CV bullet.
- At least 1 and at most 7 top_fixes.
- Return via the tool — no free text, no explanation outside the tool call.`;

  const user = `CANDIDATE CV:
${params.cvText}

TARGET JOB DESCRIPTION:
${params.jdText}

TARGET ROLE: ${params.jobTitle}
TARGET COMPANY: ${params.companyName}

Analyze now.`;

  return { system, user };
}
```

- [ ] Commit: `feat(ai): ATS analyzer prompt builder`

---

## Task 4: `generateAtsAnalysis` in `src/lib/ai/anthropic.ts`

**Files:** Modify `src/lib/ai/anthropic.ts`

- [ ] Add these imports at top (if not already): `type AtsAnalysis, atsAnalysisSchema`
- [ ] Add at the end of the file:

```ts
// JSON Schema mirror of atsAnalysisSchema for Anthropic tool_use
const atsToolSchema = {
  type: "object" as const,
  required: ["score", "title_match", "keyword_analysis", "top_fixes", "overall_assessment"],
  properties: {
    score: { type: "integer" as const, minimum: 0, maximum: 100 },
    title_match: {
      type: "object" as const,
      required: ["cv_title", "jd_title", "match_score"],
      properties: {
        cv_title: { type: "string" as const },
        jd_title: { type: "string" as const },
        match_score: { type: "integer" as const, minimum: 0, maximum: 100 },
      },
    },
    keyword_analysis: {
      type: "object" as const,
      required: ["critical", "high", "medium"],
      properties: {
        critical: { type: "array" as const, items: keywordItemSchema() },
        high: { type: "array" as const, items: keywordItemSchema() },
        medium: { type: "array" as const, items: keywordItemSchema() },
      },
    },
    top_fixes: {
      type: "array" as const,
      minItems: 1,
      maxItems: 7,
      items: {
        type: "object" as const,
        required: ["priority", "gap", "original_cv_language", "jd_language", "suggested_rewrite"],
        properties: {
          priority: { type: "integer" as const, minimum: 1, maximum: 10 },
          gap: { type: "string" as const, minLength: 1 },
          original_cv_language: { type: "string" as const },
          jd_language: { type: "string" as const, minLength: 1 },
          suggested_rewrite: { type: "string" as const, minLength: 20 },
        },
      },
    },
    overall_assessment: { type: "string" as const, minLength: 30 },
  },
};

function keywordItemSchema() {
  return {
    type: "object" as const,
    required: ["keyword", "found"],
    properties: {
      keyword: { type: "string" as const, minLength: 1 },
      found: { type: "boolean" as const },
      context: { type: "string" as const },
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
    critical: [
      { keyword: "agentic AI", found: false },
      { keyword: "AI Sourcing Agents", found: false },
      { keyword: "procurement transformation", found: true, context: "led Bayer digital procurement transformation 2019-2022" },
      { keyword: "$300M+ addressable spend", found: false },
    ],
    high: [
      { keyword: "touchless P2P", found: false },
      { keyword: "change management", found: true, context: "drove change across 12 LATAM countries" },
      { keyword: "target operating model", found: false },
    ],
    medium: [
      { keyword: "rapid prototyping", found: false },
      { keyword: "stakeholder alignment", found: true },
    ],
  },
  top_fixes: [
    {
      priority: 1,
      gap: "Missing: agentic AI",
      original_cv_language: "digital tools",
      jd_language: "agentic AI",
      suggested_rewrite: "Deployed agentic AI workflows for sourcing and category management, automating tail spend and reducing cycle time 40% at Prior Co 2022.",
    },
    {
      priority: 2,
      gap: "Missing: AI Sourcing Agents",
      original_cv_language: "e-sourcing platform",
      jd_language: "AI Sourcing Agents",
      suggested_rewrite: "Stood up AI Sourcing Agents for autonomous negotiation on tail spend across LATAM, covering $150M of addressable spend.",
    },
    {
      priority: 3,
      gap: "Missing: touchless P2P",
      original_cv_language: "automated 30% of purchase orders",
      jd_language: "touchless P2P",
      suggested_rewrite: "Delivered touchless P2P on 45% of transactions through exceptions-based processing and automated tail-spend routing.",
    },
    {
      priority: 4,
      gap: "Missing: target operating model",
      original_cv_language: "built the org",
      jd_language: "target operating model",
      suggested_rewrite: "Designed and rolled out the target operating model (Agile Pods + central CoE + GCC Factory) across 12 LATAM markets.",
    },
    {
      priority: 5,
      gap: "Missing: $300M+ addressable spend",
      original_cv_language: "$500 million",
      jd_language: "$300M+ addressable spend",
      suggested_rewrite: "Managed $500M in addressable spend across 12 LATAM countries, delivering 18% cost takeout.",
    },
  ],
  overall_assessment:
    "Strong domain experience but CV vocabulary lags JD by 2-3 years in AI-specific terms. Rewriting 5 key bullets will lift ATS score from 73 to ~92.",
};

export async function generateAtsAnalysis(params: {
  system: string;
  user: string;
}): Promise<AtsAnalysis> {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return MOCK_ATS;
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const start = Date.now();
  console.log("[anthropic] ats starting");
  const response = await client.messages.create(
    {
      model: "claude-sonnet-4-5",
      max_tokens: 3500,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
      tools: [
        {
          name: "submit_ats_analysis",
          description: "Submit the completed ATS gap analysis matching the required schema.",
          input_schema: atsToolSchema,
        },
      ],
      tool_choice: { type: "tool", name: "submit_ats_analysis" },
    },
    { timeout: 120_000 },
  );
  console.log(
    `[anthropic] ats completed in ${Date.now() - start}ms stop_reason=${response.stop_reason} output_tokens=${response.usage?.output_tokens ?? "?"}`,
  );
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Claude did not call submit_ats_analysis. stop_reason=${response.stop_reason}`);
  }
  return atsAnalysisSchema.parse(toolUse.input);
}
```

- [ ] Verify typecheck passes
- [ ] Commit: `feat(ai): generateAtsAnalysis via tool_use with MOCK fixture`

---

## Task 5: Server Action `src/app/prep/[id]/ats-actions.ts`

**Files:** Create `src/app/prep/[id]/ats-actions.ts`

- [ ] Full file content:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildAtsAnalyzerPrompt } from "@/lib/ai/prompts/ats-analyzer";
import { generateAtsAnalysis } from "@/lib/ai/anthropic";

export async function runAtsAnalysis(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, user_id, cv_text, job_description, job_title, company_name, ats_status",
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");

  // Guard against concurrent clicks
  if (session.ats_status === "generating" || session.ats_status === "complete") {
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  await supabase
    .from("prep_sessions")
    .update({ ats_status: "generating", ats_error_message: null })
    .eq("id", sessionId);

  try {
    const { system, user: userMsg } = buildAtsAnalyzerPrompt({
      cvText: session.cv_text,
      jdText: session.job_description,
      jobTitle: session.job_title,
      companyName: session.company_name,
    });
    const analysis = await generateAtsAnalysis({ system, user: userMsg });
    await supabase
      .from("prep_sessions")
      .update({ ats_analysis: analysis, ats_status: "complete" })
      .eq("id", sessionId);
  } catch (err) {
    console.error(`[ats ${sessionId}] failed:`, err);
    const message = err instanceof Error ? err.message.slice(0, 1500) : "Unknown error";
    await supabase
      .from("prep_sessions")
      .update({ ats_status: "failed", ats_error_message: message })
      .eq("id", sessionId);
  }

  revalidatePath(`/prep/${sessionId}`);
}
```

- [ ] Typecheck passes
- [ ] Commit: `feat(ats): runAtsAnalysis Server Action`

---

## Task 6: UI components

**Files:** Create 4 components in `src/components/prep/`

### `AtsCtaCard.tsx` (server component)

```tsx
import { runAtsAnalysis } from "@/app/prep/[id]/ats-actions";
import { PendingButton } from "./PendingButton";

export function AtsCtaCard({ sessionId }: { sessionId: string }) {
  const action = runAtsAnalysis.bind(null, sessionId);
  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-gradient-to-r from-violet-950/40 to-zinc-900/40 p-6">
      <h2 className="text-lg font-semibold">📊 Check your ATS match</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Modern ATS and AI screeners scan CVs for exact-phrase keywords from the
        job description. Get a 0-100 score, the top 5 gaps, and suggested
        rewrites in ~15 seconds.
      </p>
      <form action={action} className="mt-4">
        <PendingButton idleLabel="Run ATS Match" pendingLabel="Analyzing… about 15 seconds" variant="primary" />
      </form>
    </section>
  );
}
```

### `AtsScoreCard.tsx` (server component)

```tsx
import type { AtsAnalysis } from "@/lib/ai/schemas";

function ringColor(score: number): string {
  if (score < 40) return "text-red-500";
  if (score < 70) return "text-amber-500";
  return "text-emerald-500";
}

export function AtsScoreCard({ analysis }: { analysis: AtsAnalysis }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (analysis.score / 100) * c;
  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <div className="flex shrink-0 items-center gap-4">
          <svg width="96" height="96" viewBox="0 0 80 80" className={ringColor(analysis.score)}>
            <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" />
            <circle
              cx="40" cy="40" r={r} fill="none"
              stroke="currentColor" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              transform="rotate(-90 40 40)"
            />
            <text x="40" y="46" textAnchor="middle" fontSize="22" fontWeight="bold" fill="currentColor">
              {analysis.score}
            </text>
          </svg>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">ATS Match Score</p>
            <p className="text-xl font-semibold">{analysis.score} / 100</p>
            <p className="text-xs text-zinc-500">
              Title match: {analysis.title_match.match_score}%
            </p>
          </div>
        </div>
        <p className="text-sm text-zinc-300 md:flex-1">{analysis.overall_assessment}</p>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Top fixes</h3>
        <ol className="mt-4 space-y-3">
          {analysis.top_fixes.map((fix) => (
            <li key={fix.priority} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-zinc-100">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs text-white">
                    {fix.priority}
                  </span>
                  {fix.gap}
                </p>
              </div>
              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Your CV</dt>
                  <dd className="mt-1 text-zinc-300">{fix.original_cv_language || <em className="text-zinc-500">(absent)</em>}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">JD language</dt>
                  <dd className="mt-1 text-zinc-300">{fix.jd_language}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Suggested rewrite</dt>
                <dd className="mt-1 rounded bg-zinc-950 p-3 text-sm text-emerald-200">{fix.suggested_rewrite}</dd>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Keyword analysis ({analysis.keyword_analysis.critical.length + analysis.keyword_analysis.high.length + analysis.keyword_analysis.medium.length} keywords)
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <KeywordColumn label="Critical" keywords={analysis.keyword_analysis.critical} />
          <KeywordColumn label="High" keywords={analysis.keyword_analysis.high} />
          <KeywordColumn label="Medium" keywords={analysis.keyword_analysis.medium} />
        </div>
      </details>
    </section>
  );
}

function KeywordColumn({ label, keywords }: { label: string; keywords: AtsAnalysis["keyword_analysis"]["critical"] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <ul className="mt-2 space-y-1 text-xs">
        {keywords.map((kw) => (
          <li key={kw.keyword} className={kw.found ? "text-emerald-300" : "text-red-300"} title={kw.context ?? ""}>
            {kw.found ? "✓" : "✗"} {kw.keyword}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### `AtsFailed.tsx` (server)

```tsx
import { runAtsAnalysis } from "@/app/prep/[id]/ats-actions";
import { PendingButton } from "./PendingButton";

export function AtsFailed({ sessionId, errorMessage }: { sessionId: string; errorMessage: string | null }) {
  const action = runAtsAnalysis.bind(null, sessionId);
  return (
    <section className="mb-8 rounded-lg border border-red-900 bg-red-950/30 p-6">
      <h2 className="text-lg font-semibold text-red-200">ATS analysis failed</h2>
      <p className="mt-2 text-sm text-red-300">Try again in a moment.</p>
      {errorMessage && (
        <pre className="mt-3 overflow-x-auto rounded bg-black/40 p-3 font-mono text-xs text-red-300">{errorMessage}</pre>
      )}
      <form action={action} className="mt-4">
        <PendingButton idleLabel="Retry ATS Match" pendingLabel="Retrying…" variant="primary" />
      </form>
    </section>
  );
}
```

### `AtsSkeleton.tsx` (server)

```tsx
export function AtsSkeleton() {
  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 animate-pulse rounded-full bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
      <p className="mt-6 text-sm text-zinc-400">Analyzing keywords… about 15 seconds. This page will refresh automatically.</p>
      <meta httpEquiv="refresh" content="3" />
    </section>
  );
}
```

- [ ] Typecheck + build
- [ ] Commit: `feat(ats): UI components (CTA, ScoreCard, Skeleton, Failed)`

Note: the meta refresh in AtsSkeleton is inside body rather than head (same pattern as PrepSkeleton originally had). Since the Server Action calls `revalidatePath`, the page re-renders after `runAtsAnalysis` completes — user sees immediate update when they come back from the Server Action. The meta refresh is only a fallback if user somehow navigates mid-generation from another tab.

---

## Task 7: Wire into `/prep/[id]/page.tsx`

**Files:** Modify `src/app/prep/[id]/page.tsx`

- [ ] Update the page to select the ats columns and render the appropriate ATS component above PrepGuide.

Change the Supabase select:
```ts
const { data: session, error } = await supabase
  .from("prep_sessions")
  .select("id, generation_status, prep_guide, error_message, ats_status, ats_analysis, ats_error_message")
  .eq("id", id)
  .single();
```

Add imports:
```ts
import { AtsCtaCard } from "@/components/prep/AtsCtaCard";
import { AtsScoreCard } from "@/components/prep/AtsScoreCard";
import { AtsFailed } from "@/components/prep/AtsFailed";
import { AtsSkeleton } from "@/components/prep/AtsSkeleton";
import { atsAnalysisSchema } from "@/lib/ai/schemas";
```

After the existing `status === "failed"` check and before the `status === "complete"` branch, the code should render the PrepGuide. Inside the complete branch, wrap it:

```tsx
// Existing:
return (
  <PrepGuide guide={parsed.data} sessionId={session.id} activeSectionId={section} />
);

// Replace with:
const ats = renderAtsBlock(session);
return (
  <>
    {ats}
    <PrepGuide guide={parsed.data} sessionId={session.id} activeSectionId={section} />
  </>
);
```

Add helper below the default export:

```tsx
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

- [ ] `pnpm typecheck && pnpm build` — clean
- [ ] Commit: `feat(ats): integrate ATS block above PrepGuide on /prep/[id]`

---

## Task 8: E2E test + final verify + PR

**Files:** Create `tests/e2e/ats.spec.ts`

- [ ] Create the test:

```ts
import { test, expect } from "@playwright/test";

const CV_TEXT = `Rodrigo Costa — 10 years procurement leadership.
2019-2022 Bayer LATAM: Head of Digital Procurement Transformation.
Led $500M addressable spend, 18% cost takeout, 40% cycle-time reduction.
2022-present PE portfolio advisor on procurement digitization.
MBA Insead 2018.`;

const JD_TEXT = `Senior Director, AI & Digital Procurement Transformation.
Hexion $3B specialty chemicals, PE-backed.
Deploy agentic AI sourcing capability across $300M+ addressable spend.
Build target operating model, stand up AI Center of Excellence,
deploy AI Sourcing Agents for autonomous negotiation on tail spend, drive touchless P2P.
10+ years procurement transformation required, hands-on AI deployment, PE experience preferred.`;

test("run ATS match shows score and top fixes", async ({ page }) => {
  const email = `e2e-ats-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  // Signup + create prep (reuse MOCK path)
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E ATS Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.getByRole("link", { name: /new prep/i }).first().click();
  await page.waitForURL("**/prep/new");
  await page.getByLabel("Company").fill("Hexion");
  await page.getByLabel("Role").fill("Senior Director, AI Procurement");
  await page.getByLabel("Your CV (paste text)").fill(CV_TEXT);
  await page.getByLabel("Job Description (paste text)").fill(JD_TEXT);
  await page.getByRole("button", { name: /generate prep guide/i }).click();
  await page.waitForURL("**/prep/**", { timeout: 20_000 });

  // Should now see ATS CTA banner
  await expect(page.getByRole("heading", { name: /Check your ATS match/i })).toBeVisible();

  // Click Run ATS Match
  await page.getByRole("button", { name: /run ats match/i }).click();

  // After revalidation, score card should appear
  await expect(page.getByText(/ATS Match Score/i)).toBeVisible({ timeout: 20_000 });
  // MOCK_ATS has score 73
  await expect(page.getByText(/73/).first()).toBeVisible();
  // Top fix #1 is "Missing: agentic AI"
  await expect(page.getByText(/Missing: agentic AI/i)).toBeVisible();
});
```

- [ ] Run full local verification:

```bash
pnpm typecheck
pnpm test
MOCK_ANTHROPIC=1 pnpm test:e2e
```

All three must pass.

- [ ] Commit: `test(e2e): ATS analyzer flow with MOCK fixture`

- [ ] Push:

```bash
git push -u origin ats-analyzer/2d
```

- [ ] Open PR:

```bash
gh pr create --title "feat: ATS Gap Analyzer (#2d)" --body "Opt-in ATS analysis with dedicated UI. Circular score + top 5 fixes + keyword tier list. One Claude tool_use call ~15s. Persists to prep_sessions.ats_analysis JSONB. Zero changes to existing prep generation."
```

- [ ] Apply migration `0004_ats_analysis.sql` to production Supabase via SQL Editor
- [ ] Wait for CI green, merge PR with `--merge --delete-branch`
- [ ] Wait for Railway deploy, manual smoke test in prod
- [ ] Tag `ats-analyzer-2d-v1`

---

## Post-implementation

- Update `MEMORY.md` snapshot with #2d done
- Known follow-ups (not blocking): tier gating for free/pro (part of #3), re-run button when complete, dashboard score badge
