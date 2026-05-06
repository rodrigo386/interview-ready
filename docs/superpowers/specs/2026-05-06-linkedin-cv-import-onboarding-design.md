# LinkedIn CV Import Onboarding — Design

**Date:** 2026-05-06
**Status:** Draft → awaiting user review
**Scope:** Spec 2 of 2 spawned from competitive analysis of cvporvaga.com.br. Spec 1 (homepage CTA + SEO polish) is shipped.

---

## Background

Competitor `cvporvaga.com.br` and several adjacent BR ATS-CV tools (AjustaCV, MeuCVPro) advertise "import from LinkedIn URL" as a key onboarding feature. PrepaVAGA today supports CV upload (PDF / DOCX / TXT) and paste — no LinkedIn-specific flow.

LinkedIn's public profile API has been deprecated since 2018. The realistic options to bridge this gap are:

- **A: Lightweight "Save to PDF" guidance** — teach the user the LinkedIn → Recursos → Salvar como PDF flow, then reuse the existing PDF upload pipeline.
- **B: URL via Jina Reader** — paste URL, fetch with the existing Jina pattern. Fails for most LinkedIn profiles because the experience/education sections are gated behind login.
- **C: Paid scraper API (ProxyCurl, Phantombuster)** — paste URL, $0.10 USD per profile, ToS gray area.

Decision during brainstorming: ship **A** now (zero cost, zero ToS risk, ships in hours, reuses 100% of existing infra). **B** is rejected (creates broken expectations). **C** is parked until MRR justifies the per-import cost.

This spec defines the UX + components for option A.

---

## Goal

Reduce friction for users who want to bring their CV from LinkedIn, by surfacing the "Save to PDF" workflow inline in the CvPicker UI with a 3-step inline guide and a one-click "open LinkedIn" button. The actual PDF upload reuses the existing flow with zero changes to parsing, storage, or server actions.

## Non-goals

- Automatic URL fetch of LinkedIn profiles (Jina or ProxyCurl).
- OAuth Sign In with LinkedIn (the OAuth scope only exposes name/photo/email, useless for CV reconstruction).
- Detecting "this PDF came from LinkedIn" by content/filename heuristics.
- Renaming `cvs.file_name` automatically (e.g., turning `Profile.pdf` into `LinkedIn — User.pdf`).
- Adding analytics/telemetry on the new helper. Project has no analytics infra yet (per CLAUDE.md pendings).
- Any change to `CvPicker` modes, state, or server actions.
- Any new dependency.

## Confirmed via codebase exploration

- `src/components/prep/CvPicker.tsx` already supports 3 modes: `select` (existing CVs) / `upload` (PDF/DOCX/TXT) / `paste`. Hardcodes the dropzone copy "Arraste seu CV aqui, ou clique para escolher".
- `src/lib/files/parse.ts` handles PDF parsing (via `pdf-parse@2`) with sane caps (50 pages, 80k chars max, 200 chars min). LinkedIn-exported PDFs typically run 3-8 pages, well within limits.
- `src/components/prep/JobDescriptionPicker.tsx` already implements a URL fetch pattern (Jina Reader → Gemini cleanup). Mentioned for reference only — not reused in this spec.
- No existing LinkedIn-related code in `src/components/prep/`.
- Tailwind tokens used in the prep area: `orange-500`, `orange-700`, `orange-soft`, `line`, `ink`, `ink-2`, `ink-3`, `borderRadius.pill`. The new component reuses these.
- Tests in `src/components/**/*.test.{ts,tsx}` use vitest + jsdom + `@testing-library/jest-dom` (per `vitest.config.ts` + `vitest.setup.ts`). Component tests use React Testing Library.

---

## UX

A single new element added to `CvPicker`: a collapsible inline helper card titled "💼 Importar do LinkedIn", placed **immediately above the upload dropzone** and visible whenever the picker is in `select` or `upload` mode (hidden in `paste` mode for clarity).

### Collapsed state (default)

A subtle button:

```
[💼 Importar do LinkedIn  ▼]
```

Styled like a secondary action — small text, brand-orange accent on the icon, neutral border. Reuses existing `text-sm` + `border border-line` + `text-ink-2` classes.

### Expanded state (after click)

A card with exactly 3 numbered steps:

```
┌──────────────────────────────────────────┐
│ 💼 Importar do LinkedIn         [▲]     │
├──────────────────────────────────────────┤
│ 1. Abra seu perfil no LinkedIn           │
│    [→ Abrir meu LinkedIn]                │
│                                          │
│ 2. No canto superior direito do perfil,  │
│    clique em "Recursos" → "Salvar como   │
│    PDF". O download começa automatica-   │
│    mente.                                │
│                                          │
│ 3. Volte aqui e faça upload do PDF       │
│    baixado no campo abaixo. ↓            │
└──────────────────────────────────────────┘
```

- The chevron rotates between `▼` (collapsed) and `▲` (expanded). The button is a single element with `aria-expanded` toggling.
- The "Abrir meu LinkedIn" button is an `<a>` tag with `href="https://www.linkedin.com/in/me/"`, `target="_blank"`, `rel="noopener noreferrer"`. LinkedIn redirects `/in/me/` to the logged-in user's profile, or to login if signed out — standard LinkedIn behavior.
- No close button in the card body — the toggle in the header handles open/close. Single source of truth.

### Why inline, not modal

A modal forces a context switch and overhead for a 3-step instruction. The card is small, the steps are short, and the user is mid-flow uploading a CV — keeping the helper inline preserves continuity. The helper collapses by default so it doesn't intrude on returning users who already know the flow.

