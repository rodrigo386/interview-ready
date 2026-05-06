# Dark Mode for Prep Tokens — Design

**Date:** 2026-05-06
**Status:** Draft → awaiting user review
**Scope:** Spec 3 (post-shipped). Out of original brainstorm cycle — this addresses the "dark mode debt" surfaced in the final code review of Spec 2.

---

## Background

PrepaVAGA already has working dark mode infrastructure:
- `next-themes@0.4.6` is installed and wired via `src/components/ThemeProvider.tsx` (`attribute="class"`, `storageKey="prepavaga-theme"`).
- `src/components/ThemeToggle.tsx` exists and is rendered in app shells.
- `tailwind.config.ts` has `darkMode: "class"`.
- `src/app/globals.css` already defines `:root` and `:root.dark` blocks with CSS-var-backed semantic tokens (`--color-bg`, `--color-text-primary`, etc.) and a remapped zinc palette.

**The debt:** 12 design tokens used heavily in `src/components/prep/*` (and a few in `src/app/admin/*`) are defined in `tailwind.config.ts` as **static hex strings**, not CSS-var-backed:

```ts
orange:  { DEFAULT: "#F15A24", 500: "#F15A24", 700: "#D94818", soft: "#FFE7DC" },
green:   { DEFAULT: "#2DB87F", 500: "#2DB87F", 700: "#1F7A56", soft: "#E0F5EB" },
yellow:  { DEFAULT: "#F5B800", 500: "#F5B800", 700: "#B08600", soft: "#FFF4D1" },
red:     { DEFAULT: "#E54848", 500: "#E54848", soft: "#FDE3E3" },
ink:     { DEFAULT: "#1A1A1A", 2: "#4A4A4A", 3: "#8A8A8A" },
line:    "#E8E8E8",
```

Footprint (per Explore agent grep): **160 occurrences across 33 prep components**. In dark mode (when `:root.dark` is active and `--color-bg` flips to deep gray), these tokens stay light-mode hex → near-invisible text and harsh borders against dark surfaces.

The fix is mechanical: rebuild the 12 tokens as CSS-var-backed (matching the existing pattern for `bg`, `surface`, `text`, `border`), then add the matching `--color-*` declarations to `:root` (preserving current light mode pixel-for-pixel) and `:root.dark` (with dark-friendly values).

**Zero changes to `src/components/prep/*`** — the components keep using the same Tailwind classes and inherit dark mode automatically.

---

## Goal

Close the prep dark mode debt in a single PR. After this ships, toggling between light and dark via `ThemeToggle` flips all prep components correctly without any per-component edit.

## Non-goals

