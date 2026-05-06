# Homepage CTA & SEO Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 4-file copy/metadata changes to align landing + /pricing + OG image to the chosen positioning ("preparação para entrevista com IA"), closing the 3 audit findings (CTA + title tag + title length) in a single PR.

**Architecture:** Pure copy/metadata patches. No new files, no new dependencies, no logic changes. All edits surgical: 1 line in Hero, 3 string constants in layout (title, description, keywords array entries), 1 metadata field in pricing, 2 strings in OG image. Net ~14 lines across 4 files.

**Tech Stack:** Next.js 15 App Router (`metadata` export), TypeScript, no test additions (copy assertions are circular; verification is via build + manual view-source).

**Spec reference:** `docs/superpowers/specs/2026-05-06-homepage-cta-seo-polish-design.md`

---

## File Structure

| File | Responsibility | Edits in this plan |
|---|---|---|
| `src/components/landing/Hero.tsx` | Hero section component | CTA button text |
| `src/app/layout.tsx` | Root metadata + JSON-LD | `title.default`, `openGraph.title`, `twitter.title`, `DESCRIPTION` const, `keywords` array |
| `src/app/pricing/page.tsx` | Pricing page (server component + metadata + Service/Product JSON-LD) | `metadata.title` → switch from string to `{ absolute: ... }` |
| `src/app/opengraph-image.tsx` | OG image generator (Next.js dynamic image route) | `alt` constant + visible subtitle text |

No tests touched (an upfront grep confirmed nothing in `tests/` or `**/*.test.*` asserts on the strings being changed). If `pnpm test` reveals an unforeseen assertion, fix it inline in Task 6.

---

## Task 1: Update Hero CTA copy

**Files:**
- Modify: `src/components/landing/Hero.tsx:67`

- [ ] **Step 1: Open the file and locate the button label**

The Hero CTA `<Link>` has its visible label inside `<span className="truncate">` at line 67.

- [ ] **Step 2: Replace the label**

Apply this edit:

```diff
-              <span className="truncate">Preparar minha próxima vaga</span>
+              <span className="truncate">Quero entrar na entrevista preparado</span>
```

The surrounding markup (`<Link href="/signup">`, button styles, trailing `<span aria-hidden>→</span>`, helper paragraph "Sem cartão. Primeira prep grátis.") stays unchanged.

- [ ] **Step 3: Quick visual sanity (optional, deferred to Task 6)**

No commit yet — Task 6 batches all changes into a single commit per the spec's DoD.

---

## Task 2: Update root metadata — title

**Files:**
- Modify: `src/app/layout.tsx` (3 title strings: lines 28, 47, 56)

- [ ] **Step 1: Update `title.default`**

```diff
   title: {
-    default: "PrepaVaga · Preparação para entrevista com IA",
+    default: "Preparação para entrevista com IA — PrepaVaga",
     template: "%s · PrepaVaga",
   },
```

The `template` field stays as-is — inner pages with string `title` keep inheriting `" · PrepaVaga"` suffix.

- [ ] **Step 2: Update `openGraph.title`**

```diff
   openGraph: {
-    title: "PrepaVaga · Preparação para entrevista com IA",
+    title: "Preparação para entrevista com IA — PrepaVaga",
     description: DESCRIPTION,
```

- [ ] **Step 3: Update `twitter.title`**

```diff
   twitter: {
     card: "summary_large_image",
-    title: "PrepaVaga · Preparação para entrevista com IA",
+    title: "Preparação para entrevista com IA — PrepaVaga",
     description: DESCRIPTION,
   },
```

- [ ] **Step 4: Verify** — `<title>` references in this file are now consistent: search the file for `PrepaVaga · Preparação` and confirm zero matches; search for `Preparação para entrevista com IA — PrepaVaga` and confirm 3 matches (default, openGraph, twitter).

Use Grep tool with pattern `PrepaVaga · Preparação` over `src/app/layout.tsx` — expect no results.
Use Grep tool with pattern `Preparação para entrevista com IA — PrepaVaga` over `src/app/layout.tsx` — expect 3 results.

---

## Task 3: Update root metadata — description

**Files:**
- Modify: `src/app/layout.tsx` (the `DESCRIPTION` const at line 22-23)

The `DESCRIPTION` constant is consumed by `metadata.description`, `openGraph.description`, `twitter.description`, AND the `Organization` JSON-LD. One edit propagates to all four.

- [ ] **Step 1: Replace the constant**

```diff
 const DESCRIPTION =
-  "Preparação para entrevista de emprego com IA: análise ATS do currículo, pesquisa da empresa, perguntas prováveis e CV reescrito para a vaga. A primeira prep é grátis.";
+  "Preparação completa para entrevista com IA: análise ATS, pesquisa da empresa em tempo real, perguntas prováveis e CV reescrito. Primeira prep grátis.";
```

- [ ] **Step 2: Verify**

Use Grep tool with pattern `Preparação para entrevista de emprego com IA: análise ATS do currículo` over `src/app/layout.tsx` — expect no results.
Use Grep tool with pattern `Preparação completa para entrevista com IA: análise ATS` over `src/app/layout.tsx` — expect 1 result.

