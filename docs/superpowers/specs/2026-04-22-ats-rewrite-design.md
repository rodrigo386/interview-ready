# Sub-project #2d-v2 PR 2 — Generate ATS-Optimized CV

**Status:** Design approved 2026-04-22
**Depends on:** #2d ATS Analyzer v1, #2d-v2 PR 1 (dashboard badge + re-run)
**Branch:** `ats-upgrades/2d-v2-pr2`

---

## 1. Goal

Given a user's CV and a completed ATS analysis, generate a full CV rewrite that mirrors the JD's vocabulary while preserving all factual content. The rewrite renders inline as markdown (with summary of changes + preserved facts) and can be downloaded as a `.docx` file — the format most ATS parsers handle best.

---

## 2. Non-goals

- PDF output (defer to #5 polish — requires design work, ironically worse for ATS parsers than DOCX)
- Inline editing / accepting-rejecting individual diffs (user copies and edits externally)
- Per-bullet diff view
- Localized rewrites (PT-BR/ES) — always English output for now
- Tier gating — everyone gets access until #3 Freemium ships
- Auto-apply the rewrite as the new `cv_text` for future preps (user keeps original)

---

## 3. Schema

### Migration `0007_cv_rewrite.sql`

```sql
ALTER TABLE public.prep_sessions
  ADD COLUMN cv_rewrite JSONB,
  ADD COLUMN cv_rewrite_status TEXT
    CHECK (cv_rewrite_status IN ('pending','generating','complete','failed')),
  ADD COLUMN cv_rewrite_error TEXT;
```

### Zod — `src/lib/ai/schemas.ts`

```typescript
export const cvRewriteSchema = z.object({
  markdown: z.string().min(200).max(12000),
  summary_of_changes: z.array(z.string().min(5).max(300)).min(1).max(10),
  preserved_facts: z.array(z.string().min(3).max(300)).min(0).max(20),
});

export type CvRewrite = z.infer<typeof cvRewriteSchema>;
```

`summary_of_changes` is displayed above the preview so the user can see what Claude rewrote and why.

`preserved_facts` gives the user confidence that metrics, company names, and dates were kept verbatim.

---

## 4. Prompt

### `src/lib/ai/prompts/cv-rewriter.ts` (new)

```typescript
export function buildCvRewritePrompt(params: {
  cvText: string;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  topFixes: AtsAnalysis["top_fixes"];
});
// returns { system, user }
```

System prompt (abbreviated):

```
You are rewriting a CV to maximize ATS match with a specific job description.
Your goal: upgrade vocabulary to mirror the JD's exact phrasing without
inventing any new facts.

HARD RULES:
- NEVER invent jobs, roles, metrics, dates, or education credentials
- NEVER inflate scope (if CV says $100M, don't write $300M)
- Mirror the JD's EXACT phrases when filling gaps — if JD says "touchless P2P",
  use that exact phrase, not "automated purchase order processing"
- Keep the candidate's narrative arc — don't reorder years or invent transitions
- Keep the same approximate length as the original (±20%)

The ATS analysis already identified the top gaps — prioritize those fixes.

Call submit_cv_rewrite exactly once with:
- markdown: full rewritten CV. Use standard sections (Professional Summary,
  Experience, Skills, Education, Additional Information if relevant).
  Use ## for section headings, ### for role/job titles under Experience,
  - for bullet points, **bold** for emphasis when it mirrors the JD.
- summary_of_changes: 3-8 short bullets describing each major rewrite
  (e.g., "Upgraded 'digital tools' to 'agentic AI' in Bayer bullet")
- preserved_facts: list of specific facts kept verbatim
  (e.g., "$500M addressable spend at Bayer 2019-2022")
```

User message includes: original CV, JD, job title, company, and the full `top_fixes` array (priority, gap, original_cv_language, jd_language, suggested_rewrite) verbatim.

Tool: `submit_cv_rewrite` with JSON schema mirror of `cvRewriteSchema`.

Model `claude-sonnet-4-5`, `max_tokens: 6000`, timeout 120s.

---

## 5. Anthropic client — `src/lib/ai/anthropic.ts`

Add:

```typescript
export async function generateCvRewrite(params: {
  system: string;
  user: string;
}): Promise<CvRewrite>;
```

Mirrors `generateAtsAnalysis` pattern — single-shot tool-use. Throws `ClaudeResponseError` on failure. Returns MOCK_CV_REWRITE fixture when `MOCK_ANTHROPIC=1`.

MOCK fixture:

```typescript
const MOCK_CV_REWRITE: CvRewrite = {
  markdown: `## Professional Summary

Senior procurement leader with 10+ years driving digital and AI-enabled
transformation across LATAM. Proven track record deploying **agentic AI**
sourcing capability and **touchless P2P** processes at scale.

## Experience

### Head of Digital Procurement Transformation — Bayer (2019-2022)
- Led $500M addressable spend rollout of e-sourcing platform across 12
  countries
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

JSON tool schema mirrors `cvRewriteSchema` with the same string length bounds.

---

## 6. Server Action — `src/app/prep/[id]/rewrite-actions.ts` (new)

```typescript
"use server";

export async function runCvRewrite(sessionId: string): Promise<void>;
```

Flow:
1. Auth check, fetch session (select `id, user_id, cv_text, job_description, job_title, company_name, ats_status, ats_analysis, cv_rewrite_status`)
2. Verify `ats_status === 'complete'` — else return (should be unreachable from UI since CTA is gated)
3. Verify `cv_rewrite_status !== 'generating'` (concurrent-click guard)
4. Update `cv_rewrite_status='generating'`, clear `cv_rewrite` + `cv_rewrite_error`
5. Parse `ats_analysis` with `atsAnalysisSchema` (defense-in-depth)
6. Build prompt, call `generateCvRewrite`
7. On success: persist `cv_rewrite`, `cv_rewrite_status='complete'`
8. On error: persist raw response to `cv_rewrite_error`, status `'failed'`
9. `revalidatePath`

Uses `ClaudeResponseError` + `formatIntelError`-style helper (identical to the ATS / pipeline error formatters) for persisting raw response when Claude fails.

---

## 7. DOCX download — Route Handler

### `src/app/prep/[id]/cv-rewrite.docx/route.ts` (new)

```typescript
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response>;
```

Flow:
1. `await params`, auth check
2. Fetch session: `id`, `company_name`, `cv_rewrite`, `cv_rewrite_status`, `user_id` (RLS-guarded by `.eq("user_id", user.id)` as defense-in-depth)
3. If `cv_rewrite_status !== 'complete'` or stored rewrite fails Zod: return 404
4. Convert `cv_rewrite.markdown` → DOCX buffer via `mdToDocx`
5. Return `Response(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': 'attachment; filename="{safeFilename}.docx"' } })`

Filename: lowercase `{company_name}` + `-cv.docx`, stripped of non-alphanumeric characters. Fallback to `interview-ready-cv.docx`.

### Markdown → DOCX — `src/lib/files/md-to-docx.ts` (new)

Uses `docx` package (already installed as a dev-dep for tests in #2b — **promote to runtime dep** in this PR).

Supported markdown subset:
- `## Heading` → `Heading1`
- `### Subheading` → `Heading2`
- `- item` → bullet paragraph with `bullet: { level: 0 }`
- `**bold**` inline → `TextRun({ bold: true })`
- Blank line → paragraph break
- Everything else → normal paragraph

No tables, no links, no code blocks — YAGNI for CV content.

```typescript
export async function mdToDocx(markdown: string): Promise<Buffer>;
```

Implementation ~100 lines: line-by-line parse, inline bold regex split, accumulate `Paragraph[]`, pack with `Packer.toBuffer`.

### Tests — `src/lib/files/md-to-docx.test.ts`

Round-trip: generate DOCX from sample markdown → re-parse with `mammoth.extractRawText` → assert text contains expected headings, bullet items, and bold content.

---

## 8. UI

### `AtsScoreCard` — pass down rewrite props

Add optional `cvRewrite` + `cvRewriteStatus` + `cvRewriteError` props. Below the existing "Top fixes" block, render one of four sub-components based on status:

- `null` / `'pending'` / absent → `<CvRewriteCta sessionId={sessionId} />`
- `'generating'` → `<CvRewriteSkeleton />`
- `'complete'` → `<CvRewriteView rewrite={...} sessionId={sessionId} />`
- `'failed'` → `<CvRewriteFailed sessionId={sessionId} errorMessage={...} />`

### `CvRewriteCta.tsx` (new)

```
🎯 ATS-Optimized CV

Rewrite your CV to use the exact vocabulary from this JD. Factual content
(companies, metrics, dates) stays the same. Takes about 30 seconds.

[Generate ATS-Optimized CV]
```

Form submits to `runCvRewrite.bind(null, sessionId)`. Uses `PendingButton`.

### `CvRewriteView.tsx` (new)

```
🎯 ATS-Optimized CV

Summary of changes:
• Upgraded "digital tools" → "agentic AI" in summary
• Added exact phrase "touchless P2P"
• ...

Preserved facts (kept verbatim):
• $500M addressable spend at Bayer 2019-2022
• 18% cost takeout
• ...

[rendered markdown preview in max-h-96 scroll box]

[📋 Copy markdown]  [📄 Download .docx]  [↻ Re-run]
```

- Copy button: client-side `navigator.clipboard.writeText(rewrite.markdown)` + brief "Copied!" state
- Download: `<a href="/prep/{sessionId}/cv-rewrite.docx" download>` — browser handles download
- Re-run: form submitting `runCvRewrite`

Markdown rendering via a tiny local renderer (shared with `mdToDocx` parser): `src/lib/files/render-markdown.tsx` — returns `ReactNode`, same supported subset as DOCX conversion. ~80 lines.

### `CvRewriteSkeleton.tsx` (new)

Pulse placeholders. Meta refresh every 3s same as `AtsSkeleton`.

### `CvRewriteFailed.tsx` (new)

Reuses `ErrorDetails` component. Retry form hits `runCvRewrite` again.

---

## 9. Data plumbing

### `src/app/prep/[id]/page.tsx`

Extend the SELECT to include `cv_rewrite`, `cv_rewrite_status`, `cv_rewrite_error`. Parse `cv_rewrite` with `cvRewriteSchema` when status is `'complete'`. Pass validated or null down to `AtsScoreCard`.

When ATS status is anything other than `'complete'`, don't pass rewrite props — the CTA is gated on ATS completion via the outer `renderAtsBlock` flow.

---

## 10. Dependencies

- Promote `docx` from devDependency to dependency (already installed at v9.6.1).
- No other new packages.

---

## 11. Error handling matrix

| Scenario | Handling |
|---|---|
| ATS not run yet | Rewrite CTA doesn't render (outer gate) |
| User clicks Generate twice | Second click no-ops (`'generating'` guard) |
| Claude fails tool_use / validation | `cv_rewrite_status='failed'`, raw response in `cv_rewrite_error`, `CvRewriteFailed` UI with retry |
| Markdown > 12000 chars | Zod rejects → `'failed'` — prompt tells Claude to stay within length |
| Stored rewrite fails Zod on read | Render `CvRewriteFailed` with "Stored rewrite is malformed" |
| DOCX download before complete | Route returns 404 |
| DOCX conversion throws | Route returns 500 with JSON error body |
| User re-runs while complete | Clears + regenerates (same pattern as ATS re-run) |

---

## 12. Testing

### Unit (Vitest)

**`src/lib/ai/schemas.test.ts`** — 3 new tests:
- Accepts a valid rewrite
- Rejects markdown < 200 chars
- Rejects empty `summary_of_changes`

**`src/lib/files/md-to-docx.test.ts`** (new) — 2-3 tests:
- Markdown with headings + bullets + bold round-trips through `mammoth.extractRawText` with text intact
- Empty markdown still produces a valid (if empty) DOCX
- Bold inline renders correctly (mammoth returns the text, we don't assert bold specifically — harder)

### E2E

Extend `tests/e2e/ats.spec.ts`:

1. After ATS completes, verify Generate CTA visible
2. Click Generate → verify `CvRewriteView` with "Summary of changes" text
3. Verify copy button visible (don't test actual clipboard — browser API)
4. Verify `<a>` link for `.docx` points to `/prep/{id}/cv-rewrite.docx`
5. Fetch that URL directly via `page.request.get` — assert 200 + `Content-Type` contains `wordprocessingml`

---

## 13. Files touched

**New (10):**
- `supabase/migrations/0007_cv_rewrite.sql`
- `src/lib/ai/prompts/cv-rewriter.ts`
- `src/lib/files/md-to-docx.ts`
- `src/lib/files/md-to-docx.test.ts`
- `src/lib/files/render-markdown.tsx`
- `src/app/prep/[id]/rewrite-actions.ts`
- `src/app/prep/[id]/cv-rewrite.docx/route.ts`
- `src/components/prep/CvRewriteCta.tsx`
- `src/components/prep/CvRewriteView.tsx`
- `src/components/prep/CvRewriteSkeleton.tsx`
- `src/components/prep/CvRewriteFailed.tsx`

**Modified (7):**
- `package.json` (promote `docx` to runtime)
- `src/lib/ai/schemas.ts` (+ `cvRewriteSchema`)
- `src/lib/ai/schemas.test.ts` (+3 tests)
- `src/lib/ai/anthropic.ts` (+ `generateCvRewrite` + MOCK + tool schema)
- `src/app/prep/[id]/page.tsx` (query + pass rewrite props to AtsScoreCard)
- `src/components/prep/AtsScoreCard.tsx` (render rewrite sub-blocks)
- `tests/e2e/ats.spec.ts` (extend)
- `supabase/migrations/README.md`

---

## 14. Done criteria

- [ ] Migration 0007 applied to Supabase staging
- [ ] "Generate ATS-Optimized CV" button renders only when ATS is complete
- [ ] Clicking generates rewrite; preview shows summary + markdown with headings/bullets/bold formatted
- [ ] Copy button copies markdown to clipboard
- [ ] `.docx` download returns a valid file openable in Word/Google Docs
- [ ] Re-run regenerates cleanly
- [ ] Failed generations show `CvRewriteFailed` with error details
- [ ] All tests green (unit + E2E) with MOCK_ANTHROPIC=1
- [ ] Smoke test on Railway: real ATS → real rewrite → real DOCX download