### Why above the dropzone, not inside

Placing the helper inside the dropzone (e.g., as a hint paragraph) clutters the dropzone copy and dilutes the primary action. Above is visually distinct, optional, and naturally read first by first-time users.

---

## Components

### New file: `src/components/prep/LinkedInImportHelper.tsx`

Client component. Pure presentational + local state.

**Interface:** zero props.

**State:** `const [expanded, setExpanded] = useState(false);`

**Render:**
- Collapsed: a `<button type="button" onClick={() => setExpanded(true)}>` with the icon + label + chevron.
- Expanded: a `<div>` containing the 3 numbered list items + the inline `<a>` to LinkedIn. The same toggle button at the top, with `aria-expanded={true}` and `▲` chevron.

**Styling:** Tailwind classes only. No CSS modules, no styled-jsx. Uses `border-line`, `bg-bg`, `bg-orange-soft`, `text-ink`, `text-ink-2`, `text-orange-700`, `rounded-md`, `text-sm`. Does NOT introduce any new color or spacing token.

**Accessibility:**
- The toggle button has `aria-expanded` and `aria-controls` pointing to the card body's `id`.
- The card body has matching `id` and `role="region"` with `aria-labelledby` on the header.
- The "Abrir meu LinkedIn" `<a>` has descriptive text ("Abrir meu LinkedIn em nova aba") in `aria-label`.

### Modified file: `src/components/prep/CvPicker.tsx`

Two-line addition:
1. `import { LinkedInImportHelper } from "./LinkedInImportHelper";` near the top.
2. `<LinkedInImportHelper />` placed at the start of the `mode !== "paste"` JSX block (currently at line 89), so it renders only when the dropzone is visible.

Zero changes to state, props, server actions, or behavior of any existing element.

### New file: `src/components/prep/LinkedInImportHelper.test.tsx`

Vitest + RTL component test. Three assertions:

1. **Renders collapsed by default.** The card body is not in the DOM. The toggle button has `aria-expanded="false"`.
2. **Expands on click.** Clicking the toggle reveals the 3 numbered steps. `aria-expanded="true"`. All 3 step texts are queryable.
3. **LinkedIn link is correct.** The "Abrir meu LinkedIn" anchor has `href="https://www.linkedin.com/in/me/"`, `target="_blank"`, `rel="noopener noreferrer"`.

No test added or modified in `CvPicker.tsx` — the helper insertion is mechanical and existing tests cover existing behavior.

---

## Files touched

| File | Lines | Nature |
|---|---|---|
| `src/components/prep/LinkedInImportHelper.tsx` | ~80 (new) | client component |
| `src/components/prep/CvPicker.tsx` | 2 (1 import + 1 JSX line) | insertion |
| `src/components/prep/LinkedInImportHelper.test.tsx` | ~40 (new) | vitest + RTL |

**Total: 3 files, ~120 lines new.** Zero deps. Zero migration. Zero breaking change.

---

## Testing

The single component test above. Plus the standard verification gate:

- `pnpm typecheck` — should pass.
- `pnpm test` — should pass (194 → 195 tests after adding the new spec, exact number depends on how many `it()` blocks).
- `pnpm build` — should pass (now that the MDX bug from spec 1's followup is fixed).
- Manual visual on dev server at `/prep/new`: helper renders, clicks expand correctly, link opens in new tab, layout sane on mobile + desktop.

---

## Risks & rollback

| Risk | Mitigation |
|---|---|
| LinkedIn moves "Salvar como PDF" out of "Recursos" menu | Step 2 copy needs a 1-line update. Watched periodically; this UI hasn't changed in 5+ years. |
| User clicks "Abrir meu LinkedIn" while signed out | Standard LinkedIn redirect to login. Step 1's instruction implies the user is logged in; acceptable. |
| Helper visually conflicts with existing dropzone styling | Manual visual gate catches this. Easy revert: comment out the JSX line. |
| Mobile layout (CvPicker is used on `/prep/new` which renders on mobile) | Helper uses responsive Tailwind classes; tested in manual gate. |

Rollback for each commit: revert is 1 line in CvPicker + delete 2 new files. Trivial.

---

## Definition of done

1. `LinkedInImportHelper` component exists, renders collapsed by default, expands on click.
2. `CvPicker` displays the helper above the dropzone in `select` and `upload` modes.
3. Helper test passes.
4. `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
5. Manual visual on `/prep/new` (logged-in dev session) confirms render + interaction.
6. Single commit pushed directly to `main` (per project convention).
7. After Railway auto-deploy (~90s), spot-check on https://prepavaga.com.br/prep/new.

---

## Out of scope — explicit deferrals

These came up during brainstorming and were considered but rejected for this spec:

- **Auto-detect that an uploaded PDF came from LinkedIn** (filename `Profile.pdf` or content heuristic). Adds complexity, not requested by users, no clear payoff.
- **Different copy for the dropzone when LinkedIn helper has been opened**. YAGNI — current "PDF, DOCX ou TXT · máximo 5MB" already covers it.
- **Show a "thank you" toast after successful upload of a LinkedIn-originated PDF**. Not distinguishable from a normal upload without state-tracking — defer.
- **Tracking analytics on helper open / LinkedIn click**. Project has no analytics yet.
- **Spec 3 (URL fetch via paid scraper)**. Re-evaluate when MRR > R$2k/month makes per-import cost negligible.

---

## Next step after this spec is approved

Invoke `superpowers:writing-plans` to produce the step-by-step implementation plan with explicit task breakdown.