---

## Task 4: Update root metadata — keywords array

**Files:**
- Modify: `src/app/layout.tsx` (lines 32-42, the `keywords` array)

- [ ] **Step 1: Replace two off-target entries with three long-tail entries**

```diff
   keywords: [
     "preparação para entrevista",
     "entrevista de emprego",
     "análise ATS",
     "currículo ATS",
     "perguntas de entrevista",
     "preparar entrevista",
-    "coach de carreira",
-    "IA carreira",
+    "preparar entrevista de emprego com IA",
+    "como se preparar para entrevista com IA",
+    "kit de entrevista",
     "PrepaVaga",
   ],
```

Net change: array goes from 9 entries to 10 (remove 2, add 3).

- [ ] **Step 2: Verify**

Use Grep tool with pattern `coach de carreira|IA carreira` (case-insensitive) over `src/app/layout.tsx` — expect no results.
Use Grep tool with pattern `kit de entrevista` over `src/app/layout.tsx` — expect 1 result.

---

## Task 5: Update /pricing title to absolute keyword-rich form

**Files:**
- Modify: `src/app/pricing/page.tsx` (line 10, the `title` field of `metadata`)

The current `title: "Planos e preços"` becomes `"Planos e preços · PrepaVaga"` (28 chars) after the root template applies — too short for SERP. Switching to `title.absolute` opts out of the template and gives full control.

- [ ] **Step 1: Replace the title field**

```diff
 export const metadata: Metadata = {
-  title: "Planos e preços",
+  title: { absolute: "Planos e preços — preparação para entrevista com IA · PrepaVaga" },
   description: `Free 1 prep grátis · Pro R$30/mês com uso ilimitado (fair use ~${PRO_MONTHLY_SOFT_CAP}/mês) · Per-use R$10. Cancele quando quiser.`,
   alternates: { canonical: "/pricing" },
   openGraph: {
     title: "Planos e preços · PrepaVaga",
```

`openGraph.title` (line 14) is **not changed** — OG cards have different display rules; the punchier "Planos e preços · PrepaVaga" reads better in social shares.

- [ ] **Step 2: Verify**

Use Grep tool with pattern `title: "Planos e preços",` over `src/app/pricing/page.tsx` — expect no results (the comma at end matters; the openGraph one is `title:` without comma at this position, with different surrounding text).
Use Grep tool with pattern `title: \{ absolute: "Planos e preços` over `src/app/pricing/page.tsx` — expect 1 result.

---

## Task 6: Update OG image alt + subtitle

**Files:**
- Modify: `src/app/opengraph-image.tsx` (lines 5-6 for alt; lines 115-116 for subtitle text)

- [ ] **Step 1: Update the `alt` constant**

```diff
 export const alt =
-  "PrepaVaga — Coach de carreira com IA. Entre pronto. Saia contratado.";
+  "PrepaVaga — Preparação para entrevista com IA. Entre pronto. Saia contratado.";
```

- [ ] **Step 2: Update the visible subtitle text**

```diff
           <div
             style={{
               marginTop: 24,
               fontSize: 28,
               lineHeight: 1.45,
               color: "#4A4A4A",
               maxWidth: 720,
             }}
           >
-            Coach de carreira com IA. Em minutos, o dossiê completo da sua próxima vaga: empresa
-            pesquisada, CV reescrito pra ATS e roteiros prontos.
+            Preparação para entrevista com IA. Em minutos, o dossiê completo da sua próxima vaga:
+            empresa pesquisada, CV reescrito pra ATS e roteiros prontos.
           </div>
```

The headline "Entre pronto. Saia contratado.", the logo SVG, the mini-CV decorations, and the orange pill CTA "Comece grátis" all stay identical.

- [ ] **Step 3: Verify**

Use Grep tool with pattern `Coach de carreira` over `src/app/opengraph-image.tsx` — expect no results.
Use Grep tool with pattern `Preparação para entrevista com IA` over `src/app/opengraph-image.tsx` — expect 2 results.

---

## Task 7: Verification gate — typecheck + tests + build

- [ ] **Step 1: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: exit code 0. If `title.absolute` shape mismatch surfaces, the `Metadata.title` type from `next` accepts `{ absolute: string }` — verify the import path of `Metadata` in `src/app/pricing/page.tsx` (already present, line 1). If still failing, double-check the diff syntax in Task 5.

- [ ] **Step 2: Run tests**

Run:
```bash
pnpm test
```

Expected: all tests pass. The upfront grep showed no test asserts on the changed strings, but if anything breaks (e.g., a snapshot that includes head metadata), update the assertion to match the new string in the same task. Do not snapshot-update blindly — read the diff first.

- [ ] **Step 3: Run production build**

Run:
```bash
pnpm build
```

Expected: build completes; Next.js metadata is validated at build time, so any malformed `Metadata` shape would surface here. The build also dry-runs OG image generation; if `opengraph-image.tsx` has a JSX syntax error, this catches it.

- [ ] **Step 4: If any of the above failed, fix inline and re-run**

