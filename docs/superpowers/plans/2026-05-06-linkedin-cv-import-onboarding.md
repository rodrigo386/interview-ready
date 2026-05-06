# LinkedIn CV Import Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible inline helper to `CvPicker` that walks first-time users through "Save to PDF" on LinkedIn, then routes them through the existing PDF upload pipeline.

**Architecture:** One new client component (`LinkedInImportHelper`), one new component test, two-line insertion into `CvPicker`. Zero changes to state, server actions, parsing, storage. Pure presentational addition.

**Tech Stack:** React 19 client component, Tailwind v4 (existing tokens only), Vitest + React Testing Library + jsdom (per `vitest.config.ts` `environmentMatchGlobs`).

**Spec reference:** `docs/superpowers/specs/2026-05-06-linkedin-cv-import-onboarding-design.md`

---

## File Structure

| File | Responsibility | Edits |
|---|---|---|
| `src/components/prep/LinkedInImportHelper.tsx` | New collapsible helper card | Create (~80 lines) |
| `src/components/prep/LinkedInImportHelper.test.tsx` | Vitest + RTL component test | Create (~50 lines) |
| `src/components/prep/CvPicker.tsx` | Insert helper above dropzone | Modify (1 import + 1 JSX line) |

No other file touched. Commit at the very end as a single commit per project convention.

---

## Task 1: Write failing test for LinkedInImportHelper

**Files:**
- Create: `src/components/prep/LinkedInImportHelper.test.tsx`

- [ ] **Step 1: Write the test file**

Create `src/components/prep/LinkedInImportHelper.test.tsx` with this exact content:

```tsx
import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LinkedInImportHelper } from "./LinkedInImportHelper";

describe("<LinkedInImportHelper />", () => {
  it("renders collapsed by default", () => {
    const { getByRole, queryByText } = render(<LinkedInImportHelper />);
    const toggle = getByRole("button", { name: /importar do linkedin/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(queryByText(/abrir meu linkedin/i)).toBeNull();
    expect(queryByText(/recursos.*salvar como pdf/i)).toBeNull();
  });

  it("expands on click revealing the 3 steps", () => {
    const { getByRole, getByText } = render(<LinkedInImportHelper />);
    const toggle = getByRole("button", { name: /importar do linkedin/i });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(getByText(/abra seu perfil no linkedin/i)).toBeInTheDocument();
    expect(getByText(/recursos.*salvar como pdf/i)).toBeInTheDocument();
    expect(getByText(/volte aqui e faça upload/i)).toBeInTheDocument();
  });

  it("LinkedIn link points to /in/me/ and opens in new tab safely", () => {
    const { getByRole } = render(<LinkedInImportHelper />);
    fireEvent.click(getByRole("button", { name: /importar do linkedin/i }));
    const link = getByRole("link", { name: /abrir meu linkedin/i });
    expect(link.getAttribute("href")).toBe("https://www.linkedin.com/in/me/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("collapses again on second click", () => {
    const { getByRole, queryByText } = render(<LinkedInImportHelper />);
    const toggle = getByRole("button", { name: /importar do linkedin/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(queryByText(/abrir meu linkedin/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test -- LinkedInImportHelper.test.tsx
```

Expected: test fails because `./LinkedInImportHelper` doesn't exist yet. The error should be a module resolution error like `Cannot find module './LinkedInImportHelper'`.

If the error is anything else (e.g., a typo in the test file), fix the test before proceeding.

---

## Task 2: Implement LinkedInImportHelper component

**Files:**
- Create: `src/components/prep/LinkedInImportHelper.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/prep/LinkedInImportHelper.tsx` with this exact content:

