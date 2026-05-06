# Dark Mode for Prep Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert 12 static-hex design tokens (`orange`, `green`, `yellow`, `red`, `ink`, `line`) from `tailwind.config.ts` into CSS-var-backed tokens with `:root` (light) and `:root.dark` (dark) declarations in `globals.css`. Zero component file edits. Result: prep components flip correctly when `ThemeToggle` is used.

**Architecture:** 2 files edited (`tailwind.config.ts` + `globals.css`). Light mode RGB values mapped byte-for-byte from current hex (no light-mode visual drift). Dark mode values use Tailwind palette shades validated in `src/app/admin/page.tsx` (`*-300`, `*-950`, `zinc-100`/`zinc-200`/`zinc-400`/`zinc-800`).

**Tech Stack:** Tailwind v4 with `@config` directive, CSS variables with `<alpha-value>` placeholder, `next-themes` already wired.

**Spec reference:** `docs/superpowers/specs/2026-05-06-dark-mode-prep-tokens-design.md`

---

## File Structure

| File | Responsibility | Edits |
|---|---|---|
| `tailwind.config.ts` | Tailwind theme tokens | Replace 12 static-hex blocks with `rgb(var(--color-X) / <alpha-value>)` |
| `src/app/globals.css` | CSS variables for `:root` and `:root.dark` | Add 15 vars to `:root` (light, mapped from hex) + 15 vars to `:root.dark` (dark equivalents) |

No tests touched. No component touched. Single commit at end.

---

## Task 1: Update `tailwind.config.ts`

**Files:**
- Modify: `tailwind.config.ts` (lines 25-53)

- [ ] **Step 1: Replace the `orange` block**

Find:
```ts
        orange: {
          DEFAULT: "#F15A24",
          500: "#F15A24",
          700: "#D94818",
          soft: "#FFE7DC",
        },
```

Replace with:
```ts
        orange: {
          DEFAULT: "rgb(var(--color-orange-500) / <alpha-value>)",
          500: "rgb(var(--color-orange-500) / <alpha-value>)",
          700: "rgb(var(--color-orange-700) / <alpha-value>)",
          soft: "rgb(var(--color-orange-soft) / <alpha-value>)",
        },
```

- [ ] **Step 2: Replace the `green` block**

Find:
```ts
        green: {
          DEFAULT: "#2DB87F",
          500: "#2DB87F",
          700: "#1F7A56",
          soft: "#E0F5EB",
        },
```

Replace with:
```ts
        green: {
          DEFAULT: "rgb(var(--color-green-500) / <alpha-value>)",
          500: "rgb(var(--color-green-500) / <alpha-value>)",
          700: "rgb(var(--color-green-700) / <alpha-value>)",
          soft: "rgb(var(--color-green-soft) / <alpha-value>)",
        },
```

- [ ] **Step 3: Replace the `yellow` block**

Find:
```ts
        yellow: {
          DEFAULT: "#F5B800",
          500: "#F5B800",
          700: "#B08600",
          soft: "#FFF4D1",
        },
```

Replace with:
```ts
        yellow: {
          DEFAULT: "rgb(var(--color-yellow-500) / <alpha-value>)",
          500: "rgb(var(--color-yellow-500) / <alpha-value>)",
          700: "rgb(var(--color-yellow-700) / <alpha-value>)",
          soft: "rgb(var(--color-yellow-soft) / <alpha-value>)",
        },
```

- [ ] **Step 4: Replace the `red` block**

Find:
```ts
        red: {
          DEFAULT: "#E54848",
          500: "#E54848",
          soft: "#FDE3E3",
        },
```

Replace with:
```ts
        red: {
          DEFAULT: "rgb(var(--color-red-500) / <alpha-value>)",
          500: "rgb(var(--color-red-500) / <alpha-value>)",
          soft: "rgb(var(--color-red-soft) / <alpha-value>)",
        },
```

- [ ] **Step 5: Replace the `ink` block**

Find:
```ts
        ink: {
          DEFAULT: "#1A1A1A",
          2: "#4A4A4A",
          3: "#8A8A8A",
        },
```

Replace with:
```ts
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          2: "rgb(var(--color-ink-2) / <alpha-value>)",
          3: "rgb(var(--color-ink-3) / <alpha-value>)",
        },
```

- [ ] **Step 6: Replace the `line` token**

Find:
```ts
        line: "#E8E8E8",
```

Replace with:
```ts
        line: "rgb(var(--color-line) / <alpha-value>)",
```

- [ ] **Step 7: Verify file is syntactically clean**

Run:
```bash
pnpm typecheck
```

Expected: exit 0. If a TS error surfaces, double-check that the JSON-like `colors` object is still valid (commas correct, braces balanced, every value is a string).

---

## Task 2: Update `src/app/globals.css` `:root` block

**Files:**
- Modify: `src/app/globals.css` (lines 29-32, the prep gauge block)

- [ ] **Step 1: Insert 15 CSS vars after the existing prep gauge block**