Do not proceed to Task 8 with a red gate.

---

## Task 8: Manual visual verification on dev server

- [ ] **Step 1: Start dev server**

Run:
```bash
pnpm dev
```

Wait for `ready` line. The server typically binds to http://localhost:3000.

- [ ] **Step 2: Verify Hero CTA**

Open http://localhost:3000/ in a browser. Confirm the orange pill button under the hero reads **"Quero entrar na entrevista preparado →"**. Helper text below should still read "Sem cartão. Primeira prep grátis."

- [ ] **Step 3: Verify landing `<title>` and `<meta name="description">`**

In the browser, open View Source (or DevTools → Elements → `<head>`) on http://localhost:3000/ and confirm:
- `<title>` = `Preparação para entrevista com IA — PrepaVaga`
- `<meta name="description" content="Preparação completa para entrevista com IA: análise ATS, pesquisa da empresa em tempo real, perguntas prováveis e CV reescrito. Primeira prep grátis." />`
- `<meta property="og:title" content="Preparação para entrevista com IA — PrepaVaga" />`
- `<meta property="twitter:title" content="Preparação para entrevista com IA — PrepaVaga" />`

- [ ] **Step 4: Verify /pricing `<title>`**

Open http://localhost:3000/pricing. View Source. Confirm:
- `<title>` = `Planos e preços — preparação para entrevista com IA · PrepaVaga`
- `<meta property="og:title" content="Planos e preços · PrepaVaga" />` (intentionally unchanged)

- [ ] **Step 5: Verify OG image**

Open http://localhost:3000/opengraph-image directly in a browser tab — it returns a PNG. Confirm the visible subtitle reads "Preparação para entrevista com IA. Em minutos, o dossiê completo..." (no longer "Coach de carreira").

- [ ] **Step 6: If anything is wrong, jump back to the relevant Task and fix; re-run Task 7 gate.**

- [ ] **Step 7: Stop dev server (Ctrl+C).**

---

## Task 9: Commit + push to main

Per spec DoD #6 and project convention (CLAUDE.md §9 + `feedback_railway_auto_deploy.md`): single commit, push directly to `main`, Railway auto-deploys in ~90s.

- [ ] **Step 1: Stage the 4 changed files**

Run:
```bash
git add src/components/landing/Hero.tsx src/app/layout.tsx src/app/pricing/page.tsx src/app/opengraph-image.tsx
```

- [ ] **Step 2: Confirm staged diff matches the spec**

Run:
```bash
git diff --staged --stat
```

Expected: 4 files, roughly `4 files changed, ~16 insertions(+), ~12 deletions(-)`.

Run:
```bash
git diff --staged
```

Read through. Verify:
- Hero CTA changed to "Quero entrar na entrevista preparado".
- Layout title changed in 3 places, description shortened, keywords array updated (drop coach/IA carreira, add 3 long-tails).
- Pricing title is now `{ absolute: "..." }` shape.
- OG image alt + subtitle no longer mention "Coach de carreira".

If any line looks wrong, unstage with `git reset HEAD -- <file>` and fix.

- [ ] **Step 3: Commit**

Run (PowerShell-friendly heredoc):
```bash
git commit -m "$(cat <<'EOF'
seo(landing): CTA + title + meta + OG alinhados ao positioning de entrevista

Fecha 3 achados de auditoria (CTA generico, title tag, title length) e
alinha keywords/description/OG ao positioning identity-led "preparacao
para entrevista com IA" (primario) + cluster long-tail.

- Hero CTA: "Preparar minha proxima vaga" -> "Quero entrar na entrevista preparado"
- Title landing: keyword-first, em-dash separator, 45 chars
- Description landing: 170 -> 149 chars, adiciona "completa" + "em tempo real"
- Keywords: remove coach/IA carreira (off-target), adiciona 3 long-tails
- /pricing title: absolute 63 chars com keyword primaria
- OG image alt + subtitulo: remove "Coach de carreira" para coerencia

Spec: docs/superpowers/specs/2026-05-06-homepage-cta-seo-polish-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds (no pre-commit hook in this repo for these files).

- [ ] **Step 4: Push**

Run:
```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 5: Verify post-deploy (after ~90s)**

Wait for Railway deploy. Then in a browser:
- Hit https://prepavaga.com.br/, hard-refresh (Ctrl+Shift+R), confirm new CTA + new `<title>`.
- Hit https://prepavaga.com.br/pricing, confirm new `<title>`.
- Optional: paste https://prepavaga.com.br/ into https://search.google.com/test/rich-results to confirm Organization + WebSite + FAQPage JSON-LD still validate.

If any prod check fails, investigate via Railway deploy logs (user has CLI access). Do not roll back automatically — surface the failure and decide.

---

## Definition of Done

All checkboxes in Tasks 1-9 are checked. Specifically:
- 4 files modified per the diffs in this plan.
- `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
- Manual visual on dev server confirms new copy in 4 places (Hero CTA, landing title, pricing title, OG image subtitle).
- Single commit pushed to `main`.
- Production confirms new copy after Railway auto-deploy.
