# ATS CV Rewrite (#2d-v2 PR 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users generate an ATS-optimized rewrite of their CV based on the existing ATS analysis, preview it inline, copy the markdown, and download a `.docx` version ready to send to recruiters.

**Architecture:** New single-shot Claude tool-use call (`generateCvRewrite`) produces structured `{ markdown, summary_of_changes, preserved_facts }` persisted to `prep_sessions.cv_rewrite` JSONB. UI renders inside `AtsScoreCard` (gated on `ats_status === 'complete'`). DOCX download served via a GET route handler at `/prep/[id]/cv-rewrite.docx` that runs `mdToDocx` (in-house ~100-line parser using the `docx` package).

**Tech Stack:** Next.js 15 Server Actions + Route Handler, Anthropic SDK tool_use, Zod, `docx` (promoted from dev to runtime), Vitest, Playwright, `mammoth` (test round-trip only).

**Branch:** `ats-upgrades/2d-v2-pr2` (already checked out, spec committed at `c065734`)

**Spec:** `docs/superpowers/specs/2026-04-22-ats-rewrite-design.md`

---

## File Structure

### Created (10)
| Path | Purpose |
|---|---|
| `supabase/migrations/0007_cv_rewrite.sql` | `cv_rewrite` JSONB + status columns |
| `src/lib/ai/prompts/cv-rewriter.ts` | `buildCvRewritePrompt` |
| `src/lib/files/md-to-docx.ts` | Tiny parser: markdown subset → DOCX Buffer |
| `src/lib/files/md-to-docx.test.ts` | Round-trip unit tests via mammoth |
| `src/lib/files/render-markdown.tsx` | Inline React renderer for the same markdown subset |
| `src/app/prep/[id]/rewrite-actions.ts` | `runCvRewrite` Server Action |
| `src/app/prep/[id]/cv-rewrite.docx/route.ts` | GET handler streaming DOCX |
| `src/components/prep/CvRewriteCta.tsx` | Button when rewrite hasn't been generated |
| `src/components/prep/CvRewriteView.tsx` | Summary + preview + Copy/Download/Re-run |
| `src/components/prep/CvRewriteSkeleton.tsx` | Generating-state pulse loader |
| `src/components/prep/CvRewriteFailed.tsx` | Failed-state with retry |

### Modified (7)
| Path | Change |
|---|---|
| `package.json` | Promote `docx` from devDependency to dependency |
| `src/lib/ai/schemas.ts` | Add `cvRewriteSchema` + `CvRewrite` type |
| `src/lib/ai/schemas.test.ts` | +3 tests for new schema |
| `src/lib/ai/anthropic.ts` | Add `generateCvRewrite` + JSON Schema + MOCK_CV_REWRITE |
| `src/app/prep/[id]/page.tsx` | Query rewrite columns, pass props to `AtsScoreCard` |
| `src/components/prep/AtsScoreCard.tsx` | Host the 4-state rewrite sub-block |
| `tests/e2e/ats.spec.ts` | Extend with rewrite flow + DOCX download assertion |
| `supabase/migrations/README.md` | 0007 row + deploy steps |

---

## Task 1: Migration 0007

**Files:**
- Create: `supabase/migrations/0007_cv_rewrite.sql`

- [ ] **Step 1.1: Write migration**

```sql
ALTER TABLE public.prep_sessions
  ADD COLUMN cv_rewrite JSONB,
  ADD COLUMN cv_rewrite_status TEXT
    CHECK (cv_rewrite_status IN ('pending','generating','complete','failed')),
  ADD COLUMN cv_rewrite_error TEXT;
```

- [ ] **Step 1.2: Commit**

```bash
git add supabase/migrations/0007_cv_rewrite.sql
git commit -m "feat(db,2d-v2): migration 0007 cv_rewrite columns"
```

---

## Task 2: Promote `docx` to runtime dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 2.1: Move `docx` between dependency sections**

```bash
pnpm remove docx
pnpm add docx
```

(Confirms the package resolves the same version 9.6.1 or newer.)

- [ ] **Step 2.2: Verify**

```bash
pnpm typecheck
```

