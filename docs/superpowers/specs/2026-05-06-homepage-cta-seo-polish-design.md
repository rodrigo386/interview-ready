# Homepage CTA & SEO Polish — Design

**Date:** 2026-05-06
**Status:** Draft → awaiting user review
**Scope:** Spec 1 of 2 spawned from competitive analysis of cvporvaga.com.br + audit feedback. Spec 2 (LinkedIn CV import) is decoupled and will be brainstormed separately.

---

## Background

A third-party audit flagged 3 high-priority issues on the PrepaVAGA landing:

1. Hero CTA `Preparar minha próxima vaga →` is generic and does not reinforce the unique value prop.
2. Title tag — flagged "alto".
3. Title length — flagged "alto".

A parallel competitive analysis showed that the BR market for CV-only ATS tools (CV por Vaga, AjustaCV, MeuCVPro, CV Ágil, SuaVagAI) is commoditized and price-compressed (R$7,80–R$30). Their products stop at the optimized PDF. PrepaVAGA's moat is the full 5-step interview prep kit with company intel + CV + ATS + question scripts — but the homepage CTA does not communicate that moat.

Positioning chosen during brainstorming:

- **Voice direction:** identity-led ("Quero entrar na entrevista preparado"), reinforcing prep over CV optimization.
- **Primary keyword:** `preparação para entrevista com IA`
- **Secondary keywords (long-tail cluster):** `preparar entrevista de emprego com IA`, `como se preparar para entrevista com IA`, `kit de entrevista`

Competing for `currículo ATS` is rejected — it conflicts with the chosen voice and brings price-sensitive traffic into a R$30/mo positioning.

---

## Goal

Close the 3 audit findings and align landing + /pricing SEO surface to the chosen positioning, in a single tactical PR (~2 hours of work, ~12 lines of net change, zero new dependencies, zero breaking changes).

## Non-goals

- LinkedIn CV import (separate spec; integration + parser + UX decisions).
- Comparison table vs competitors on /pricing (deferred until traffic justifies).
- New blog posts or new SEO landing pages.
- /signup, /login, /forgot-password metadata audit (transactional, low SEO value, blocked from indexing anyway).
- Image alt-text or accessibility audit.
- A/B testing infrastructure.
- Touching `brand-600` token or any design token.

## Confirmed via codebase exploration (no work needed)

- `FAQPage` JSON-LD already injected by `src/components/landing/Faq.tsx`.
- `Service` + `Product` JSON-LD already injected by `src/app/pricing/page.tsx`.
- `Organization` + `WebSite` JSON-LD already injected by `src/app/layout.tsx`.
- `src/app/sitemap.ts` includes `/`, `/pricing`, `/login`, `/signup`, `/termos`, `/privacidade`, `/lgpd`, `/artigos` and per-post URLs.
- `src/app/robots.ts` blocks `/api/`, `/auth/`, `/admin`, `/dashboard`, `/profile`, `/prep/`, `/welcome/`, `/forgot-password`, `/reset` for both `*` and 18 named AI bots.
- `<html lang="pt-BR">` set in root layout.
- `alternates: { canonical: "/" }` set in root metadata.
- OG image route `src/app/opengraph-image.tsx` exists.

---

## Changes

### Change 1 — Hero CTA copy

**File:** `src/components/landing/Hero.tsx` (line 67)

```diff
- <span className="truncate">Preparar minha próxima vaga</span>
+ <span className="truncate">Quero entrar na entrevista preparado</span>
```

The `truncate` class stays — at 36 characters the new copy still fits the button on mobile. The trailing arrow `<span aria-hidden>→</span>` is kept.

`FinalCta.tsx` is intentionally **not changed** — it currently says `Começar grátis`, which gives intentional CTA variation across the page (identity-led at top, transactional at bottom). Both variants are valid, and changing both to the same string would reduce, not improve, conversion surface.

### Change 2 — Title tag (root)

**File:** `src/app/layout.tsx`

Three string locations all updated to the same new title:

- Line 28: `title.default`
- Line 47: `openGraph.title`
- Line 56: `twitter.title`

```diff
- "PrepaVaga · Preparação para entrevista com IA"
+ "Preparação para entrevista com IA — PrepaVaga"
```

Rationale:

- 45 chars (same length as current title, but keyword-first; sits just below the 50-60 sweet spot which is acceptable for branded queries).
- Keyword-first improves SERP scan-ability and is ranked higher by most title-quality heuristics.
- Em-dash `—` (U+2014) replaces middot `·` for visual differentiation from competitor titles that all use `·` or `|`.

Template (`title.template: "%s · PrepaVaga"`) is **kept as-is**. Inner pages with string `title` continue inheriting it.

### Change 3 — Meta description (root)

**File:** `src/app/layout.tsx` (line 22-23, plus reused in OG and Twitter)

```diff
- "Preparação para entrevista de emprego com IA: análise ATS do currículo, pesquisa da empresa, perguntas prováveis e CV reescrito para a vaga. A primeira prep é grátis."
+ "Preparação completa para entrevista com IA: análise ATS, pesquisa da empresa em tempo real, perguntas prováveis e CV reescrito. Primeira prep grátis."
```

- 170 chars → ~149 chars. Google truncates around 155-160; new version stays inside the cutoff.
- Adds "completa" — keyword that differentiates from CV-only tools.
- Adds "em tempo real" — reinforces the live-grounding moat.
- Drops redundant "do currículo", "para a vaga", "A" article.
- The constant `DESCRIPTION` is consumed in 3 places (`metadata.description`, `openGraph.description`, `twitter.description`, plus the `Organization` JSON-LD `description`). Single source of truth — one edit propagates.

