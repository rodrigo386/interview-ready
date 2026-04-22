# Sub-project #2d-v2 PR 1 — ATS Dashboard Badge + Re-run

**Status:** Design approved 2026-04-22
**Depends on:** #2d ATS Analyzer v1 (shipped 2026-04-21)
**Branch:** `ats-upgrades/2d-v2-pr1`

Small PR — no migration, no prompts, no new Claude calls. Just wiring existing data to new UI surfaces plus fixing the re-run guard.

---

## 1. Goal

1. **Dashboard badge** — Show color-coded `ATS X%` pill on each prep card in `/dashboard` when an ATS analysis has completed. No badge if analysis wasn't run. Saves users a click to see which preps are well-optimized.
2. **Re-run button** — Explicit "↻ Re-run" in `AtsScoreCard` so users can regenerate analysis after they update their CV externally. Today `runAtsAnalysis` blocks re-run after `complete` — we remove that guard.

---

## 2. Non-goals (deferred to later PRs)

- PR 2: "Generate ATS-Optimized CV" full rewrite button + download
- #2d-v3: Per-section language gating / CV heat map in the prep viewer
- Score history / trend chart
- Re-run confirmation modal (one-click is fine)

---

## 3. Dashboard badge

### Query change — `src/app/dashboard/page.tsx`

Extend the existing select to pull status + score:

```typescript
const { data: sessions } = await supabase
  .from("prep_sessions")
  .select(`
    id, company_name, job_title, generation_status, created_at,
    ats_status,
    ats_score:ats_analysis->>score
  `)
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(20);
```

PostgREST `ats_analysis->>score` returns the score as text (JSON string value). Coerce client-side:

```typescript
const score = s.ats_score ? Number(s.ats_score) : null;
```

`SessionRow` type gains:

```typescript
type SessionRow = {
  id: string;
  company_name: string;
  job_title: string;
  generation_status: string;
  created_at: string;
  ats_status: string | null;
  ats_score: string | null;  // raw PostgREST string
};
```

### New component — `src/components/prep/AtsScoreBadge.tsx`

```typescript
export function AtsScoreBadge({ score }: { score: number }) {
  const style =
    score >= 70
      ? "bg-emerald-950/40 text-emerald-300 border-emerald-900"
      : score >= 40
        ? "bg-amber-950/40 text-amber-300 border-amber-900"
        : "bg-red-950/40 text-red-300 border-red-900";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${style}`}>
      ATS {score}%
    </span>
  );
}
```

### Card placement

In each dashboard card row, add the badge only when `ats_status === "complete"` and the parsed score is a finite number. Place beside the existing generation-status pill on the same line (both are pills; both shrink-0).

### Edge cases

- `ats_status !== 'complete'` → no badge
- `ats_analysis->>score` is null or non-numeric → no badge
- Score exactly 40 or 70 → uses the higher tier (>=40 = amber, >=70 = emerald)

---

## 4. Re-run button

### `AtsScoreCard` — add Re-run action

Import `runAtsAnalysis` from `@/app/prep/[id]/ats-actions` and `PendingButton` from `./PendingButton`. Accept a `sessionId: string` prop (the card's parent passes it). Bind the action:

```typescript
export function AtsScoreCard({
  analysis,
  sessionId,
}: {
  analysis: AtsAnalysis;
  sessionId: string;
}) {
  const rerunAction = runAtsAnalysis.bind(null, sessionId);
  // ... existing JSX, but header row gets a form with PendingButton ...
}
```

Header layout updates to include the button at the right edge:

```tsx
<div className="flex flex-col gap-6 md:flex-row md:items-center">
  <div className="flex shrink-0 items-center gap-4">
    {/* existing SVG + score labels */}
  </div>
  <p className="text-sm text-zinc-300 md:flex-1">{analysis.overall_assessment}</p>
  <form action={rerunAction}>
    <PendingButton
      idleLabel="↻ Re-run"
      pendingLabel="Re-running…"
      variant="secondary"
    />
  </form>
</div>
```

### `runAtsAnalysis` fix — `src/app/prep/[id]/ats-actions.ts`

Two changes:

1. Guard: allow re-run when status is `'complete'` or `'failed'`. Block only when `'generating'` (prevents concurrent runs).
2. Before running, explicitly clear the stored analysis so the UI re-renders `AtsSkeleton` during regeneration.

```typescript
// Concurrency guard — only block while another run is in-flight.
if (session.ats_status === "generating") {
  revalidatePath(`/prep/${sessionId}`);
  return;
}

await supabase
  .from("prep_sessions")
  .update({
    ats_status: "generating",
    ats_analysis: null,       // clear stored result so UI shows skeleton
    ats_error_message: null,
  })
  .eq("id", sessionId);
```

Everything after the update is unchanged.

### Caller propagation — `src/app/prep/[id]/page.tsx`

The `AtsScoreCard` call site must now pass `sessionId`:

```tsx
return <AtsScoreCard analysis={parsed.data} sessionId={session.id} />;
```

(Already have `session.id` in scope; one-line change inside `renderAtsBlock`.)

---

## 5. Error handling

No new paths. Existing failure handling in `ats-actions.ts` catches `ClaudeResponseError` and persists raw response — unchanged. Re-run on a previously-failed analysis transitions `failed → generating` → either `complete` or `failed` again.

---

## 6. Testing

### Unit

None — no new Zod schemas, no new pure functions worth testing.

### E2E

Extend `tests/e2e/ats.spec.ts` with two additions:

1. **Dashboard badge renders after ATS completes** — after the existing "run ATS match" test completes and the score card is visible, navigate to `/dashboard`, verify `ATS 73%` badge shows in that prep's card (73 is the score in MOCK_ATS fixture). No badge on a brand-new prep with no ATS run.
2. **Re-run transitions through skeleton** — click the Re-run button on the complete score card, verify `AtsSkeleton` briefly appears (check for its `role="status"` element or its skeleton-specific text), then verify the score card renders again.

---

## 7. Files touched

**New:**
- `src/components/prep/AtsScoreBadge.tsx`

**Modified:**
- `src/app/dashboard/page.tsx` (query + badge rendering)
- `src/app/prep/[id]/ats-actions.ts` (guard relaxation + clear state)
- `src/app/prep/[id]/page.tsx` (pass `sessionId` to AtsScoreCard)
- `src/components/prep/AtsScoreCard.tsx` (accept `sessionId` prop + Re-run button)
- `tests/e2e/ats.spec.ts` (extend existing test OR add two new test cases)

**Unchanged:**
- Schemas, migrations, Anthropic client, ATS prompt, pipeline, skeleton, failed component

---

## 8. Done criteria

- [ ] Dashboard shows `ATS X%` pill on cards with a completed analysis; color = red/amber/emerald at <40 / 40-69 / ≥70
- [ ] No badge on preps that haven't run ATS
- [ ] "↻ Re-run" button visible on AtsScoreCard when status is complete
- [ ] Clicking re-run transitions UI: complete → skeleton → complete (or failed)
- [ ] Concurrent clicks (double-fire) don't stack — one re-run, subsequent clicks no-op while `generating`
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` all pass
- [ ] E2E covers badge + re-run flow with MOCK_ANTHROPIC=1