Expected: exits 0 (nothing uses the package at runtime yet; it's just now in `dependencies`).

- [ ] **Step 2.3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps(2d-v2): promote docx to runtime dependency"
```

---

## Task 3: Zod schema + tests (TDD)

**Files:**
- Modify: `src/lib/ai/schemas.ts`
- Modify: `src/lib/ai/schemas.test.ts`

- [ ] **Step 3.1: Write failing tests**

Append to `src/lib/ai/schemas.test.ts`:

```typescript
import { cvRewriteSchema } from "./schemas";

const validRewrite = {
  markdown:
    "## Professional Summary\n\nSenior procurement leader with 10+ years experience across LATAM.\n\n## Experience\n\n### Head of Digital Procurement — Bayer (2019-2022)\n- Led $500M addressable spend transformation\n- Delivered 18% cost takeout",
  summary_of_changes: [
    "Upgraded 'digital tools' to 'agentic AI'",
    "Added exact phrase 'touchless P2P'",
  ],
  preserved_facts: ["$500M addressable spend at Bayer 2019-2022"],
};

describe("cvRewriteSchema", () => {
  it("accepts a valid rewrite", () => {
    expect(() => cvRewriteSchema.parse(validRewrite)).not.toThrow();
  });
  it("rejects markdown shorter than 200 chars", () => {
    expect(() =>
      cvRewriteSchema.parse({ ...validRewrite, markdown: "too short" }),
    ).toThrow();
  });
  it("rejects empty summary_of_changes", () => {
    expect(() =>
      cvRewriteSchema.parse({ ...validRewrite, summary_of_changes: [] }),
    ).toThrow();
  });
});
```

- [ ] **Step 3.2: Run — expect FAIL**

```bash
pnpm test src/lib/ai/schemas.test.ts
```

Expected: 3 new tests fail with `cvRewriteSchema` undefined.

- [ ] **Step 3.3: Add schema to `src/lib/ai/schemas.ts`**

Append after existing `companyIntelSchema` + its type:

```typescript
export const cvRewriteSchema = z.object({
  markdown: z.string().min(200).max(12000),
  summary_of_changes: z.array(z.string().min(5).max(300)).min(1).max(10),
  preserved_facts: z.array(z.string().min(3).max(300)).min(0).max(20),
});

export type CvRewrite = z.infer<typeof cvRewriteSchema>;
```

- [ ] **Step 3.4: Run full suite — expect PASS**

```bash
pnpm test
```

Expected: 40 passing (37 existing + 3 new).

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/ai/schemas.ts src/lib/ai/schemas.test.ts
git commit -m "feat(schemas,2d-v2): cvRewriteSchema for CV rewrite output"
```

---

## Task 4: CV rewriter prompt

**Files:**
- Create: `src/lib/ai/prompts/cv-rewriter.ts`

- [ ] **Step 4.1: Write prompt builder**

`src/lib/ai/prompts/cv-rewriter.ts`:

```typescript
import type { AtsAnalysis } from "@/lib/ai/schemas";

export function buildCvRewritePrompt(params: {
  cvText: string;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  topFixes: AtsAnalysis["top_fixes"];
}) {
  const { cvText, jobDescription, jobTitle, companyName, topFixes } = params;

  const fixesBlock = topFixes
    .map(
      (f) =>
        `${f.priority}. ${f.gap}\n   CV says: ${f.original_cv_language || "(absent)"}\n   JD says: ${f.jd_language}\n   Suggested: ${f.suggested_rewrite}`,
    )
    .join("\n\n");

  const system = `You are rewriting a CV to maximize ATS match with a specific job description. Your goal: upgrade vocabulary to mirror the JD's exact phrasing without inventing any new facts.

HARD RULES:
- NEVER invent jobs, roles, metrics, dates, or education credentials
- NEVER inflate scope (if CV says $100M, don't write $300M)
- Mirror the JD's EXACT phrases when filling gaps — if JD says "touchless P2P", use that exact phrase, not "automated purchase order processing"
- Keep the candidate's narrative arc — don't reorder years or invent transitions
- Keep the same approximate length as the original (±20%)
- Output English only

The ATS analysis already identified the top gaps — prioritize those fixes.

Call submit_cv_rewrite exactly once with:
- markdown: full rewritten CV. Use standard sections (Professional Summary, Experience, Skills, Education, Additional Information if relevant). Use ## for section headings, ### for role/job titles under Experience, - for bullet points, **bold** for emphasis when it mirrors the JD.
- summary_of_changes: 3-8 short bullets describing each major rewrite (e.g., "Upgraded 'digital tools' to 'agentic AI' in Bayer bullet")
- preserved_facts: list of specific facts kept verbatim (e.g., "$500M addressable spend at Bayer 2019-2022")`;

  const user = `TARGET ROLE: ${jobTitle}
TARGET COMPANY: ${companyName}

ORIGINAL CV:
${cvText}

JOB DESCRIPTION:
${jobDescription}

TOP FIXES (from ATS analysis — prioritize these):
${fixesBlock}

Rewrite the CV now. Call submit_cv_rewrite.`;

  return { system, user };
}
```

- [ ] **Step 4.2: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4.3: Commit**

```bash
git add src/lib/ai/prompts/cv-rewriter.ts
git commit -m "feat(ai,2d-v2): buildCvRewritePrompt for ATS-optimized CV rewrite"
```

---

## Task 5: `generateCvRewrite` in Anthropic client

**Files:**
- Modify: `src/lib/ai/anthropic.ts`

- [ ] **Step 5.1: Add `CvRewrite` to schema import**

Update the existing schemas import at the top:

```typescript
import {
  prepSectionSchema,
  type PrepSection,
  atsAnalysisSchema,
  type AtsAnalysis,
  companyIntelSchema,
  type CompanyIntel,
  cvRewriteSchema,
  type CvRewrite,
} from "@/lib/ai/schemas";
```

- [ ] **Step 5.2: Add JSON Schema for `submit_cv_rewrite` tool**

Insert into `src/lib/ai/anthropic.ts` alongside other tool schemas (after `companyIntelToolSchema`):

```typescript
const cvRewriteToolSchema = {
  type: "object" as const,
  required: ["markdown", "summary_of_changes", "preserved_facts"],
  properties: {
    markdown: { type: "string" as const, minLength: 200, maxLength: 12000 },
    summary_of_changes: {
      type: "array" as const,
      minItems: 1,
      maxItems: 10,
      items: { type: "string" as const, minLength: 5, maxLength: 300 },
    },
    preserved_facts: {
      type: "array" as const,
      maxItems: 20,
      items: { type: "string" as const, minLength: 3, maxLength: 300 },
    },
  },
};
```

- [ ] **Step 5.3: Add MOCK_CV_REWRITE fixture**

Insert near other MOCK fixtures:

```typescript
const MOCK_CV_REWRITE: CvRewrite = {
  markdown: `## Professional Summary

Senior procurement leader with 10+ years driving digital and AI-enabled transformation across LATAM. Proven track record deploying **agentic AI** sourcing capability and **touchless P2P** processes at scale.

## Experience

### Head of Digital Procurement Transformation — Bayer (2019-2022)
- Led $500M addressable spend rollout of e-sourcing platform across 12 countries
- Delivered 18% cost takeout and 40% cycle-time reduction over 24 months
- Built target operating model and stood up center of excellence

### Portfolio Advisor — Private Equity (2022-present)
- Advise PE-backed portfolio companies on procurement digitization
- Hands-on AI deployment on tail spend automation

## Education
MBA, INSEAD, 2018

## Additional Information
Private equity experience; sponsor-owned speed and accountability.`,
  summary_of_changes: [
    "Upgraded 'digital tools' to 'agentic AI' in Professional Summary",
    "Added exact JD phrase 'touchless P2P' to summary",
    "Reframed Bayer achievements around 'target operating model' and 'center of excellence'",
  ],
  preserved_facts: [
    "$500M addressable spend at Bayer 2019-2022",
    "18% cost takeout",
    "40% cycle-time reduction",
    "12 countries LATAM",
    "MBA INSEAD 2018",
  ],
};
```

- [ ] **Step 5.4: Add `generateCvRewrite` function**

Append at the end of `src/lib/ai/anthropic.ts`:

```typescript
export async function generateCvRewrite(params: {
  system: string;
  user: string;
}): Promise<CvRewrite> {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return MOCK_CV_REWRITE;
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const start = Date.now();
  console.log("[anthropic] cv-rewrite starting");
  const response = await client.messages.create(
    {
      model: MODEL_ID,
      max_tokens: 6000,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
      tools: [
        {
          name: "submit_cv_rewrite",
          description:
            "Submit the full ATS-optimized CV rewrite along with summary of changes and preserved facts.",
          input_schema: cvRewriteToolSchema,
        },
      ],
      tool_choice: { type: "tool", name: "submit_cv_rewrite" },
    },
    { timeout: 120_000 },
  );
  console.log(
    `[anthropic] cv-rewrite completed in ${Date.now() - start}ms stop_reason=${response.stop_reason} output_tokens=${response.usage?.output_tokens ?? "?"}`,
  );

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new ClaudeResponseError(
      `Claude did not call submit_cv_rewrite. stop_reason=${response.stop_reason}`,
      dumpResponse(response),
      response.stop_reason,
    );
  }
  const parsed = cvRewriteSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new ClaudeResponseError(
      `CV rewrite failed schema validation: ${parsed.error.message}`,
      dumpResponse(response),
      response.stop_reason,
    );
  }
  return parsed.data;
}
```

- [ ] **Step 5.5: Typecheck + test + build**

```bash
pnpm typecheck && pnpm test && pnpm build
```

Expected: typecheck 0, 40/40 tests, build succeeds.

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/ai/anthropic.ts
git commit -m "feat(ai,2d-v2): generateCvRewrite via tool_use + MOCK fixture"
```

---

## Task 6: Markdown → DOCX converter (TDD)

**Files:**
- Create: `src/lib/files/md-to-docx.ts`
- Create: `src/lib/files/md-to-docx.test.ts`

- [ ] **Step 6.1: Write failing tests**

`src/lib/files/md-to-docx.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import mammoth from "mammoth";
import { mdToDocx } from "./md-to-docx";

const SAMPLE = `## Professional Summary

Senior procurement leader with 10+ years driving **agentic AI** transformation.

## Experience

### Head of Digital Procurement — Bayer (2019-2022)
- Led $500M addressable spend rollout
- Delivered 18% cost takeout

## Education
MBA, INSEAD, 2018`;

describe("mdToDocx", () => {
  it("produces a DOCX that mammoth can re-parse with headings and bullets intact", async () => {
    const buffer = await mdToDocx(SAMPLE);
    const { value: text } = await mammoth.extractRawText({ buffer });
    expect(text).toContain("Professional Summary");
    expect(text).toContain("Head of Digital Procurement");
    expect(text).toContain("Led $500M addressable spend rollout");
    expect(text).toContain("MBA, INSEAD, 2018");
    // Bold text should survive as plain text (mammoth drops formatting in extractRawText)
    expect(text).toContain("agentic AI");
  });

  it("handles an empty markdown input without throwing", async () => {
    const buffer = await mdToDocx("");
    expect(buffer.length).toBeGreaterThan(0); // valid empty DOCX
  });

  it("preserves paragraph breaks between sections", async () => {
    const buffer = await mdToDocx("First paragraph.\n\nSecond paragraph.");
    const { value: text } = await mammoth.extractRawText({ buffer });
    expect(text).toContain("First paragraph");
    expect(text).toContain("Second paragraph");
  });
});
```

- [ ] **Step 6.2: Run — expect FAIL**

```bash
pnpm test src/lib/files/md-to-docx.test.ts
```

Expected: fails with "Cannot find module ./md-to-docx".

- [ ] **Step 6.3: Implement `mdToDocx`**

`src/lib/files/md-to-docx.ts`:

```typescript
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

/**
 * Convert a small markdown subset into a DOCX Buffer.
 *
 * Supported:
 *   - `## Heading` → HeadingLevel.HEADING_1
 *   - `### Subheading` → HeadingLevel.HEADING_2
 *   - `- item` → bulleted paragraph (level 0)
 *   - `**bold**` inline → TextRun with bold: true
 *   - Blank lines → paragraph breaks
 *   - Everything else → normal paragraph
 *
 * Not supported (YAGNI for CV content): tables, links, code blocks, images.
 */
export async function mdToDocx(markdown: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      // Preserve paragraph break with an empty paragraph
      paragraphs.push(new Paragraph({ children: [] }));
      continue;
    }
    if (trimmed.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: renderInline(trimmed.slice(4)),
        }),
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: renderInline(trimmed.slice(3)),
        }),
      );
      continue;
    }
    if (trimmed.startsWith("- ")) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: renderInline(trimmed.slice(2)),
        }),
      );
      continue;
    }
    paragraphs.push(
      new Paragraph({ children: renderInline(trimmed) }),
    );
  }

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Split a line on `**bold**` markers and emit TextRun[] with correct
 * bold flags. Greedy double-asterisk pairs; any unmatched `**` stays literal.
 */