Find:
```css
  /* PrepaVaga Opção A — gauge color tokens (consumed via CSS var em Gauge.tsx) */
  --prep-red: #E54848;
  --prep-yellow: #F5B800;
  --prep-green: #2DB87F;
```

Replace with:
```css
  /* PrepaVaga Opção A — gauge color tokens (consumed via CSS var em Gauge.tsx) */
  --prep-red: #E54848;
  --prep-yellow: #F5B800;
  --prep-green: #2DB87F;

  /* PrepaVaga Opção A — semantic palette tokens (mapped from tailwind.config.ts) */
  --color-orange-500: 241 90 36;        /* #F15A24 */
  --color-orange-700: 217 72 24;        /* #D94818 */
  --color-orange-soft: 255 231 220;     /* #FFE7DC */
  --color-green-500: 45 184 127;        /* #2DB87F */
  --color-green-700: 31 122 86;         /* #1F7A56 */
  --color-green-soft: 224 245 235;      /* #E0F5EB */
  --color-yellow-500: 245 184 0;        /* #F5B800 */
  --color-yellow-700: 176 134 0;        /* #B08600 */
  --color-yellow-soft: 255 244 209;     /* #FFF4D1 */
  --color-red-500: 229 72 72;           /* #E54848 */
  --color-red-soft: 253 227 227;        /* #FDE3E3 */
  --color-ink: 26 26 26;                /* #1A1A1A */
  --color-ink-2: 74 74 74;              /* #4A4A4A */
  --color-ink-3: 138 138 138;           /* #8A8A8A */
  --color-line: 232 232 232;            /* #E8E8E8 */
```

15 vars total. Light mode now declares the same hex values as before, just expressed as space-separated RGB.

---

## Task 3: Update `src/app/globals.css` `:root.dark` block

**Files:**
- Modify: `src/app/globals.css` (after the zinc dark mapping block, around line 75)

- [ ] **Step 1: Insert 15 dark-mode vars after the existing zinc dark block**

Find:
```css
  /* Zinc palette — DARK MODE mapping (Tailwind defaults) */
  --zinc-950: 9 9 11;
  --zinc-900: 24 24 27;
  --zinc-800: 39 39 42;
  --zinc-700: 63 63 70;
  --zinc-600: 82 82 91;
  --zinc-500: 113 113 122;
  --zinc-400: 161 161 170;
  --zinc-300: 212 212 216;
  --zinc-200: 228 228 231;
  --zinc-100: 244 244 245;
  --zinc-50:  250 250 250;
}
```

Replace with:
```css
  /* Zinc palette — DARK MODE mapping (Tailwind defaults) */
  --zinc-950: 9 9 11;
  --zinc-900: 24 24 27;
  --zinc-800: 39 39 42;
  --zinc-700: 63 63 70;
  --zinc-600: 82 82 91;
  --zinc-500: 113 113 122;
  --zinc-400: 161 161 170;
  --zinc-300: 212 212 216;
  --zinc-200: 228 228 231;
  --zinc-100: 244 244 245;
  --zinc-50:  250 250 250;

  /* PrepaVaga Opção A — semantic palette in dark mode
     - *-500/700 collapse to a single light shade against dark bg
     - *-soft becomes a desaturated dark tint
     - ink/* flip to light grays
     - line uses zinc-800 for harmonious dark border */
  --color-orange-500: 251 146 60;       /* tailwind orange-400 */
  --color-orange-700: 251 146 60;       /* same as 500 in dark */
  --color-orange-soft: 67 20 7;         /* tailwind orange-950 */
  --color-green-500: 134 239 172;       /* tailwind green-300 */
  --color-green-700: 134 239 172;
  --color-green-soft: 5 46 22;          /* tailwind green-950 */
  --color-yellow-500: 253 224 71;       /* tailwind yellow-300 */
  --color-yellow-700: 253 224 71;
  --color-yellow-soft: 66 32 6;         /* tailwind yellow-950 */
  --color-red-500: 252 165 165;         /* tailwind red-300 */
  --color-red-soft: 69 10 10;           /* tailwind red-950 */
  --color-ink: 244 244 245;             /* tailwind zinc-100 */
  --color-ink-2: 212 212 216;           /* tailwind zinc-300 */
  --color-ink-3: 161 161 170;           /* tailwind zinc-400 */
  --color-line: 39 39 42;               /* tailwind zinc-800 */
}
```

The `}` closes the `:root.dark` block; do NOT introduce an extra brace.

---

## Task 4: Verification gate — typecheck + tests + build

- [ ] **Step 1: Run typecheck**

Run:
```bash
pnpm typecheck
```
Expected: exit 0.

- [ ] **Step 2: Run full test suite**

Run:
```bash
pnpm test
```
Expected: 199/199 pass (no test file changed).

- [ ] **Step 3: Run production build**

Run:
```bash
pnpm build
```
Expected: build completes. Tailwind compiles the new `rgb(var(...))` references — they are syntactically valid color values whether or not the var resolves.