```tsx
"use client";

import { useState } from "react";

const PANEL_ID = "linkedin-import-helper-panel";
const HEADER_ID = "linkedin-import-helper-header";

export function LinkedInImportHelper() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-line bg-bg">
      <button
        type="button"
        id={HEADER_ID}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={PANEL_ID}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-2 hover:bg-orange-soft/40"
      >
        <span aria-hidden className="text-orange-700">💼</span>
        <span className="font-medium">Importar do LinkedIn</span>
        <span aria-hidden className="ml-auto text-ink-3">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div
          id={PANEL_ID}
          role="region"
          aria-labelledby={HEADER_ID}
          className="border-t border-line bg-orange-soft/30 px-4 py-3 text-sm text-ink-2"
        >
          <ol className="space-y-3">
            <li>
              <p>
                <span className="font-semibold text-ink">1.</span> Abra seu
                perfil no LinkedIn.
              </p>
              <a
                href="https://www.linkedin.com/in/me/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir meu LinkedIn em nova aba"
                className="mt-1 inline-flex items-center gap-1 rounded-pill bg-white px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-500/40 hover:bg-orange-soft"
              >
                <span aria-hidden>→</span> Abrir meu LinkedIn
              </a>
            </li>
            <li>
              <p>
                <span className="font-semibold text-ink">2.</span> No canto
                superior do perfil, clique em &quot;Recursos&quot; →
                &quot;Salvar como PDF&quot;. O download começa
                automaticamente.
              </p>
            </li>
            <li>
              <p>
                <span className="font-semibold text-ink">3.</span> Volte aqui
                e faça upload do PDF baixado no campo abaixo. ↓
              </p>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the test to verify it passes**

Run:
```bash
pnpm test -- LinkedInImportHelper.test.tsx
```

Expected: all 4 tests pass.

If a test fails, read the failure carefully. Common causes:
- Missing/extra whitespace breaks `getByText` regex matches → adjust the regex in the test, not the component copy.
- `aria-expanded` reads as `"true"`/`"false"` strings (not booleans) when serialized to DOM — already handled in the test.
- If the test file's regex matches accidentally fail because of PT-BR diacritics in the assertions, double-check the component copy uses the same characters.

Do NOT commit yet.

---

## Task 3: Insert helper into CvPicker

**Files:**
- Modify: `src/components/prep/CvPicker.tsx`

- [ ] **Step 1: Add the import**

Open `src/components/prep/CvPicker.tsx`. Find the existing import block at the top:

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { uploadCv, type UploadCvState } from "@/app/prep/new/cv-actions";
```