function renderInline(line: string): TextRun[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p !== "")
    .map((p) =>
      p.startsWith("**") && p.endsWith("**")
        ? new TextRun({ text: p.slice(2, -2), bold: true })
        : new TextRun(p),
    );
}
```

- [ ] **Step 6.4: Run tests — expect PASS**

```bash
pnpm test src/lib/files/md-to-docx.test.ts
```

Expected: 3 passing.

- [ ] **Step 6.5: Run full suite**

```bash
pnpm test
```

Expected: 43 passing (40 + 3 new).

- [ ] **Step 6.6: Commit**

```bash
git add src/lib/files/md-to-docx.ts src/lib/files/md-to-docx.test.ts
git commit -m "feat(files,2d-v2): mdToDocx — small markdown subset → DOCX buffer"
```

---

## Task 7: React markdown renderer

**Files:**
- Create: `src/lib/files/render-markdown.tsx`

- [ ] **Step 7.1: Implement renderer**

`src/lib/files/render-markdown.tsx`:

```typescript
import type { ReactNode } from "react";

/**
 * Render a small markdown subset (matching mdToDocx) to React nodes.
 * Shared subset so the inline preview matches what the downloaded DOCX contains.
 */
export function renderMarkdown(markdown: string): ReactNode {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {bulletBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flushBullets();
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushBullets();
      blocks.push(
        <h4 key={`h4-${blocks.length}`} className="mt-4 text-sm font-semibold text-zinc-100">
          {renderInline(trimmed.slice(4))}
        </h4>,
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushBullets();
      blocks.push(
        <h3
          key={`h3-${blocks.length}`}
          className="mt-5 text-base font-semibold text-zinc-100"
        >
          {renderInline(trimmed.slice(3))}
        </h3>,
      );
      continue;
    }
    if (trimmed.startsWith("- ")) {
      bulletBuffer.push(trimmed.slice(2));
      continue;
    }
    flushBullets();
    blocks.push(
      <p key={`p-${blocks.length}`} className="mt-2 text-sm text-zinc-200">
        {renderInline(trimmed)}
      </p>,
    );
  }
  flushBullets();
  return <>{blocks}</>;
}