### Change 4 — Keywords array (root)

**File:** `src/app/layout.tsx` (line 32-42)

```diff
  keywords: [
    "preparação para entrevista",
    "entrevista de emprego",
    "análise ATS",
    "currículo ATS",
    "perguntas de entrevista",
    "preparar entrevista",
-   "coach de carreira",
-   "IA carreira",
+   "preparar entrevista de emprego com IA",
+   "como se preparar para entrevista com IA",
+   "kit de entrevista",
    "PrepaVaga",
  ],
```

- Removes off-target terms (`coach de carreira` attracts coaching seekers; `IA carreira` is too vague).
- Adds 3 long-tail terms aligned to chosen secondary keyword cluster.
- Net effect: array goes from 9 → 10 entries. Bing weighs `keywords` slightly; Google ignores. Cost is zero, upside is small but free.

### Change 5 — /pricing title

**File:** `src/app/pricing/page.tsx` (line 10)

The current `title: "Planos e preços"` becomes `"Planos e preços · PrepaVaga"` (28 chars) once the root template applies. This wastes SERP space.

```diff
  export const metadata: Metadata = {
-   title: "Planos e preços",
+   title: { absolute: "Planos e preços — preparação para entrevista com IA · PrepaVaga" },
    description: ...,
```

- 63 chars total. Slightly above the strict 60-char guideline but well within Google's display budget for branded queries. The keyword frontload + brand suffix is the explicit choice.
- `title.absolute` opts out of the root template, giving us full control of the final string.
- `openGraph.title` (line 14) keeps the existing "Planos e preços · PrepaVaga" — OG title has different display rules (used by social cards, not SERP) and the punchier version reads better in shares.

### Change 6 — Verification only (no edit)

- Confirm `<html lang="pt-BR">` (already correct).
- Confirm sitemap, robots, JSON-LDs (already correct — listed in "Confirmed via codebase exploration" above).

---

## Files touched

| File | Lines changed | Nature |
|---|---|---|
| `src/components/landing/Hero.tsx` | 1 | copy |
| `src/app/layout.tsx` | ~10 (3 title strings + description constant + keywords array) | metadata |
| `src/app/pricing/page.tsx` | 1 | metadata |

Total: **3 files, ~12 lines net change.**

---

## Testing

Copy and metadata changes have no logic to unit-test meaningfully. Verification is empirical:

1. `pnpm typecheck` — green.
2. `pnpm test` — green (no test should regress; if any does, that test was over-asserting on copy strings).
3. `pnpm build` — green (Next.js validates metadata shape at build time; `title.absolute` shape change is type-checked).
4. **Manual visual on dev server:**
   - Landing: Hero CTA reads "Quero entrar na entrevista preparado".
   - View source `<title>`: `Preparação para entrevista com IA — PrepaVaga`.
   - View source `<meta name="description">`: new 152-char version.
   - /pricing view source `<title>`: full 65-char keyword-rich version.
5. **Production verification (post-deploy):**
   - Hit https://prepavaga.com.br/, confirm CTA + title.
   - Hit https://prepavaga.com.br/pricing, confirm title.
   - Optional: paste URL into https://search.google.com/test/rich-results to confirm structured data still validates.

If any unit test asserts on the old CTA copy or old title, update it as part of the same PR.

---

## Risks & rollback

| Risk | Likelihood | Mitigation |
|---|---|---|
| New CTA converts worse than old | Unknown — no A/B infra | 1-line revert. Watch funnel data via existing admin metrics for 7 days. |
| Title change tanks rankings short-term | Low — keyword overlap is very high; just reordered | Google reindex lag is 1-7 days; rankings normalize. |
| `title.absolute` typed differently than expected by Next.js | Very low | TypeScript catches at build. The `Metadata.title` type from `next` accepts `{ absolute: string }`. |
| Copy assertion in some test breaks | Medium | Adjust the assertion in same commit. |

---

## Definition of done

1. The 3 files above are edited per the diffs in this spec.
2. `pnpm typecheck` passes.
3. `pnpm test` passes (or any failing assertion on old copy is updated to new copy in the same commit).
4. `pnpm build` passes.
5. Manual visual check on dev server confirms new copy + new titles in HTML head.
6. Single commit pushed directly to `main` (per project's deploy convention — see CLAUDE.md §9 and `feedback_railway_auto_deploy.md`).
7. After Railway auto-deploy (~90s), spot-check https://prepavaga.com.br/ and /pricing in browser.

---

## Out of scope — explicit deferrals

These came up during brainstorming and were considered but rejected for this spec:

- Adding a comparison table on /pricing showing PrepaVAGA vs. CV-only competitors. Useful, but bloats the spec and delays the audit fix. Track separately.
- Creating a tier "CV-only R$5–R$7" to compete with AjustaCV. Strategic decision, not a tactical fix; needs financial modeling and product scoping.
- Renaming "Sem cartão. Primeira prep grátis." sub-CTA copy under the Hero button. Already good — no audit hit.
- Expanding sitemap or adding `BreadcrumbList` JSON-LD. Marginal SEO value; defer.

---

## Next step after this spec is approved

Invoke `superpowers:writing-plans` to produce the step-by-step implementation plan with explicit task breakdown. Implementation will follow the plan in a separate session.