Add a new import line right after the `uploadCv` import:

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { uploadCv, type UploadCvState } from "@/app/prep/new/cv-actions";
import { LinkedInImportHelper } from "./LinkedInImportHelper";
```

- [ ] **Step 2: Place the helper above the dropzone**

Find the existing JSX block that starts at line 89:

```tsx
      {mode !== "paste" && (
        <div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-8 text-center hover:border-zinc-700">
```

Replace with:

```tsx
      {mode !== "paste" && (
        <div className="space-y-3">
          <LinkedInImportHelper />
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-8 text-center hover:border-zinc-700">
```

The change is exactly two things:
1. Added `className="space-y-3"` on the wrapper `<div>` (was `<div>` with no class) so the helper and the dropzone get vertical spacing.
2. Added `<LinkedInImportHelper />` as the first child.

The dropzone `<label>` and the rest of the block remain unchanged. The closing `</div>` of this block already exists; do NOT add an extra one.

- [ ] **Step 3: Verify the file still typechecks in isolation**

Run:
```bash
pnpm typecheck
```

Expected: exit 0. If a typecheck error surfaces in `CvPicker.tsx`, the import path or JSX tag is wrong. Re-read Step 1 and Step 2 carefully.

---

## Task 4: Verification gate — typecheck + tests + build

- [ ] **Step 1: Run full typecheck**

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

Expected: all tests pass. Test count should be **194 + 4 = 198** (4 new tests added in Task 1). If the count is different, that's not necessarily a bug — just verify all existing tests still pass and the 4 new ones pass.

If any existing test fails because of the CvPicker change, read the failure. The CvPicker change is purely additive (insert a child component); existing tests should be unaffected unless they assert on exact DOM structure of the dropzone wrapper.

- [ ] **Step 3: Run production build**

Run:
```bash
pnpm build
```

Expected: build completes successfully. The MDX bug from spec 1's followup is already fixed (`9ed313a`), so no environmental issues should surface.

- [ ] **Step 4: If any of the above failed, fix inline and re-run.**

Do not proceed to Task 5 with a red gate.

---

## Task 5: Manual visual verification on dev server

- [ ] **Step 1: Start dev server**

Run:
```bash
pnpm dev
```

Wait for the `ready` line.

- [ ] **Step 2: Open the prep creation flow**

Navigate to http://localhost:3000/prep/new in a logged-in browser session. (If not logged in, log in first via http://localhost:3000/login.)

- [ ] **Step 3: Verify helper renders collapsed**

Above the "Arraste seu CV aqui" dropzone, confirm a button labeled **💼 Importar do LinkedIn ▼** appears. The dropzone itself should still look exactly as before.

- [ ] **Step 4: Verify expansion**

Click the helper button. Confirm:
- Chevron flips to ▲.
- A panel appears below with 3 numbered steps.
- Step 1 has a button **→ Abrir meu LinkedIn** that opens a new tab to LinkedIn.
- Step 2 mentions "Recursos" → "Salvar como PDF".
- Step 3 mentions "faça upload do PDF baixado no campo abaixo".

- [ ] **Step 5: Verify the LinkedIn link**

Click the **→ Abrir meu LinkedIn** button. A new tab opens to https://www.linkedin.com/in/me/. (If not logged into LinkedIn, it redirects to login — that's expected.)

- [ ] **Step 6: Verify collapse**

Click the helper button again. Panel collapses, chevron flips back to ▼.

- [ ] **Step 7: Mobile sanity check**

In DevTools, switch to a mobile viewport (e.g., iPhone 14, 390×844). Confirm the helper and the dropzone are still readable and don't overflow horizontally.

- [ ] **Step 8: Stop dev server (Ctrl+C).**

If anything is wrong, jump back to Task 2 (component) or Task 3 (insertion) and fix; re-run Task 4 gate before retrying Task 5.

---

## Task 6: Single commit + push to main

Per spec DoD #6 and project convention.

- [ ] **Step 1: Stage the 3 files**

Run:
```bash
git add src/components/prep/LinkedInImportHelper.tsx src/components/prep/LinkedInImportHelper.test.tsx src/components/prep/CvPicker.tsx
```

- [ ] **Step 2: Confirm staged diff**

Run:
```bash
git diff --staged --stat
```

Expected: 3 files changed, roughly `~170 insertions(+), 1 deletion(-)`.

Run:
```bash
git diff --staged
```

Read through. Verify:
- `LinkedInImportHelper.tsx` is the new component as written in Task 2.
- `LinkedInImportHelper.test.tsx` has the 4 `it()` blocks.
- `CvPicker.tsx` shows only +1 import line, +1 JSX line, and the `<div>` getting `className="space-y-3"`.

If anything is wrong, unstage with `git reset HEAD -- <file>` and fix.

- [ ] **Step 3: Commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
feat(prep): helper de import via LinkedIn no CvPicker

Adiciona card colapsavel "Importar do LinkedIn" acima do dropzone do
CvPicker, ensinando o caminho "Recursos -> Salvar como PDF" do LinkedIn
em 3 passos. PDF baixado entra no fluxo de upload existente sem
mudancas de infra.

- LinkedInImportHelper.tsx: novo client component (collapse + 3 steps
  + link para /in/me/ em nova aba)
- LinkedInImportHelper.test.tsx: vitest + RTL, 4 it() blocks
- CvPicker.tsx: 1 import + 1 JSX inserido acima do dropzone

Spec: docs/superpowers/specs/2026-05-06-linkedin-cv-import-onboarding-design.md
Plan: docs/superpowers/plans/2026-05-06-linkedin-cv-import-onboarding.md

Decisao da brainstorm: Opcao A (Save-to-PDF) em vez de URL+ProxyCurl.
Zero custo, zero ToS, ~120 linhas. Spec 3 (URL fetch pago) parado ate
MRR justificar custo de ~R$0,55 por import.

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

If the harness blocks the push (as it did during spec 1), STOP and report — the user has to manually push or approve. Do not work around the block.

- [ ] **Step 5: Verify post-deploy (after ~90s)**

Wait for Railway deploy. Then in a browser:
- Hit https://prepavaga.com.br/prep/new (logged in).
- Confirm the **💼 Importar do LinkedIn** helper appears above the dropzone.
- Click to expand, click the LinkedIn button, confirm new tab opens correctly.

If the prod check fails, investigate via Railway logs (user has CLI access). Do not roll back automatically — report and decide.

---

## Definition of Done

All checkboxes in Tasks 1-6 are checked. Specifically:

- 3 files created/modified per the diffs in this plan.
- All 4 new component tests pass.
- `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
- Manual visual on dev server confirms helper renders, expands, links correctly, and collapses.
- Single commit pushed to `main`.
- Production confirms the helper after Railway auto-deploy.