function renderInline(line: string): ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p !== "")
    .map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
}
```

- [ ] **Step 7.2: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 7.3: Commit**

```bash
git add src/lib/files/render-markdown.tsx
git commit -m "feat(files,2d-v2): renderMarkdown — React renderer matching mdToDocx subset"
```

---

## Task 8: `runCvRewrite` Server Action

**Files:**
- Create: `src/app/prep/[id]/rewrite-actions.ts`

- [ ] **Step 8.1: Write the action**

`src/app/prep/[id]/rewrite-actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCvRewritePrompt } from "@/lib/ai/prompts/cv-rewriter";
import { generateCvRewrite, ClaudeResponseError } from "@/lib/ai/anthropic";
import { atsAnalysisSchema } from "@/lib/ai/schemas";

export async function runCvRewrite(sessionId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, user_id, cv_text, job_description, job_title, company_name, ats_status, ats_analysis, cv_rewrite_status",
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");

  if (session.ats_status !== "complete") {
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  if (session.cv_rewrite_status === "generating") {
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  await supabase
    .from("prep_sessions")
    .update({
      cv_rewrite_status: "generating",
      cv_rewrite: null,
      cv_rewrite_error: null,
    })
    .eq("id", sessionId);

  try {
    const parsedAts = atsAnalysisSchema.safeParse(session.ats_analysis);
    if (!parsedAts.success) {
      throw new Error(`Stored ATS analysis is malformed: ${parsedAts.error.message}`);
    }

    const { system, user: userMsg } = buildCvRewritePrompt({
      cvText: session.cv_text,
      jobDescription: session.job_description,
      jobTitle: session.job_title,
      companyName: session.company_name,
      topFixes: parsedAts.data.top_fixes,
    });

    const rewrite = await generateCvRewrite({ system, user: userMsg });

    await supabase
      .from("prep_sessions")
      .update({
        cv_rewrite: rewrite,
        cv_rewrite_status: "complete",
      })
      .eq("id", sessionId);
  } catch (err) {
    console.error(`[cv-rewrite ${sessionId}] failed:`, err);
    const message = formatRewriteError(err).slice(0, 8000);
    await supabase
      .from("prep_sessions")
      .update({
        cv_rewrite_status: "failed",
        cv_rewrite_error: message,
      })
      .eq("id", sessionId);
  }

  revalidatePath(`/prep/${sessionId}`);
}

function formatRewriteError(err: unknown): string {
  if (err instanceof ClaudeResponseError) {
    return `${err.message}\n\nRAW RESPONSE:\n${err.rawResponse}`;
  }
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  return String(err);
}
```

- [ ] **Step 8.2: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 8.3: Commit**

```bash
git add src/app/prep/[id]/rewrite-actions.ts
git commit -m "feat(prep,2d-v2): runCvRewrite Server Action with ownership + guards"
```

---

## Task 9: DOCX route handler

**Files:**
- Create: `src/app/prep/[id]/cv-rewrite.docx/route.ts`

- [ ] **Step 9.1: Implement GET handler**

`src/app/prep/[id]/cv-rewrite.docx/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cvRewriteSchema } from "@/lib/ai/schemas";
import { mdToDocx } from "@/lib/files/md-to-docx";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select("id, company_name, cv_rewrite, cv_rewrite_status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (session.cv_rewrite_status !== "complete") {
    return NextResponse.json(
      { error: "rewrite not ready" },
      { status: 404 },
    );
  }

  const parsed = cvRewriteSchema.safeParse(session.cv_rewrite);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "stored rewrite is malformed" },
      { status: 500 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = await mdToDocx(parsed.data.markdown);
  } catch (err) {
    console.error(`[cv-rewrite-docx ${id}] conversion failed:`, err);
    return NextResponse.json(
      { error: "conversion failed" },
      { status: 500 },
    );
  }

  const safeCompany = session.company_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = safeCompany ? `${safeCompany}-cv.docx` : "interview-ready-cv.docx";

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
```

- [ ] **Step 9.2: Typecheck + build**

```bash
pnpm typecheck && pnpm build
```

Expected: both succeed.

- [ ] **Step 9.3: Commit**

```bash
git add src/app/prep/[id]/cv-rewrite.docx/route.ts
git commit -m "feat(prep,2d-v2): GET /prep/[id]/cv-rewrite.docx route handler"
```

---

## Task 10: UI sub-components

**Files:**
- Create: `src/components/prep/CvRewriteCta.tsx`
- Create: `src/components/prep/CvRewriteView.tsx`
- Create: `src/components/prep/CvRewriteSkeleton.tsx`
- Create: `src/components/prep/CvRewriteFailed.tsx`

- [ ] **Step 10.1: Write CTA**

`src/components/prep/CvRewriteCta.tsx`:

```typescript
import { runCvRewrite } from "@/app/prep/[id]/rewrite-actions";
import { PendingButton } from "./PendingButton";

