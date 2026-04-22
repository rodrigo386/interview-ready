# Sub-project #2c — Pipeline Depth (Company Research)

**Status:** Design approved 2026-04-22
**Depends on:** #1 Foundation, #2a Core Pipeline, #2b File Upload
**Branch:** `pipeline-depth/2c`

---

## 1. Goal

Add a company research stage to the prep pipeline. Before generating the 5 prep sections, Claude uses the `web_search_20250305` tool to research the target company (recent news, leadership, culture, strategic context) and produces a structured `company_intel` JSONB. The intel is then:

1. Rendered as a new first tab "🏢 Company Intel" in the prep viewer
2. Fed into every section generation prompt so answers can cite specific company facts

---

## 2. Non-goals

- Caching intel across preps for the same company (deferred to #2c-v2)
- Multi-language intel (always researched in English even if prep language is PT-BR/ES)
- Source citations inline inside prep card `sample_answer` text (references_cv stays CV-only)
- "Refresh intel" button to re-run company research on an existing prep
- PDF export of the intel section (stays with #5 polish)
- Web search cost budgeting / rate limiting

---

## 3. Schema

### Migration `0006_company_intel.sql`

```sql
ALTER TABLE public.prep_sessions
  ADD COLUMN company_intel JSONB,
  ADD COLUMN company_intel_status TEXT
    CHECK (company_intel_status IN ('pending','researching','complete','failed','skipped')),
  ADD COLUMN company_intel_error TEXT;
```

- `company_intel_status = 'skipped'` when `web_search` fails, returns nothing, or is disabled — intel is null but sections were generated normally (graceful degradation)
- `company_intel_status = 'failed'` when Claude errors during the research call — we persist the raw response in `company_intel_error` for debug
- `company_intel_error` holds the same kind of payload as `error_message` (short reason + optional RAW RESPONSE block), same `ErrorDetails` UI component from #2b cleanup

### Zod schema (new in `src/lib/ai/schemas.ts`)

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

---

## 4. Pipeline orchestrator

### `src/lib/ai/pipeline.ts` (new)

```typescript
export async function runPipeline(sessionId: string): Promise<void>;
```

Replaces the current `runGeneration` as the orchestration entry point. Flow:

```
1. Fetch session (cv_text, job_description, job_title, company_name)
2. Guard: if generation_status not in ['pending','failed'], return early
3. Set generation_status='generating', company_intel_status='researching',
   error_message=null, company_intel=null, company_intel_error=null
4. Stage A — Company research:
   - Call generateCompanyIntel(companyName, jobTitle)
   - On success: persist company_intel JSONB, status='complete'
   - On ParseError (web_search unavailable / empty results): status='skipped'
   - On other error: status='failed', persist raw response to company_intel_error
   - Either way, hold the intel (or null) in memory and continue
5. Stage B — 5 parallel section calls via Promise.allSettled (unchanged logic
   except buildSectionPrompt now accepts optional companyIntel)
6. Persist prep_guide, generation_status='complete'|'failed'
```

**Critical invariant:** Stage A failure never blocks Stage B. The prep is still useful without company intel, and the existing 5 sections are the core value.

### `src/app/prep/new/generation.ts` (modified)

Becomes a thin wrapper that imports and calls `runPipeline`. Preserves the existing function name `runGeneration` so `actions.ts` and `retryPrep` are untouched.

```typescript
import { runPipeline } from "@/lib/ai/pipeline";

export async function runGeneration(sessionId: string): Promise<void> {
  return runPipeline(sessionId);
}
```

---

## 5. Company research prompt

### `src/lib/ai/prompts/company-research.ts` (new)

```typescript
export function buildCompanyResearchPrompt(params: {
  companyName: string;
  jobTitle: string;
});
// returns { system, user }
```

**System prompt structure** (abbreviated):

```
You are a corporate intelligence researcher preparing a candidate for an
interview at {company}. Use the web_search tool strategically (5-6 searches
max) to gather current, relevant information, then call the
submit_company_intel tool with a structured report.

Search priorities (in this order):
1. "{company} recent news 2026"
2. "{company} leadership team CEO CPO"
3. "{company} {jobTitle-function-keywords} strategy"
4. "{company} culture values glassdoor"
5. "{company} industry competitive landscape"
6. "{company} funding private equity acquisition" (only if relevant signals)

Quality rules:
- overview: 2-3 sentences on what the company does (150-300 chars)
- recent_developments: pick 3-6 items from the LAST 12 MONTHS. Each needs
  headline + why_it_matters (the prep angle). Skip filler news.
- key_people: 2-4 executives relevant to the hiring chain or the role's
  function. CEO/CPO/CHRO/direct hiring manager if identifiable.
- culture_signals: short phrases ("aggressive shipping cadence",
  "PE-owned / speed + accountability"). No filler like "team-oriented".
- strategic_context: 2-3 sentences on industry pressures, competitive
  position, or strategic bets relevant to the role.
- questions_this_creates: specific questions the candidate could ask that
  prove they did this research.

If searches return nothing useful (fresh company, private, or generic
results), call submit_company_intel with empty arrays and a short overview
based on whatever you found. Don't make things up.

Call submit_company_intel exactly once when done.
```

Tools array includes both `{ type: "web_search_20250305", name: "web_search" }` and the custom `submit_company_intel` tool with `input_schema` mirroring `companyIntelSchema`.

`tool_choice: "auto"` (not forced) so Claude can call web_search multiple times before submitting.

Max tokens: 4000. Timeout: 120s. Model: `claude-sonnet-4-5`.

---

## 6. Anthropic client additions

### `src/lib/ai/anthropic.ts` (modified)

New exported function:

```typescript
export async function generateCompanyIntel(params: {
  system: string;
  user: string;
}): Promise<CompanyIntel | null>;
```

Contract:
- Returns the validated `CompanyIntel` object on success
- Returns `null` when Claude completes the conversation without calling `submit_company_intel` (treat as "skipped")
- Throws `ClaudeResponseError` when Claude errors or the submitted intel fails Zod validation

Internals:
- Iterates through content blocks: if Claude calls `web_search`, pass the tool results back and continue the conversation until Claude either calls `submit_company_intel` or runs out of stops. This is a multi-turn tool-use loop (differs from the single-shot `generateSection`).
- Loop cap: 8 iterations. If Claude doesn't submit within 8 turns, return null (skipped).
- `MOCK_ANTHROPIC=1` short-circuits to a MOCK_COMPANY_INTEL fixture — no real web_search call in CI.

---

## 7. Section generator enhancement

### `src/lib/ai/prompts/section-generator.ts` (modified)

`buildSectionPrompt` accepts a new optional parameter `companyIntel: CompanyIntel | null`.

When intel is present, append to the user message:

```
COMPANY INTELLIGENCE (use these specific facts in your answers):

Overview: {overview}

Recent developments:
- {headline}: {why_it_matters}
- ...

Key people:
- {name} ({role}): {background_snippet}
- ...

Culture signals: {comma-separated list}

Strategic context: {strategic_context}
```

When intel is null, skip the block entirely (no placeholder).

System prompt gains one sentence: "If COMPANY INTELLIGENCE is provided, weave specific facts (names, dates, strategic bets) into at least 2 of your sample_answers. Do not fabricate facts beyond what is provided."

The 5 existing section calls now receive `companyIntel` via `runPipeline`.

---

## 8. UI

### `src/app/prep/[id]/page.tsx` (modified)

Reads `company_intel` alongside existing fields. Passes to `PrepGuide`:

```typescript
<PrepGuide
  guide={parsed.data}
  sessionId={session.id}
  activeSectionId={section}
  activeCardId={card}
  companyIntel={validatedIntel}  // null if status !== 'complete'
/>
```

### `src/components/prep/PrepGuide.tsx` (modified)

When `companyIntel` is non-null:
- Prepend a synthetic section entry `{ id: "company-intel", title: "Company Intel", icon: "🏢" }` to the tab nav
- When this tab is active, render `<CompanyIntelCards intel={...} />` instead of the normal section card list
- The activeSectionId matching handles "company-intel" explicitly

Deep-link: `?section=company-intel` works via the same existing param.

### `src/components/prep/CompanyIntelCards.tsx` (new)

Layout (top to bottom):

1. **Overview + Strategic Context** — two paragraph cards side by side on desktop, stacked on mobile
2. **Recent Developments** — stacked expandable cards (same PrepCard-like shape, but without confidence_level/references_cv). Each card: headline (bold), why_it_matters, source link if present
3. **Key People** — compact cards in a 2-column grid: name + role + background
4. **Culture Signals** — pill chips in a flex wrap
5. **Questions This Creates** — bulleted list with a "📋 Copy" button to copy all to clipboard

Styles follow existing dark theme: `border-zinc-800 bg-zinc-900/40`, brand accents for links and headlines.

### `src/components/prep/NewPrepForm.tsx` (modified)

Spinner text changes from "Generating your prep… about 30 seconds" to:

```typescript
{pending ? "Researching company and writing your prep… about 60 seconds" : "Generate prep guide"}
```

The `GeneratingOverlay` also shows the longer estimate. No real-time step polling in v1 — the overlay is static. Step-by-step progress tracking is deferred (would require client polling or SSE; not worth complexity right now).

### `src/components/prep/PrepSkeleton.tsx` (modified)

Add one skeleton card at the top labeled "🏢 Company Intel" so the visual doesn't shift when intel finishes loading before sections. If intel ends up `null` (skipped), the tab simply doesn't render.

---

## 9. Error handling matrix

| Scenario | Handling |
|---|---|
| web_search tool unavailable in region/model | `generateCompanyIntel` returns null → pipeline marks status='skipped', continues to sections |
| Zero useful search results | Claude submits intel with empty arrays + minimal overview → status='complete', sparse UI tab |
| Claude doesn't call submit_company_intel in 8 turns | Returns null → status='skipped' |
| Claude errors (rate limit, 500) | ClaudeResponseError caught, status='failed', raw response persisted |
| Zod validation fails on submitted intel | ClaudeResponseError thrown, status='failed', raw response persisted |
| Stage A timeout (>120s) | Caught, status='failed', sections still run without intel |
| Any Stage B section fails | Existing generation_status='failed' path; intel already persisted |

The UI never shows a separate "company intel failed" error to the user. It's best-effort enrichment — absence is normal. Status is useful only for debug (query the `company_intel_status` / `company_intel_error` columns).

---

## 10. Testing plan

### Unit (Vitest)

**`src/lib/ai/schemas.test.ts`** — add 4 cases for `companyIntelSchema`:
- Accepts a valid intel
- Accepts all-empty arrays
- Rejects overview < 20 chars
- Rejects recent_developments > 6

**`src/lib/ai/prompts/section-generator.test.ts`** (new) — 2 cases:
- `buildSectionPrompt` with intel includes "COMPANY INTELLIGENCE" block in user message
- `buildSectionPrompt` without intel omits the block

### E2E (Playwright)

**`tests/e2e/company-intel.spec.ts`** (new) — with `MOCK_ANTHROPIC=1`:

1. Signup → create prep with paste CV → redirect to `/prep/[id]`
2. Verify "Company Intel" tab visible alongside 5 section tabs
3. Click it → verify overview text, at least one recent development, key people section, culture signals render
4. Deep link: navigate directly to `/prep/{id}?section=company-intel` → verify tab is active

No test case for skipped path in CI (hard to mock `generateCompanyIntel` returning null cleanly without adding a new env flag; manual verification against prod is fine).

### Mocks

`MOCK_COMPANY_INTEL` fixture added to `src/lib/ai/anthropic.ts`:

```typescript
const MOCK_COMPANY_INTEL: CompanyIntel = {
  overview: "Mock Co is a specialty chemicals company headquartered in Columbus OH, private-equity owned, $3B revenue.",
  recent_developments: [
    { headline: "IPO filed March 2026", why_it_matters: "Signals liquidity event — leadership is under shareholder pressure to accelerate AI transformation." },
    { headline: "New CFO appointed", why_it_matters: "Brings ex-Goldman background; historically pushes hard on cost and margin." },
  ],
  key_people: [
    { name: "Jane Doe", role: "Chief Procurement Officer", background_snippet: "Ex-Bayer, joined 2024 to lead procurement transformation." },
  ],
  culture_signals: ["fast-paced", "sponsor-owned speed", "hands-on leadership"],
  strategic_context: "Specialty chemicals industry is consolidating; Mock Co's PE sponsor is targeting a 2027 exit and needs EBITDA expansion via operational efficiency.",
  questions_this_creates: [
    "How does the IPO timeline affect the procurement transformation roadmap?",
    "What are the quick wins the new CFO expects in the first 6 months?",
  ],
};
```

### MOCK_ANTHROPIC integration

When the env flag is set:
- `generateCompanyIntel` returns MOCK_COMPANY_INTEL directly (no web_search call)
- Section prompts receive this fixture and mock sections continue to return as today

---

## 11. Migration deploy steps

1. Merge PR → Railway auto-deploys.
2. Manually run `0006_company_intel.sql` in Supabase Dashboard SQL Editor.
3. Verify: create a new prep on live app, check `company_intel_status` column in `prep_sessions` goes `researching → complete` (or `skipped` if web_search fails).

No storage or bucket changes.

---

## 12. Files touched

**New:**
- `supabase/migrations/0006_company_intel.sql`
- `src/lib/ai/pipeline.ts`
- `src/lib/ai/prompts/company-research.ts`
- `src/lib/ai/prompts/section-generator.test.ts`
- `src/components/prep/CompanyIntelCards.tsx`
- `tests/e2e/company-intel.spec.ts`

**Modified:**
- `src/lib/ai/schemas.ts` (add `companyIntelSchema`)
- `src/lib/ai/schemas.test.ts` (add 4 tests)
- `src/lib/ai/anthropic.ts` (add `generateCompanyIntel` + `MOCK_COMPANY_INTEL`)
- `src/lib/ai/prompts/section-generator.ts` (accept optional intel, render block)
- `src/app/prep/new/generation.ts` (becomes wrapper for `runPipeline`)
- `src/app/prep/[id]/page.tsx` (read + pass intel)
- `src/components/prep/PrepGuide.tsx` (prepend synthetic intel tab)
- `src/components/prep/NewPrepForm.tsx` (update spinner copy)
- `src/components/prep/PrepSkeleton.tsx` (add intel skeleton card)
- `supabase/migrations/README.md` (add 0006 row)

**Unchanged:**
- `createPrep`, `uploadCv`, ATS flow, auth, dashboard

---

## 13. Done criteria

- [ ] Migration 0006 applied on Supabase
- [ ] Creating a prep shows "Researching company and writing your prep…" spinner
- [ ] Successful prep: 6 tabs (🏢 Company Intel + 5 sections); intel cards render overview / developments / people / culture / questions; at least 2 section `sample_answer`s cite specific company facts
- [ ] web_search failure: 5 tabs only, no error shown to user, `company_intel_status='skipped'` in DB
- [ ] `?section=company-intel` deep link works
- [ ] All tests green (unit + E2E); MOCK_ANTHROPIC path exercises intel rendering without real web_search
- [ ] Smoke test on Railway with a real company (e.g., "Anthropic") produces non-empty intel