- Changing any component file in `src/components/prep/*` (or anywhere else).
- Adjusting `brand-*` palette (used in landing/dashboard, already works on both light and dark backgrounds).
- Adjusting `--prep-red`, `--prep-yellow`, `--prep-green` CSS vars used by `Gauge.tsx` (these are semantic indicator colors that should stay visually distinct in both modes; they're already legible enough).
- Adjusting `borderRadius`, `boxShadow`, or other non-color tokens.
- Adding a "system" theme detection beyond what `next-themes` already provides.
- Tweaking the actual color choices for light mode (preserve current visual exactly).
- Auditing other static-hex tokens elsewhere in the codebase (out of scope; only the 12 above are in active use in prep/*).

## Confirmed via codebase exploration

- 160 occurrences across 33 prep components (per parallel Explore agent grep).
- `src/components/landing/*` already uses `dark:` prefixes and CSS-var-backed semantic tokens — works correctly.
- `src/app/admin/*` uses an inline pattern like `bg-green-soft text-green-700 dark:bg-green-950/40 dark:text-green-300` — works correctly in dark mode but the `bg-green-soft` and `text-green-700` are currently the static-hex tokens, so the LIGHT-mode side is fine but using static tokens means admin pages already work because they have explicit `dark:` overrides. This spec doesn't break them.
- `:root.dark` block already exists and is the right place to add the new vars.
- Tailwind v4 `@config` directive in globals.css (`@config "../../tailwind.config.ts";`) means the JS config file is the source of truth; CSS-var refs in JS work via the standard `rgb(var(--name) / <alpha-value>)` syntax.

---

## Changes

### Change 1 — `tailwind.config.ts`

Replace the static-hex `orange`, `green`, `yellow`, `red`, `ink`, and `line` blocks (lines 25-53) with CSS-var-backed equivalents.

```diff
-        orange: {
-          DEFAULT: "#F15A24",
-          500: "#F15A24",
-          700: "#D94818",
-          soft: "#FFE7DC",
-        },
-        green: {
-          DEFAULT: "#2DB87F",
-          500: "#2DB87F",
-          700: "#1F7A56",
-          soft: "#E0F5EB",
-        },
-        yellow: {
-          DEFAULT: "#F5B800",
-          500: "#F5B800",
-          700: "#B08600",
-          soft: "#FFF4D1",
-        },
-        red: {
-          DEFAULT: "#E54848",
-          500: "#E54848",
-          soft: "#FDE3E3",
-        },
-        ink: {
-          DEFAULT: "#1A1A1A",
-          2: "#4A4A4A",
-          3: "#8A8A8A",
-        },
-        line: "#E8E8E8",
+        orange: {
+          DEFAULT: "rgb(var(--color-orange-500) / <alpha-value>)",
+          500: "rgb(var(--color-orange-500) / <alpha-value>)",
+          700: "rgb(var(--color-orange-700) / <alpha-value>)",
+          soft: "rgb(var(--color-orange-soft) / <alpha-value>)",
+        },
+        green: {
+          DEFAULT: "rgb(var(--color-green-500) / <alpha-value>)",
+          500: "rgb(var(--color-green-500) / <alpha-value>)",
+          700: "rgb(var(--color-green-700) / <alpha-value>)",
+          soft: "rgb(var(--color-green-soft) / <alpha-value>)",
+        },
+        yellow: {
+          DEFAULT: "rgb(var(--color-yellow-500) / <alpha-value>)",
+          500: "rgb(var(--color-yellow-500) / <alpha-value>)",
+          700: "rgb(var(--color-yellow-700) / <alpha-value>)",
+          soft: "rgb(var(--color-yellow-soft) / <alpha-value>)",
+        },
+        red: {
+          DEFAULT: "rgb(var(--color-red-500) / <alpha-value>)",
+          500: "rgb(var(--color-red-500) / <alpha-value>)",
+          soft: "rgb(var(--color-red-soft) / <alpha-value>)",
+        },
+        ink: {
+          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
+          2: "rgb(var(--color-ink-2) / <alpha-value>)",
+          3: "rgb(var(--color-ink-3) / <alpha-value>)",
+        },
+        line: "rgb(var(--color-line) / <alpha-value>)",
```

The `brand-*`, `surface-*`, `bg`, `text-*`, `border-*` entries stay UNTOUCHED. The `borderRadius` and `boxShadow` blocks stay untouched.

### Change 2 — `src/app/globals.css` `:root` block

Add 12 CSS variables to `:root` matching the light-mode hex values byte-for-byte (so the rendered light mode is pixel-identical to today). Insert after the existing prep gauge block (around line 32) and before the zinc palette block.

```diff
   /* PrepaVaga Opção A — gauge color tokens (consumed via CSS var em Gauge.tsx) */
   --prep-red: #E54848;
   --prep-yellow: #F5B800;
   --prep-green: #2DB87F;

+  /* PrepaVaga Opção A — semantic palette tokens (mapped from tailwind.config.ts) */
+  --color-orange-500: 241 90 36;        /* #F15A24 */
+  --color-orange-700: 217 72 24;        /* #D94818 */
+  --color-orange-soft: 255 231 220;     /* #FFE7DC */
+  --color-green-500: 45 184 127;        /* #2DB87F */
+  --color-green-700: 31 122 86;         /* #1F7A56 */
+  --color-green-soft: 224 245 235;      /* #E0F5EB */
+  --color-yellow-500: 245 184 0;        /* #F5B800 */
+  --color-yellow-700: 176 134 0;        /* #B08600 */
+  --color-yellow-soft: 255 244 209;     /* #FFF4D1 */
+  --color-red-500: 229 72 72;           /* #E54848 */
+  --color-red-soft: 253 227 227;        /* #FDE3E3 */
+  --color-ink: 26 26 26;                /* #1A1A1A */
+  --color-ink-2: 74 74 74;              /* #4A4A4A */
+  --color-ink-3: 138 138 138;           /* #8A8A8A */
+  --color-line: 232 232 232;            /* #E8E8E8 */
```

15 vars total (12 unique color slots + the 3 *-500 = DEFAULT aliases handled by Tailwind config without separate vars).

### Change 3 — `src/app/globals.css` `:root.dark` block

Add 14 vars (one per `--color-*` from Change 2; the `--color-line` deserves its own dark value distinct from a zinc shade). Values chosen to match the pattern already used in `src/app/admin/page.tsx` (`*-950/40` for soft backgrounds, `*-300`/`*-200` for text, `zinc-100`/`zinc-200`/`zinc-400`/`zinc-800` for ink/line):

```diff
   /* Zinc palette — DARK MODE mapping (Tailwind defaults) */
   --zinc-950: 9 9 11;
   ...
   --zinc-50:  250 250 250;
+
+  /* PrepaVaga Opção A — semantic palette in dark mode
+     - *-500 stays the same hue (semantic indicator color must stay recognizable)
+     - *-700 becomes a lighter shade (was deep, now light enough to read on dark bg)
+     - *-soft becomes a desaturated dark tint (was light pastel, now dark with same hue)
+     - ink/* flip to light grays
+     - line uses zinc-800 for harmonious dark border */
+  --color-orange-500: 251 146 60;       /* tailwind orange-400, lighter for dark bg */
+  --color-orange-700: 251 146 60;       /* same: dark bg needs lighter accent text */
+  --color-orange-soft: 67 20 7;         /* tailwind orange-950 */
+  --color-green-500: 134 239 172;       /* tailwind green-300 */
+  --color-green-700: 134 239 172;
+  --color-green-soft: 5 46 22;          /* tailwind green-950 */
+  --color-yellow-500: 253 224 71;       /* tailwind yellow-300 */
+  --color-yellow-700: 253 224 71;
+  --color-yellow-soft: 66 32 6;         /* tailwind yellow-950 */
+  --color-red-500: 252 165 165;         /* tailwind red-300 */
+  --color-red-soft: 69 10 10;           /* tailwind red-950 */
+  --color-ink: 244 244 245;             /* tailwind zinc-100 */
+  --color-ink-2: 212 212 216;           /* tailwind zinc-300 */
+  --color-ink-3: 161 161 170;           /* tailwind zinc-400 */
+  --color-line: 39 39 42;               /* tailwind zinc-800 */
```

**Decision: collapse `*-700` to the same value as `*-500` in dark mode.** Rationale: the original light mode had `*-700` as a darker shade for text/accents, but in dark mode the contrast direction inverts — both 500 and 700 need to be light shades against the dark bg. Picking different brightness levels for both would over-engineer; users reading dark mode see them functionally as the same accent color. Spec accepts this minor visual flattening as YAGNI.

### Change 4 — Verification only (no edit)

- Confirm `:root` light-mode visuals are pixel-identical to current production. (View `/prep/new`, `/prep/[id]`, `/admin` in light mode after the change → should look the same.)
- Confirm dark mode flip: toggle theme, walk through `/prep/new` and one existing prep (`/prep/[id]/ats`, `/prep/[id]/likely`) → text legible, borders visible, badges readable, no white-on-white or black-on-black.
- Spot-check the Gauge component in `/prep/[id]/ats` — its `--prep-*` CSS vars are unaffected.

---

## Files touched

| File | Lines | Nature |
|---|---|---|
| `tailwind.config.ts` | ~28 (replace 28 static-hex with 28 var-refs) | config |
| `src/app/globals.css` | ~35 added (15 in `:root` + 15 in `:root.dark` + comments + blank lines) | CSS |

**Total: 2 files, ~63 lines edited/added. Zero component file touched.** Zero new dependency. Zero migration. No breaking change to light mode appearance (verified via byte-identical RGB values).

---

## Testing

Pure CSS/config change. No unit test value (assertions on hex strings would test that we wrote what we wrote — circular).

Verification gate:
- `pnpm typecheck` — should pass (no TS code change).
- `pnpm test` — should pass (199/199 still green; no test change).
- `pnpm build` — should pass. CSS vars aren't validated at build time, so a typo in a var name would silently render as the CSS `unset` fallback — manual visual gate catches that.

Manual visual gate (REQUIRED, can't skip this one — visual regression is the entire point):
1. `pnpm dev`
2. Light mode: walk `/prep/new`, `/prep/[id]`, `/prep/[id]/ats`. Should look identical to before.
3. Toggle to dark mode (`ThemeToggle` in nav). Walk same pages. Should now have legible text, visible borders, readable badges. No white text on white bg, no black on black.
4. Spot-check `/admin` in dark mode (already worked before; should still work — admin uses explicit `dark:` overrides).

---

## Risks & rollback

| Risk | Mitigation |
|---|---|
| Light mode pixel drift due to RGB rounding | Light values mapped exactly from hex; no drift. |
| Dark mode contrast still fails WCAG AA in some component | Spot-check critical components manually; iterate on `:root.dark` values if needed. Tailwind palette values used here (`*-300`, `*-950`) are battle-tested. |
| Tailwind v4 `<alpha-value>` placeholder doesn't work in CSS var context | Already verified: `surface`, `bg`, `text`, `border`, and `zinc-*` blocks use this exact pattern and work in production today. Same syntax. |
| Some component uses `bg-orange/30` opacity syntax | Tailwind v4 supports this with `<alpha-value>` placeholder; no breakage expected. |
| User has light-mode preference but accidentally lands on dark | `next-themes` respects `defaultTheme` and `storageKey`; no behavior change. |

Rollback: 2-file revert. No data, no schema, no API affected.

---

## Definition of done

1. `tailwind.config.ts` and `globals.css` reflect the diffs above.
2. `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
3. Manual visual on dev server confirms:
   - Light mode looks identical to current prod.
   - Dark mode flips legibly (text readable, borders visible, badges contrasted).
4. Single commit pushed directly to `main` (per project convention).
5. After Railway auto-deploy (~90s), spot-check https://prepavaga.com.br/prep/new in light + dark.

---

## Out of scope — explicit deferrals

- WCAG AA full audit of all prep components in dark mode. Manual spot-check covers the critical paths; full audit can be a separate issue.
- Adjusting `brand-*` for dark mode (currently works because brand-orange is visible against both light and dark surfaces).
- Adjusting `--prep-*` gauge CSS vars (semantic indicator colors; intentionally consistent across modes).
- Theme persistence improvements (already handled by `next-themes`).
- Adding a "system" theme option (already supported by `next-themes`).
- Refactoring components in `src/components/prep/*` to use semantic `text-text-primary` instead of `text-ink` (would be ~33 file changes for cosmetic gain; current named tokens are fine).

---

## Next step after this spec is approved

Invoke `superpowers:writing-plans` to produce the step-by-step implementation plan.