export function CvRewriteCta({ sessionId }: { sessionId: string }) {
  const action = runCvRewrite.bind(null, sessionId);
  return (
    <div className="mt-8 rounded-md border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold text-zinc-100">
        🎯 ATS-Optimized CV
      </h3>
      <p className="mt-2 text-sm text-zinc-400">
        Rewrite your CV to use the exact vocabulary from this JD. Factual
        content (companies, metrics, dates) stays the same. Takes about 30
        seconds.
      </p>
      <form action={action} className="mt-4">
        <PendingButton
          idleLabel="Generate ATS-Optimized CV"
          pendingLabel="Generating…"
          variant="primary"
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 10.2: Write skeleton**

`src/components/prep/CvRewriteSkeleton.tsx`:

```typescript
export function CvRewriteSkeleton() {
  return (
    <div className="mt-8 rounded-md border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold text-zinc-100">
        🎯 ATS-Optimized CV
      </h3>
      <p className="mt-2 text-sm text-zinc-400">
        Rewriting your CV… about 30 seconds. This page will refresh automatically.
      </p>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-800" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
      </div>
      <meta httpEquiv="refresh" content="3" />
    </div>
  );
}
```

- [ ] **Step 10.3: Write failed**

`src/components/prep/CvRewriteFailed.tsx`:

```typescript
import { runCvRewrite } from "@/app/prep/[id]/rewrite-actions";
import { PendingButton } from "./PendingButton";
import { ErrorDetails } from "./ErrorDetails";

export function CvRewriteFailed({
  sessionId,
  errorMessage,
}: {
  sessionId: string;
  errorMessage: string | null;
}) {
  const action = runCvRewrite.bind(null, sessionId);
  return (
    <div className="mt-8 rounded-md border border-red-900 bg-red-950/30 p-5">
      <h3 className="text-sm font-semibold text-red-200">
        🎯 ATS-Optimized CV — failed
      </h3>
      <p className="mt-2 text-sm text-red-300">
        Something went wrong generating the rewrite. Try again.
      </p>
      {errorMessage && <ErrorDetails raw={errorMessage} />}
      <form action={action} className="mt-4">
        <PendingButton
          idleLabel="Retry"
          pendingLabel="Retrying…"
          variant="primary"
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 10.4: Write view**

`src/components/prep/CvRewriteView.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { CvRewrite } from "@/lib/ai/schemas";
import { runCvRewrite } from "@/app/prep/[id]/rewrite-actions";
import { PendingButton } from "./PendingButton";
import { renderMarkdown } from "@/lib/files/render-markdown";

export function CvRewriteView({
  rewrite,
  sessionId,
}: {
  rewrite: CvRewrite;
  sessionId: string;
}) {
  const [copied, setCopied] = useState(false);
  const rerunAction = runCvRewrite.bind(null, sessionId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rewrite.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-8 rounded-md border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold text-zinc-100">
        🎯 ATS-Optimized CV
      </h3>

      <section className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Summary of changes
        </h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
          {rewrite.summary_of_changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>

      {rewrite.preserved_facts.length > 0 && (
        <section className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Preserved facts (kept verbatim)
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {rewrite.preserved_facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Preview
        </h4>
        <div className="mt-2 max-h-96 overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-4">
          {renderMarkdown(rewrite.markdown)}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          {copied ? "✓ Copied" : "📋 Copy markdown"}
        </button>
        <a
          href={`/prep/${sessionId}/cv-rewrite.docx`}
          download
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          📄 Download .docx
        </a>
        <form action={rerunAction}>
          <PendingButton
            idleLabel="↻ Re-run"
            pendingLabel="Re-running…"
            variant="secondary"
          />
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 10.5: Typecheck + build**

```bash
pnpm typecheck && pnpm build
```

Expected: both succeed.

- [ ] **Step 10.6: Commit**

```bash
git add src/components/prep/CvRewriteCta.tsx src/components/prep/CvRewriteSkeleton.tsx src/components/prep/CvRewriteFailed.tsx src/components/prep/CvRewriteView.tsx
git commit -m "feat(prep,2d-v2): CvRewrite UI sub-components (CTA/skeleton/failed/view)"
```

---

## Task 11: Wire into `AtsScoreCard` + page

**Files:**
- Modify: `src/components/prep/AtsScoreCard.tsx`
- Modify: `src/app/prep/[id]/page.tsx`

- [ ] **Step 11.1: Update `AtsScoreCard` to render rewrite block**

Read `src/components/prep/AtsScoreCard.tsx` first, then replace the component signature + add the rewrite block at the end of the returned JSX (before closing `</section>`):

Update the signature and body like this (full replacement, preserving existing SVG/header/top-fixes/keyword blocks):

```typescript
import type { AtsAnalysis, CvRewrite } from "@/lib/ai/schemas";
import { runAtsAnalysis } from "@/app/prep/[id]/ats-actions";
import { PendingButton } from "./PendingButton";
import { CvRewriteCta } from "./CvRewriteCta";
import { CvRewriteSkeleton } from "./CvRewriteSkeleton";
import { CvRewriteFailed } from "./CvRewriteFailed";
import { CvRewriteView } from "./CvRewriteView";

function ringColor(score: number): string {
  if (score < 40) return "text-red-500";
  if (score < 70) return "text-amber-500";
  return "text-emerald-500";
}

export function AtsScoreCard({
  analysis,
  sessionId,
  cvRewrite,
  cvRewriteStatus,
  cvRewriteError,
}: {
  analysis: AtsAnalysis;
  sessionId: string;
  cvRewrite?: CvRewrite | null;
  cvRewriteStatus?: string | null;
  cvRewriteError?: string | null;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (analysis.score / 100) * c;
  const rerunAction = runAtsAnalysis.bind(null, sessionId);
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
        <form action={rerunAction} className="shrink-0">
          <PendingButton idleLabel="↻ Re-run" pendingLabel="Re-running…" variant="secondary" />
        </form>
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

      {cvRewriteStatus === "generating" ? (
        <CvRewriteSkeleton />
      ) : cvRewriteStatus === "failed" ? (
        <CvRewriteFailed sessionId={sessionId} errorMessage={cvRewriteError ?? null} />
      ) : cvRewriteStatus === "complete" && cvRewrite ? (
        <CvRewriteView rewrite={cvRewrite} sessionId={sessionId} />
      ) : (
        <CvRewriteCta sessionId={sessionId} />
      )}

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

- [ ] **Step 11.2: Update `src/app/prep/[id]/page.tsx`**

Extend the SELECT to include `cv_rewrite, cv_rewrite_status, cv_rewrite_error`. Validate with `cvRewriteSchema` when status is `'complete'`. Pass three new props to `AtsScoreCard` inside `renderAtsBlock`:

Replace the `renderAtsBlock` function with:

```typescript
function renderAtsBlock(session: {
  id: string;
  ats_status: string | null;
  ats_analysis: unknown;
  ats_error_message: string | null;
  cv_rewrite: unknown;
  cv_rewrite_status: string | null;
  cv_rewrite_error: string | null;
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
    const rewriteParsed =
      session.cv_rewrite_status === "complete"
        ? cvRewriteSchema.safeParse(session.cv_rewrite)
        : null;
    const validRewrite = rewriteParsed?.success ? rewriteParsed.data : null;
    return (
      <AtsScoreCard
        analysis={parsed.data}
        sessionId={session.id}
        cvRewrite={validRewrite}
        cvRewriteStatus={session.cv_rewrite_status}
        cvRewriteError={session.cv_rewrite_error}
      />
    );
  }
  return <AtsCtaCard sessionId={session.id} />;
}
```

Also update the schemas import at the top of `page.tsx`:

```typescript
import {
  prepGuideSchema,
  atsAnalysisSchema,
  companyIntelSchema,
  cvRewriteSchema,
} from "@/lib/ai/schemas";
```

And extend the SELECT string on the main session query to add the three new columns:

```typescript
  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, generation_status, prep_guide, error_message, ats_status, ats_analysis, ats_error_message, company_intel, company_intel_status, cv_rewrite, cv_rewrite_status, cv_rewrite_error",
    )
    .eq("id", id)
    .single();
```

- [ ] **Step 11.3: Typecheck + test + build**

```bash
pnpm typecheck && pnpm test && pnpm build
```

Expected: all green.

- [ ] **Step 11.4: Commit**

```bash
git add src/components/prep/AtsScoreCard.tsx src/app/prep/[id]/page.tsx
git commit -m "feat(prep,2d-v2): render rewrite block inside AtsScoreCard"
```

---

## Task 12: E2E + README

**Files:**
- Modify: `tests/e2e/ats.spec.ts`
- Modify: `supabase/migrations/README.md`

- [ ] **Step 12.1: Extend E2E**

At the end of the existing `run ATS match shows score and top fixes` test in `tests/e2e/ats.spec.ts`, append (just before the test's closing `});`):

```typescript
  // Rewrite CTA visible once ATS is complete
  await expect(
    page.getByRole("button", { name: /Generate ATS-Optimized CV/i }),
  ).toBeVisible();

  // Click Generate → view renders with MOCK_CV_REWRITE data
  await page.getByRole("button", { name: /Generate ATS-Optimized CV/i }).click();
  await expect(page.getByText(/Summary of changes/i)).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/Upgraded 'digital tools' to 'agentic AI'/i),
  ).toBeVisible();
  await expect(page.getByText(/touchless P2P/i)).toBeVisible();

  // Copy button visible
  await expect(page.getByRole("button", { name: /Copy markdown/i })).toBeVisible();

  // Download link points to the DOCX route and responds 200 with the right mime
  const href = await page
    .getByRole("link", { name: /Download .docx/i })
    .getAttribute("href");
  expect(href).toMatch(/\/prep\/.+\/cv-rewrite\.docx$/);
  const docxUrl = new URL(href!, page.url()).toString();
  const res = await page.request.get(docxUrl);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("wordprocessingml");
```

- [ ] **Step 12.2: Update `supabase/migrations/README.md`**

Find the existing migrations table and append the 0007 row:

```markdown
| 0007 | `0007_cv_rewrite.sql` | pending |
```

Append a new deploy-steps section:

```markdown
## 0007 deploy steps

1. Run `0007_cv_rewrite.sql` in Supabase SQL Editor.
2. Verify: complete an ATS analysis, click "Generate ATS-Optimized CV", confirm a row with `cv_rewrite_status='complete'` on `prep_sessions`, and download the `.docx`.
```

- [ ] **Step 12.3: Final local gate**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all green. Fix any new lint warnings introduced by files you touched.

- [ ] **Step 12.4: Commit**

```bash
git add tests/e2e/ats.spec.ts supabase/migrations/README.md
git commit -m "test(e2e,2d-v2) + docs(2d-v2): rewrite flow E2E + migration 0007 deploy steps"
```

- [ ] **Step 12.5: Push + open PR**

```bash
git push -u origin ats-upgrades/2d-v2-pr2
gh pr create --title "feat: Generate ATS-Optimized CV + .docx download (#2d-v2 PR 2)" --body "$(cat <<'EOF'
## Summary
Second PR for #2d-v2. Generates an ATS-optimized rewrite of the user's CV based on the existing ATS analysis, renders it inline (summary of changes + markdown preview), and serves a \`.docx\` download.

Spec: \`docs/superpowers/specs/2026-04-22-ats-rewrite-design.md\`
Plan: \`docs/superpowers/plans/2026-04-22-ats-rewrite.md\`

## Key design choices
- Output format: markdown inline + .docx download (DOCX is the gold standard for ATS parsers; PDF deferred to #5 polish)
- \`docx\` package promoted from devDependency to runtime (was already installed)
- In-house \`mdToDocx\` parser (~100 lines) — supports headings/bullets/bold/paragraphs only (YAGNI for CV content)
- Shared markdown subset between \`mdToDocx\` and \`renderMarkdown\` so preview and download match
- DOCX served via GET route handler (Server Actions redirect; can't return binary)

## Deploy checklist (post-merge)
- [ ] Run \`supabase/migrations/0007_cv_rewrite.sql\` in SQL Editor
- [ ] Smoke test on Railway: run ATS → generate rewrite → copy markdown → download .docx → open in Word

## Test plan
- [x] \`pnpm typecheck\` — clean
- [x] \`pnpm test\` — 43/43 passing (new: cvRewriteSchema x3, mdToDocx x3)
- [x] \`pnpm build\` — succeeds
- [ ] \`pnpm test:e2e\` — runs in CI with MOCK_ANTHROPIC=1 (MOCK_CV_REWRITE fixture)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 12.6: Watch CI**

```bash
gh pr checks --watch
```

Expected: `test` passes. If it fails on the docx route returning 404, the most likely cause is that migration 0007 hasn't been applied to staging — same pattern as previous migrations. Ask user to apply before merge.

- [ ] **Step 12.7: Merge (only after user confirms migration applied)**

```bash
gh pr merge --squash --delete-branch
```

---

## Done Criteria (from spec §14)

- [ ] Migration 0007 applied to Supabase staging
- [ ] "Generate ATS-Optimized CV" button renders only when ATS is complete
- [ ] Clicking generates rewrite; preview shows summary + markdown with headings/bullets/bold formatted
- [ ] Copy button copies markdown to clipboard
- [ ] `.docx` download returns a valid file openable in Word/Google Docs
- [ ] Re-run regenerates cleanly
- [ ] Failed generations show `CvRewriteFailed` with error details
- [ ] All tests green (unit + E2E) with MOCK_ANTHROPIC=1
- [ ] Smoke test on Railway: real ATS → real rewrite → real DOCX download