If any step fails, fix inline and re-run before proceeding.

---

## Task 5: Manual visual verification

This is the irreplaceable gate for this PR — visual regression is the entire failure mode.

- [ ] **Step 1: Start dev server**

Run:
```bash
pnpm dev
```

Wait for `ready`.

- [ ] **Step 2: Light mode comparison**

Open http://localhost:3000/prep/new (logged in). Should look identical to current production. Specifically check:
- Form labels and helper text are dark gray, readable.
- Borders around dropzone and CV picker are visible.
- The new LinkedIn helper card from prior PR has its existing orange-soft background.
- "Sem cartão. Primeira prep grátis" footer text below CTA is light gray.

If any text/border looks visibly different from production, the RGB→hex mapping has drifted; recheck Task 2 byte-for-byte.

- [ ] **Step 3: Dark mode flip**

Find the `ThemeToggle` in the app shell (typically near the avatar menu or in landing nav). Switch to dark.

Confirm on `/prep/new`:
- Page background goes deep gray/black.
- Form labels are light gray (was dark gray, should now flip).
- Dropzone border is visible against dark bg (zinc-800-ish).
- LinkedIn helper card shows dark-tinted orange background, not stark white.
- All text remains legible (no white-on-white, no black-on-black).

- [ ] **Step 4: Spot-check existing prep**

Navigate to any existing prep at `/prep/[id]` (use one from your dashboard, or create a new one if none exists). In dark mode, walk:
- `/prep/[id]` — Tela 1 (Visão geral). CompanyCard, JobCard, IntelCard should all be legible.
- `/prep/[id]/ats` — ATS gauge keeps its red/yellow/green semantic colors (these come from `--prep-*` vars, NOT changed by this PR — they should still display vividly).
- `/prep/[id]/likely` — QuestionCard with orange accent should still show the orange.
- `/prep/[id]/deep-dive` — yellow accent.
- `/prep/[id]/ask` — green accent.

Each accent color should be a lighter, more saturated version in dark (matches `*-300`/`*-400` shades).

- [ ] **Step 5: Spot-check `/admin`**

Navigate to `/admin` in dark mode. This area already had explicit `dark:` overrides — confirm nothing broke. Status badges should still show their `dark:bg-*-950/40 dark:text-*-300` look.

- [ ] **Step 6: Switch back to light mode**

Toggle theme back. Confirm everything reverts to the original light visuals. No state should persist incorrectly.

- [ ] **Step 7: Stop dev server (Ctrl+C).**

If anything looks broken, jump back to Task 2 or Task 3 and adjust the affected `--color-*` value, then re-run Task 4 + 5.

---

## Task 6: Single commit + push to main

- [ ] **Step 1: Stage the 2 files**

Run:
```bash
git add tailwind.config.ts src/app/globals.css
```

- [ ] **Step 2: Confirm staged diff**

Run:
```bash
git diff --staged --stat
```

Expected: 2 files, roughly `~50 insertions(+), ~20 deletions(-)`.

Run:
```bash
git diff --staged
```

Read through. Verify:
- `tailwind.config.ts` shows 6 blocks updated with `rgb(var(...))` refs.
- `globals.css` `:root` gained 15 new `--color-*` lines.
- `globals.css` `:root.dark` gained 15 new `--color-*` lines.
- Nothing else changed.

If anything looks off, `git reset HEAD -- <file>` and fix.

- [ ] **Step 3: Commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
feat(theme): dark mode tokens pra componentes prep/*

Converte 12 tokens hex-fixos do tailwind.config.ts (orange, green,
yellow, red, ink, line) em CSS-var-backed (rgb(var(--color-X) /
<alpha-value>)) e adiciona valores light/dark em globals.css.

Light mode pixel-identical (RGB mapeado byte-a-byte do hex original).
Dark mode usa shades *-300/*-950/zinc-100 ja validadas em
admin/page.tsx — fecha o gap apontado no final review da Spec 2.

ZERO mudanca em src/components/prep/* (160 ocorrencias dos tokens em
33 arquivos ficam intactas e flippam automaticamente via ThemeToggle).

Spec: docs/superpowers/specs/2026-05-06-dark-mode-prep-tokens-design.md
Plan: docs/superpowers/plans/2026-05-06-dark-mode-prep-tokens.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

- [ ] **Step 4: Push**

Run:
```bash
git push origin main
```

Expected: push succeeds.

If the harness blocks the push, report — the user has to manually push.

- [ ] **Step 5: Verify post-deploy (after ~90s Railway rebuild)**

In a browser:
- https://prepavaga.com.br/prep/new — confirm light mode looks unchanged.
- Toggle to dark mode — confirm prep area is now legible.

---

## Definition of Done

All checkboxes in Tasks 1-6 are checked. Specifically:
- 2 files modified per the diffs.
- `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
- Manual visual gate confirms light mode pixel-identical AND dark mode legible across `/prep/new`, `/prep/[id]/*`, `/admin`.
- Single commit pushed to `main`.
- Production confirms post-deploy.
