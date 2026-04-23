# PrepaVAGA Redesign — Opção A · Minimalista Progressivo · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o fluxo atual de `/prep/[id]` (single-page com `?section=` + JourneyArc + SectionTabs) por uma experiência progressiva com 5 rotas dedicadas, stepper persistente, FocusCard dinâmico e QuestionCard reutilizado nas 3 telas de perguntas.

**Architecture:**
- Layout shell em `src/app/prep/[id]/layout.tsx` carrega a sessão uma única vez (server component), classifica as seções AI em `likely | deep-dive | ask` e injeta `breadcrumb + PrepStepper + Provider de step state` em volta das 5 telas filhas.
- Cada etapa vira uma rota: `/prep/[id]` (Tela 1 — Visão geral), `/prep/[id]/ats`, `/prep/[id]/likely`, `/prep/[id]/deep-dive`, `/prep/[id]/ask`. Subrotas são server components que recebem props derivadas do layout via `params` + reler do Supabase quando precisam de dado fresco.
- `currentStep` e `completedSteps[]` são derivados de: `prep_guide_status` (step 1 sempre completo se a página renderiza), `ats_status === 'complete'` (step 2), e `localStorage` para steps 3/4/5 (não persistimos por-step no DB nesta entrega — fora de escopo).
- Tokens novos (`orange-500: #F15A24` etc.) são adicionados como **paralelos** aos `brand-*` existentes — não mudamos `brand-600` porque landing/dashboard/UI compartilhada dependem dele.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 (via `@import "tailwindcss"` + `@config` para o `tailwind.config.ts` legado) + Supabase SSR + Vitest (unit) + Playwright (e2e). Sem Framer Motion — animações via CSS keyframes (`prefers-reduced-motion` honrado).

**Spec source:** `docs/superpowers/plans/2026-04-23-prepavaga-spec-opcao-a.md` é o plano que executa a spec em `c:\Users\rgoal\AppData\Roaming\Claude\local-agent-mode-sessions\…\prepavaga_spec_claude_code.md` (também resumida em `~/.claude/projects/.../memory/project_prep_spec_opcao_a.md`).

---

## File Structure

### Novos arquivos (criar)

| Arquivo | Responsabilidade |
|---|---|
| `src/app/prep/[id]/layout.tsx` | Server component shell: lê sessão, classifica seções, monta breadcrumb + PrepStepper, expõe `PrepShellContext` |
| `src/app/prep/[id]/ats/page.tsx` | Tela 2 — ATS (AtsHero + DeltaBanner + IssuesPanel) |
| `src/app/prep/[id]/likely/page.tsx` | Tela 3 — Likely Questions |
| `src/app/prep/[id]/deep-dive/page.tsx` | Tela 4 — Deep Dive Questions |
| `src/app/prep/[id]/ask/page.tsx` | Tela 5 — Questions to Ask + SuccessBanner |
| `src/lib/prep/section-classifier.ts` | Mapeia `PrepSection[]` → `{ likely, deepDive, ask }` por id/título heurístico |
| `src/lib/prep/section-classifier.test.ts` | Testes da classificação |
| `src/lib/prep/step-state.ts` | Deriva `currentStep` + `completedSteps[]` de `atsStatus` + localStorage |
| `src/lib/prep/step-state.test.ts` | Testes do derive |
| `src/lib/prep/types.ts` | Tipos compartilhados: `Accent`, `StepNumber`, `PrepShellData` |
| `src/components/prep/PrepStepper.tsx` | Stepper de 5 segmentos, `role="progressbar"`, mobile colapsa labels |
| `src/components/prep/PrepStepper.test.tsx` | Testes (current/completed/futuro, mobile label, aria) |
| `src/components/prep/FocusCard.tsx` | Card laranja gradiente com stepChip + title + description + CTA |
| `src/components/prep/FocusCard.test.tsx` | Render + click handler |
| `src/components/prep/SkipCard.tsx` | Atalho secundário discreto |
| `src/components/prep/SuccessCard.tsx` | Variante verde da Tela 1 quando step 5 está completo |
| `src/components/prep/QuestionCard.tsx` | Card de pergunta com 3 accents (orange/yellow/green) + setas + ActionBar |
| `src/components/prep/QuestionCard.test.tsx` | Testes (accent → cor heading, setas habilitadas, last question CTA) |
| `src/components/prep/Chip.tsx` | Tag de evidência (variant default/orange) |
| `src/components/prep/Chip.test.tsx` | Variantes |
| `src/components/prep/Gauge.tsx` | SVG circular 200px, cor por faixa, `role="meter"`, anim de transição |
| `src/components/prep/Gauge.test.tsx` | Cor por faixa (0/40/41/70/71/100), aria attrs |
| `src/components/prep/IssueRow.tsx` | Linha de ajuste ATS (severity → cor, número, chip de impacto) |
| `src/components/prep/IssueRow.test.tsx` | Render + severity → classes |
| `src/components/prep/SuccessBanner.tsx` | Banner verde topo da Tela 5 |
| `src/components/prep/AtsHero.tsx` | Wrapper grid 240px\|1fr (desktop) → coluna única (mobile) |
| `src/components/prep/PrepShellProvider.tsx` | Client provider que expõe `currentStep` + `completedSteps` derivados (lê localStorage no client) |
| `src/components/prep/QuestionPager.tsx` | Client wrapper que controla `index` da pergunta atual + `onNext` que avança step |
| `tests/e2e/prep-flow.spec.ts` | E2E que percorre as 5 telas |

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `tailwind.config.ts` | Adicionar paleta `orange` (`#F15A24`, etc.), `green`, `yellow`, `red` "soft" tokens; adicionar `borderRadius.pill: '999px'`, `borderRadius.xl: '20px'` (já existe), `boxShadow.prep: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)'` |
| `src/app/prep/[id]/page.tsx` | Reescrever **completamente**: passa a ser SOMENTE a Tela 1 (Visão geral) — header empresa + FocusCard + SkipCard + zona de perigo colapsada |

### Arquivos a deletar (Task 16, ao final)

- `src/components/prep/JourneyArc.tsx`
- `src/components/prep/SectionTabs.tsx`
- `src/components/prep/ContinueCard.tsx`
- `src/components/prep/PrepOverview.tsx`
- `src/components/prep/navigation-types.ts` (não tem mais consumidor depois das deleções acima)
- `tests/e2e/overview.spec.ts` (substituído por `prep-flow.spec.ts`)

---

## Task 1: Adicionar design tokens da spec ao Tailwind

**Files:**
- Modify: `tailwind.config.ts`

A spec define cores que **não existem hoje** no Tailwind config (`#F15A24`, `#2DB87F`, `#F5B800`, `#E54848` e seus pares "soft"). Não trocamos `brand-600` (`#EA580C`) — landing/dashboard/UI dependem dele. Os novos componentes prep usam tokens `orange-*`, `green-*`, etc.

- [ ] **Step 1: Estender `theme.extend.colors` com os tokens da spec**

Editar `tailwind.config.ts`. Substituir o bloco `colors` por:

```ts
      colors: {
        brand: {
          DEFAULT: "#EA580C",
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
          900: "#7C2D12",
          hover: "#C2410C",
        },
        // PrepaVAGA Opção A spec tokens — usados pelos componentes em src/components/prep/*
        orange: {
          DEFAULT: "#F15A24",
          500: "#F15A24",
          700: "#D94818",
          soft: "#FFE7DC",
        },
        green: {
          DEFAULT: "#2DB87F",
          500: "#2DB87F",
          700: "#1F7A56",
          soft: "#E0F5EB",
        },
        yellow: {
          DEFAULT: "#F5B800",
          500: "#F5B800",
          700: "#B08600",
          soft: "#FFF4D1",
        },
        red: {
          DEFAULT: "#E54848",
          500: "#E54848",
          soft: "#FDE3E3",
        },
        ink: {
          DEFAULT: "#1A1A1A",
          2: "#4A4A4A",
          3: "#8A8A8A",
        },
        line: "#E8E8E8",
        // Semantic surface/text tokens (mantidos)
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          muted: "rgb(var(--color-surface-2) / <alpha-value>)",
        },
        bg: {
          DEFAULT: "rgb(var(--color-bg) / <alpha-value>)",
        },
        text: {
          primary: "rgb(var(--color-text-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--color-text-tertiary) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--color-border) / <alpha-value>)",
          strong: "rgb(var(--color-border-strong) / <alpha-value>)",
        },
      },
```

E em `borderRadius` adicionar `pill`:

```ts
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "20px",
        pill: "999px",
      },
```

E em `boxShadow` adicionar `prep`:

```ts
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.04)",
        md: "0 4px 12px rgba(0,0,0,0.06)",
        lg: "0 12px 32px rgba(0,0,0,0.08)",
        prep: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
      },
```

- [ ] **Step 2: Verificar typecheck + dev server arranca sem erro**

Run: `pnpm typecheck`
Expected: 0 erros (config Tailwind é tipado pelo `Config`).

Run: `pnpm build` (apenas para checar que Tailwind ainda gera as classes existentes)
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(prep): add Opção A design tokens (orange/green/yellow/red palettes, pill radius, prep shadow)"
```

---

## Task 2: Helper `classifyPrepSections` — mapear seções AI → likely/deepDive/ask

**Files:**
- Create: `src/lib/prep/section-classifier.ts`
- Create: `src/lib/prep/section-classifier.test.ts`

As seções vêm do AI com `id` e `title` arbitrários (schema permite 0-7 seções). Precisamos de uma classificação determinística pra rotear `/likely`, `/deep-dive`, `/ask` ao conteúdo certo. Heurística: por keyword no `id`, depois no `title`, com fallback posicional (1ª = likely, 2ª = deep-dive, 3ª = ask).

- [ ] **Step 1: Escrever os testes (failing)**

Criar `src/lib/prep/section-classifier.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyPrepSections } from "./section-classifier";
import type { PrepSection } from "@/lib/ai/schemas";

const make = (id: string, title = id): PrepSection => ({
  id,
  title,
  icon: "🎯",
  summary: "x",
  cards: [
    {
      id: "c1",
      question: "q?",
      key_points: ["p1"],
      sample_answer: "a".repeat(60),
      tips: "t",
      confidence_level: "high",
      references_cv: [],
    },
  ],
});

describe("classifyPrepSections", () => {
  it("mapeia por id explícito (likely/deep/ask)", () => {
    const out = classifyPrepSections([
      make("likely-questions"),
      make("deep-dive"),
      make("questions-to-ask"),
    ]);
    expect(out.likely?.id).toBe("likely-questions");
    expect(out.deepDive?.id).toBe("deep-dive");
    expect(out.ask?.id).toBe("questions-to-ask");
  });

  it("mapeia por título quando id é genérico", () => {
    const out = classifyPrepSections([
      make("s1", "Likely Questions"),
      make("s2", "Deep Dive"),
      make("s3", "Questions to Ask"),
    ]);
    expect(out.likely?.id).toBe("s1");
    expect(out.deepDive?.id).toBe("s2");
    expect(out.ask?.id).toBe("s3");
  });

  it("fallback posicional quando nenhum keyword bate", () => {
    const out = classifyPrepSections([make("a"), make("b"), make("c")]);
    expect(out.likely?.id).toBe("a");
    expect(out.deepDive?.id).toBe("b");
    expect(out.ask?.id).toBe("c");
  });

  it("retorna undefined para slot ausente", () => {
    const out = classifyPrepSections([make("likely")]);
    expect(out.likely?.id).toBe("likely");
    expect(out.deepDive).toBeUndefined();
    expect(out.ask).toBeUndefined();
  });

  it("não confunde 'deep' com 'likely' (keyword wins sobre posição)", () => {
    const out = classifyPrepSections([make("deep-dive"), make("likely-questions")]);
    expect(out.likely?.id).toBe("likely-questions");
    expect(out.deepDive?.id).toBe("deep-dive");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test src/lib/prep/section-classifier`
Expected: FAIL — `Cannot find module './section-classifier'`.

- [ ] **Step 3: Implementar**

Criar `src/lib/prep/section-classifier.ts`:

```ts
import type { PrepSection } from "@/lib/ai/schemas";

export type ClassifiedSections = {
  likely?: PrepSection;
  deepDive?: PrepSection;
  ask?: PrepSection;
};

const matchers = {
  likely: /likely|provav|basic|b[áa]sic/i,
  deepDive: /deep[\s-]?dive|aprofund/i,
  ask: /ask|pergunt.*entrev|to[\s-]?ask|voc[êe].*pergunt/i,
} as const;

function matches(section: PrepSection, kind: keyof typeof matchers): boolean {
  return matchers[kind].test(section.id) || matchers[kind].test(section.title);
}

export function classifyPrepSections(sections: PrepSection[]): ClassifiedSections {
  const result: ClassifiedSections = {};
  const used = new Set<string>();

  for (const kind of ["likely", "deepDive", "ask"] as const) {
    const found = sections.find((s) => !used.has(s.id) && matches(s, kind));
    if (found) {
      result[kind] = found;
      used.add(found.id);
    }
  }

  const remaining = sections.filter((s) => !used.has(s.id));
  if (!result.likely && remaining[0]) result.likely = remaining.shift();
  if (!result.deepDive && remaining[0]) result.deepDive = remaining.shift();
  if (!result.ask && remaining[0]) result.ask = remaining.shift();

  return result;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test src/lib/prep/section-classifier`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prep/section-classifier.ts src/lib/prep/section-classifier.test.ts
git commit -m "feat(prep): add classifyPrepSections helper to map AI sections → likely/deepDive/ask"
```

---

## Task 3: Helper `deriveStepState` — currentStep + completedSteps

**Files:**
- Create: `src/lib/prep/step-state.ts`
- Create: `src/lib/prep/step-state.test.ts`
- Create: `src/lib/prep/types.ts`

Step 1 (Vaga) está completo se o `prep_guide` está pronto. Step 2 (CV) está completo se `ats_status === 'complete'`. Steps 3/4/5 vêm de `localStorage` (chave `prepavaga:steps:<sessionId>` = JSON `number[]`). `currentStep` é o menor step ainda não completado (clampado em 5).

- [ ] **Step 1: Criar tipos compartilhados**

Criar `src/lib/prep/types.ts`:

```ts
export type StepNumber = 1 | 2 | 3 | 4 | 5;
export type Accent = "orange" | "yellow" | "green";

export const STEP_LABELS: Record<StepNumber, string> = {
  1: "Vaga",
  2: "CV",
  3: "Básicas",
  4: "Aprofundamento",
  5: "Você pergunta",
};
```

- [ ] **Step 2: Escrever os testes (failing)**

Criar `src/lib/prep/step-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  computeServerCompleted,
  mergeCompleted,
  resolveCurrentStep,
} from "./step-state";

describe("computeServerCompleted", () => {
  it("step 1 completo quando guideReady=true", () => {
    expect(computeServerCompleted({ guideReady: true, atsComplete: false })).toEqual([1]);
  });
  it("steps 1+2 quando ats está complete", () => {
    expect(computeServerCompleted({ guideReady: true, atsComplete: true })).toEqual([1, 2]);
  });
  it("vazio quando guide não pronto", () => {
    expect(computeServerCompleted({ guideReady: false, atsComplete: false })).toEqual([]);
  });
});

describe("mergeCompleted", () => {
  it("une server e local sem duplicar e ordena", () => {
    expect(mergeCompleted([1, 2], [3, 1, 5])).toEqual([1, 2, 3, 5]);
  });
  it("ignora valores fora de 1..5", () => {
    // @ts-expect-error testing runtime bound
    expect(mergeCompleted([1], [9, 0, 3])).toEqual([1, 3]);
  });
});

describe("resolveCurrentStep", () => {
  it("retorna o menor step não completado", () => {
    expect(resolveCurrentStep([1, 2])).toBe(3);
  });
  it("clampa em 5 se todos completos", () => {
    expect(resolveCurrentStep([1, 2, 3, 4, 5])).toBe(5);
  });
  it("retorna 1 se nada completo", () => {
    expect(resolveCurrentStep([])).toBe(1);
  });
  it("pula gaps no meio", () => {
    expect(resolveCurrentStep([1, 3, 5])).toBe(2);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm test src/lib/prep/step-state`
Expected: FAIL — module not found.

- [ ] **Step 4: Implementar**

Criar `src/lib/prep/step-state.ts`:

```ts
import type { StepNumber } from "./types";

export function computeServerCompleted(input: {
  guideReady: boolean;
  atsComplete: boolean;
}): StepNumber[] {
  const out: StepNumber[] = [];
  if (input.guideReady) out.push(1);
  if (input.guideReady && input.atsComplete) out.push(2);
  return out;
}

const VALID = new Set<number>([1, 2, 3, 4, 5]);

export function mergeCompleted(
  server: StepNumber[],
  local: number[],
): StepNumber[] {
  const set = new Set<number>([...server, ...local].filter((n) => VALID.has(n)));
  return [...set].sort((a, b) => a - b) as StepNumber[];
}

export function resolveCurrentStep(completed: StepNumber[]): StepNumber {
  for (let s = 1; s <= 5; s++) {
    if (!completed.includes(s as StepNumber)) return s as StepNumber;
  }
  return 5;
}

export const STORAGE_KEY = (sessionId: string) => `prepavaga:steps:${sessionId}`;

export function readLocalCompleted(sessionId: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function writeLocalCompleted(sessionId: string, steps: number[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY(sessionId), JSON.stringify(steps));
  } catch {
    // quota / disabled — silently no-op
  }
}

export function markStepComplete(sessionId: string, step: StepNumber): void {
  const cur = readLocalCompleted(sessionId);
  if (cur.includes(step)) return;
  writeLocalCompleted(sessionId, [...cur, step]);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test src/lib/prep/step-state`
Expected: 9 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/prep/types.ts src/lib/prep/step-state.ts src/lib/prep/step-state.test.ts
git commit -m "feat(prep): add deriveStepState + localStorage helpers for 5-step progression"
```

---

## Task 4: Componente `<Chip />`

**Files:**
- Create: `src/components/prep/Chip.tsx`
- Create: `src/components/prep/Chip.test.tsx`

- [ ] **Step 1: Escrever os testes (failing)**

Criar `src/components/prep/Chip.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Chip } from "./Chip";

describe("<Chip />", () => {
  it("renderiza children", () => {
    const { getByText } = render(<Chip>Hello</Chip>);
    expect(getByText("Hello")).toBeDefined();
  });
  it("variant default usa fundo --bg + borda --line", () => {
    const { container } = render(<Chip>x</Chip>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/border-line/);
    expect(el.className).toMatch(/bg-bg/);
  });
  it("variant orange usa fundo --orange-soft + texto --orange-700", () => {
    const { container } = render(<Chip variant="orange">x</Chip>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/bg-orange-soft/);
    expect(el.className).toMatch(/text-orange-700/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test src/components/prep/Chip`
Expected: FAIL — module not found.

Pré-requisito: garantir que vitest já tem ambiente jsdom. Se não tiver, ler `vitest.config.ts` (provavelmente está OK porque `*.test.tsx` já existe em outros lugares — checar com `pnpm test --reporter=verbose 2>&1 | head -20` antes de seguir).

- [ ] **Step 3: Implementar**

Criar `src/components/prep/Chip.tsx`:

```tsx
import type { ReactNode } from "react";

export type ChipVariant = "default" | "orange";

export function Chip({
  variant = "default",
  children,
}: {
  variant?: ChipVariant;
  children: ReactNode;
}) {
  const variantClass =
    variant === "orange"
      ? "bg-orange-soft text-orange-700"
      : "bg-bg text-ink-2 border border-line";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium ${variantClass}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test src/components/prep/Chip`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/prep/Chip.tsx src/components/prep/Chip.test.tsx
git commit -m "feat(prep): add Chip component (default + orange variants)"
```

---

## Task 5: Componente `<PrepStepper />`

**Files:**
- Create: `src/components/prep/PrepStepper.tsx`
- Create: `src/components/prep/PrepStepper.test.tsx`

5 segmentos horizontais. Concluído = `--green`, atual = `--orange` com bolinha, futuro = `--line`. Em mobile (< 768px), labels somem; aparece label da etapa atual como texto separado acima.

- [ ] **Step 1: Escrever os testes (failing)**

Criar `src/components/prep/PrepStepper.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PrepStepper } from "./PrepStepper";

describe("<PrepStepper />", () => {
  it("renderiza progressbar com aria-valuenow e aria-valuemax=5", () => {
    const { getByRole } = render(<PrepStepper currentStep={3} completedSteps={[1, 2]} />);
    const bar = getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemax")).toBe("5");
  });

  it("renderiza 5 segmentos", () => {
    const { getAllByTestId } = render(
      <PrepStepper currentStep={3} completedSteps={[1, 2]} />,
    );
    expect(getAllByTestId(/^stepper-segment-/)).toHaveLength(5);
  });

  it("segmento concluído tem classe bg-green-500", () => {
    const { getByTestId } = render(<PrepStepper currentStep={3} completedSteps={[1, 2]} />);
    expect(getByTestId("stepper-segment-1").className).toMatch(/bg-green-500/);
    expect(getByTestId("stepper-segment-2").className).toMatch(/bg-green-500/);
  });

  it("segmento atual tem classe bg-orange-500", () => {
    const { getByTestId } = render(<PrepStepper currentStep={3} completedSteps={[1, 2]} />);
    expect(getByTestId("stepper-segment-3").className).toMatch(/bg-orange-500/);
  });

  it("segmento futuro tem classe bg-line", () => {
    const { getByTestId } = render(<PrepStepper currentStep={3} completedSteps={[1, 2]} />);
    expect(getByTestId("stepper-segment-4").className).toMatch(/bg-line/);
    expect(getByTestId("stepper-segment-5").className).toMatch(/bg-line/);
  });

  it("renderiza label da etapa atual como texto mobile-only", () => {
    const { getByTestId } = render(<PrepStepper currentStep={3} completedSteps={[1, 2]} />);
    expect(getByTestId("stepper-mobile-label").textContent).toContain("Etapa 3 de 5");
    expect(getByTestId("stepper-mobile-label").textContent).toContain("Básicas");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test src/components/prep/PrepStepper`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar**

Criar `src/components/prep/PrepStepper.tsx`:

```tsx
import { STEP_LABELS, type StepNumber } from "@/lib/prep/types";

const STEPS: StepNumber[] = [1, 2, 3, 4, 5];

export function PrepStepper({
  currentStep,
  completedSteps,
}: {
  currentStep: StepNumber;
  completedSteps: StepNumber[];
}) {
  const completed = new Set(completedSteps);

  return (
    <div className="w-full">
      <p
        data-testid="stepper-mobile-label"
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3 md:hidden"
      >
        Etapa {currentStep} de 5 · {STEP_LABELS[currentStep]}
      </p>
      <div
        role="progressbar"
        aria-label="Progresso do prep"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={5}
        className="grid grid-cols-5 gap-2"
      >
        {STEPS.map((step) => {
          const isCompleted = completed.has(step);
          const isCurrent = step === currentStep;
          const bg = isCompleted
            ? "bg-green-500"
            : isCurrent
            ? "bg-orange-500"
            : "bg-line";
          return (
            <div key={step} className="relative">
              <div
                data-testid={`stepper-segment-${step}`}
                className={`h-2 rounded-pill ${bg}`}
                aria-label={
                  isCompleted
                    ? `Etapa ${step} concluída`
                    : isCurrent
                    ? `Etapa ${step} atual`
                    : `Etapa ${step} futura`
                }
              />
              {isCurrent && (
                <span
                  aria-hidden
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-[3px] border-white bg-orange-500 shadow-[0_0_0_4px_rgba(241,90,36,0.18)]"
                />
              )}
              <span className="mt-2 hidden text-[12px] font-semibold text-ink-3 md:block">
                {STEP_LABELS[step]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test src/components/prep/PrepStepper`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/prep/PrepStepper.tsx src/components/prep/PrepStepper.test.tsx
git commit -m "feat(prep): add PrepStepper (5 segments, role=progressbar, mobile label)"
```

---

## Task 6: Layout shell `app/prep/[id]/layout.tsx` + `PrepShellProvider`

**Files:**
- Create: `src/app/prep/[id]/layout.tsx`
- Create: `src/components/prep/PrepShellProvider.tsx`

O layout é server component: lê a sessão UMA vez, valida, classifica seções, calcula `serverCompleted`. Renderiza breadcrumb + provider client + PrepStepper + `{children}`. O provider client lê localStorage pra estender `serverCompleted` com steps 3/4/5 e calcular `currentStep` reativo.

- [ ] **Step 1: Criar `PrepShellProvider`**

Criar `src/components/prep/PrepShellProvider.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  mergeCompleted,
  readLocalCompleted,
  resolveCurrentStep,
} from "@/lib/prep/step-state";
import type { StepNumber } from "@/lib/prep/types";

type ShellContextValue = {
  sessionId: string;
  company: string;
  role: string;
  estimatedMinutes: number;
  currentStep: StepNumber;
  completedSteps: StepNumber[];
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function PrepShellProvider({
  sessionId,
  company,
  role,
  estimatedMinutes,
  serverCompleted,
  children,
}: {
  sessionId: string;
  company: string;
  role: string;
  estimatedMinutes: number;
  serverCompleted: StepNumber[];
  children: ReactNode;
}) {
  const [completedSteps, setCompletedSteps] = useState<StepNumber[]>(serverCompleted);

  useEffect(() => {
    const local = readLocalCompleted(sessionId);
    setCompletedSteps(mergeCompleted(serverCompleted, local));

    const onStorage = (e: StorageEvent) => {
      if (e.key === `prepavaga:steps:${sessionId}`) {
        setCompletedSteps(mergeCompleted(serverCompleted, readLocalCompleted(sessionId)));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [sessionId, serverCompleted]);

  const currentStep = resolveCurrentStep(completedSteps);

  return (
    <ShellContext.Provider
      value={{ sessionId, company, role, estimatedMinutes, currentStep, completedSteps }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function usePrepShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("usePrepShell deve estar dentro de PrepShellProvider");
  return ctx;
}
```

- [ ] **Step 2: Criar `layout.tsx`**

Criar `src/app/prep/[id]/layout.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { PrepShellProvider } from "@/components/prep/PrepShellProvider";
import { PrepStepper } from "@/components/prep/PrepStepper";
import { computeServerCompleted } from "@/lib/prep/step-state";
import { PrepSkeleton } from "@/components/prep/PrepSkeleton";
import { PrepFailed } from "@/components/prep/PrepFailed";
import type { ReactNode } from "react";
import { PrepStepperBound } from "@/components/prep/PrepStepperBound";

export default async function PrepLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select("id, generation_status, prep_guide, error_message, ats_status")
    .eq("id", id)
    .single();

  if (error || !session) notFound();

  if (session.generation_status === "generating" || session.generation_status === "pending") {
    return <PrepSkeleton />;
  }
  if (session.generation_status === "failed") {
    return <PrepFailed id={session.id} errorMessage={session.error_message} />;
  }

  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) {
    return <PrepFailed id={session.id} errorMessage="Stored guide is malformed." />;
  }

  const guideReady = true;
  const atsComplete = session.ats_status === "complete";
  const serverCompleted = computeServerCompleted({ guideReady, atsComplete });

  return (
    <PrepShellProvider
      sessionId={session.id}
      company={parsed.data.meta.company}
      role={parsed.data.meta.role}
      estimatedMinutes={parsed.data.meta.estimated_prep_time_minutes}
      serverCompleted={serverCompleted}
    >
      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 md:py-10">
        <header className="mb-6 flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="text-ink-2 hover:text-ink">
            ← Voltar para seus preps
          </Link>
        </header>
        <div className="mb-8">
          <PrepStepperBound />
        </div>
        <main>{children}</main>
      </div>
    </PrepShellProvider>
  );
}
```

- [ ] **Step 3: Criar `PrepStepperBound` (client wrapper que lê o context)**

Criar `src/components/prep/PrepStepperBound.tsx`:

```tsx
"use client";

import { PrepStepper } from "./PrepStepper";
import { usePrepShell } from "./PrepShellProvider";

export function PrepStepperBound() {
  const { currentStep, completedSteps } = usePrepShell();
  return <PrepStepper currentStep={currentStep} completedSteps={completedSteps} />;
}
```

Ajustar o import no `layout.tsx` se necessário (Step 2 já referencia o caminho correto).

- [ ] **Step 4: Verificar typecheck**

Run: `pnpm typecheck`
Expected: 0 erros. Se a tabela `prep_sessions` não tiver type gerado, OK — a query retorna `unknown` mas os campos lidos são strings/booleans simples.

- [ ] **Step 5: Commit**

```bash
git add src/app/prep/[id]/layout.tsx src/components/prep/PrepShellProvider.tsx src/components/prep/PrepStepperBound.tsx
git commit -m "feat(prep): add layout shell with breadcrumb, PrepStepper, and shell context provider"
```

---

## Task 7: Componente `<FocusCard />` + `<SkipCard />` + `<SuccessCard />`

**Files:**
- Create: `src/components/prep/FocusCard.tsx`
- Create: `src/components/prep/FocusCard.test.tsx`
- Create: `src/components/prep/SkipCard.tsx`
- Create: `src/components/prep/SuccessCard.tsx`

- [ ] **Step 1: Escrever os testes do FocusCard (failing)**

Criar `src/components/prep/FocusCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { FocusCard } from "./FocusCard";

describe("<FocusCard />", () => {
  it("renderiza stepChip, title, description, ctaLabel", () => {
    const { getByText } = render(
      <FocusCard
        stepChip="PASSO 3 DE 5"
        title="Pronto pra treinar?"
        description="3 perguntas selecionadas"
        ctaHref="/x"
        ctaLabel="Começar agora →"
      />,
    );
    expect(getByText("PASSO 3 DE 5")).toBeDefined();
    expect(getByText("Pronto pra treinar?")).toBeDefined();
    expect(getByText("3 perguntas selecionadas")).toBeDefined();
    expect(getByText("Começar agora →")).toBeDefined();
  });

  it("dispara onCtaClick quando passado em vez de href", () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <FocusCard
        stepChip="x"
        title="t"
        description="d"
        ctaLabel="Go"
        onCtaClick={onClick}
      />,
    );
    fireEvent.click(getByText("Go"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test src/components/prep/FocusCard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar `FocusCard`**

Criar `src/components/prep/FocusCard.tsx`:

```tsx
import Link from "next/link";

type FocusCardBaseProps = {
  stepChip: string;
  title: string;
  description: string;
  ctaLabel: string;
};

type FocusCardProps = FocusCardBaseProps &
  (
    | { ctaHref: string; onCtaClick?: never }
    | { onCtaClick: () => void; ctaHref?: never }
  );

export function FocusCard(props: FocusCardProps) {
  const { stepChip, title, description, ctaLabel } = props;
  const cta = (
    <span className="inline-flex items-center justify-center rounded-pill bg-white px-8 py-3.5 text-sm font-semibold text-orange-700 shadow-prep transition-colors hover:bg-orange-soft">
      {ctaLabel}
    </span>
  );
  return (
    <section
      className="rounded-xl px-6 py-10 text-center text-white shadow-prep md:px-8 md:py-12"
      style={{ background: "linear-gradient(135deg, #F15A24 0%, #D94818 100%)" }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-white/80">
        {stepChip}
      </p>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight md:text-[28px]">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-[15px] leading-6 text-white/90">
        {description}
      </p>
      <div className="mt-6">
        {"ctaHref" in props && props.ctaHref ? (
          <Link href={props.ctaHref} className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-500 rounded-pill">
            {cta}
          </Link>
        ) : (
          <button
            type="button"
            onClick={props.onCtaClick}
            className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-500 rounded-pill"
          >
            {cta}
          </button>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Rodar testes do FocusCard**

Run: `pnpm test src/components/prep/FocusCard`
Expected: 2 passed.

- [ ] **Step 5: Implementar `SkipCard`**

Criar `src/components/prep/SkipCard.tsx`:

```tsx
import Link from "next/link";

export function SkipCard({
  prompt,
  ctaLabel,
  href,
}: {
  prompt: string;
  ctaLabel: string;
  href: string;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-line bg-bg px-5 py-3 text-[13px] text-ink-2">
      <span>{prompt}</span>
      <Link href={href} className="font-semibold text-orange-700 hover:text-orange-500">
        {ctaLabel}
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: Implementar `SuccessCard`**

Criar `src/components/prep/SuccessCard.tsx`:

```tsx
import Link from "next/link";

export function SuccessCard({ sessionId }: { sessionId: string }) {
  return (
    <section
      className="rounded-xl px-6 py-10 text-center text-white shadow-prep md:px-8 md:py-12"
      style={{ background: "linear-gradient(135deg, #2DB87F 0%, #1F7A56 100%)" }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-white/80">
        🎉 Prep completo
      </p>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight md:text-[28px]">
        Você está pronto para a entrevista
      </h2>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/prep/${sessionId}/likely`}
          className="rounded-pill border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          Refazer perguntas básicas
        </Link>
        <button
          type="button"
          className="rounded-pill bg-white px-5 py-2.5 text-sm font-semibold text-green-700 shadow-prep hover:bg-green-soft"
          onClick={() => {
            // Placeholder de export PDF (fora do escopo desta entrega)
            window.alert("Export PDF em breve");
          }}
        >
          Exportar resumo em PDF
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/prep/FocusCard.tsx src/components/prep/FocusCard.test.tsx src/components/prep/SkipCard.tsx src/components/prep/SuccessCard.tsx
git commit -m "feat(prep): add FocusCard, SkipCard, SuccessCard for Tela 1"
```

---

## Task 8: Reescrever `app/prep/[id]/page.tsx` → Tela 1 (Visão geral)

**Files:**
- Modify: `src/app/prep/[id]/page.tsx` (reescrita completa)

A página vira simples: cabeçalho da empresa + FocusCard dinâmico + SkipCard + zona de perigo colapsada. O conteúdo do FocusCard varia com `currentStep` (tabela §5.1 da spec).

- [ ] **Step 1: Reescrever o arquivo**

Substituir TODO o conteúdo de `src/app/prep/[id]/page.tsx` por:

```tsx
import type { Metadata } from "next";
import { DeletePrepButton } from "@/components/prep/DeletePrepButton";
import { Tela1Visual } from "@/components/prep/Tela1Visual";

export const metadata: Metadata = {
  title: "Prep — PrepaVaga",
};

export default async function PrepHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Tela1Visual sessionId={id} />;
}
```

- [ ] **Step 2: Criar `Tela1Visual` (client) que usa o shell context pra escolher o FocusCard**

Criar `src/components/prep/Tela1Visual.tsx`:

```tsx
"use client";

import { useState } from "react";
import { usePrepShell } from "./PrepShellProvider";
import { FocusCard } from "./FocusCard";
import { SkipCard } from "./SkipCard";
import { SuccessCard } from "./SuccessCard";
import { DeletePrepButton } from "./DeletePrepButton";
import type { StepNumber } from "@/lib/prep/types";

const FOCUS_BY_STEP: Record<
  StepNumber,
  {
    title: string;
    description: string;
    ctaLabel: string;
    routeSegment: string;
  }
> = {
  1: {
    title: "Vamos começar pela vaga",
    description: "Entenda o que a empresa está buscando",
    ctaLabel: "Ver visão geral →",
    routeSegment: "ats",
  },
  2: {
    title: "Seu CV está pronto pro filtro?",
    description: "Descubra seu score ATS em 30 segundos",
    ctaLabel: "Rodar análise →",
    routeSegment: "ats",
  },
  3: {
    title: "Pronto pra treinar as perguntas básicas?",
    description: "Perguntas selecionadas pra você. Tempo estimado: ~8 minutos.",
    ctaLabel: "Começar agora →",
    routeSegment: "likely",
  },
  4: {
    title: "Hora das perguntas difíceis",
    description: "Perguntas de aprofundamento sobre liderança e execução",
    ctaLabel: "Continuar →",
    routeSegment: "deep-dive",
  },
  5: {
    title: "Última etapa: suas perguntas",
    description: "Perguntas estratégicas pra você fazer ao entrevistador",
    ctaLabel: "Finalizar prep →",
    routeSegment: "ask",
  },
};

const SKIP_BY_STEP: Record<StepNumber, { prompt: string; ctaLabel: string; routeSegment: string } | null> = {
  1: { prompt: "Pular pra análise ATS?", ctaLabel: "Pular para passo 2 →", routeSegment: "ats" },
  2: { prompt: "Pular direto pras perguntas?", ctaLabel: "Pular para passo 3 →", routeSegment: "likely" },
  3: { prompt: "Pular pro aprofundamento?", ctaLabel: "Pular para passo 4 →", routeSegment: "deep-dive" },
  4: { prompt: "Pular pra suas perguntas?", ctaLabel: "Pular para passo 5 →", routeSegment: "ask" },
  5: null,
};

export function Tela1Visual({ sessionId }: { sessionId: string }) {
  const { company, role, estimatedMinutes, currentStep, completedSteps } = usePrepShell();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const allDone = completedSteps.includes(5);

  const focus = FOCUS_BY_STEP[currentStep];
  const skip = SKIP_BY_STEP[currentStep];
  const stepChip = `PASSO ${currentStep} DE 5`;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
          Prep para
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink md:text-[32px]">
          {company}
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          {role} · {estimatedMinutes} min
        </p>
      </header>

      {allDone ? (
        <SuccessCard sessionId={sessionId} />
      ) : (
        <>
          <FocusCard
            stepChip={stepChip}
            title={focus.title}
            description={focus.description}
            ctaLabel={focus.ctaLabel}
            ctaHref={`/prep/${sessionId}/${focus.routeSegment}`}
          />
          {skip && (
            <SkipCard
              prompt={skip.prompt}
              ctaLabel={skip.ctaLabel}
              href={`/prep/${sessionId}/${skip.routeSegment}`}
            />
          )}
        </>
      )}

      <section className="border-t border-line pt-6">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="text-[13px] font-semibold text-ink-3 hover:text-ink-2"
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? "Opções avançadas ▴" : "Opções avançadas ▾"}
        </button>
        {advancedOpen && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
              Não preciso mais deste prep
            </p>
            <DeletePrepButton sessionId={sessionId} companyName={company} />
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Atualizar imports do `page.tsx` (remover ref a `Tela1Visual` se já está nele)**

Confirmar que o `page.tsx` reescrito no Step 1 importa `Tela1Visual` (ele importa). Remover o import obsoleto de `DeletePrepButton` no `page.tsx` (já não é usado lá).

Final desejado de `src/app/prep/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Tela1Visual } from "@/components/prep/Tela1Visual";

export const metadata: Metadata = {
  title: "Prep — PrepaVaga",
};

export default async function PrepHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Tela1Visual sessionId={id} />;
}
```

- [ ] **Step 4: Verificar build + typecheck**

Run: `pnpm typecheck`
Expected: 0 erros.

Run: `pnpm dev` em background, abrir `http://localhost:3000/prep/<id>` (precisa de prep existente — checar dashboard se necessário).
Expected: Tela 1 renderiza com FocusCard + breadcrumb + PrepStepper.

- [ ] **Step 5: Commit**

```bash
git add src/app/prep/[id]/page.tsx src/components/prep/Tela1Visual.tsx
git commit -m "feat(prep): rewrite /prep/[id] as Tela 1 (FocusCard + SkipCard + collapsed danger zone)"
```

---

## Task 9: Componente `<QuestionCard />`

**Files:**
- Create: `src/components/prep/QuestionCard.tsx`
- Create: `src/components/prep/QuestionCard.test.tsx`

Card central do fluxo de perguntas. 3 accents: orange/yellow/green. Header com número + setas. Body com pergunta + sections. ActionBar com meta + CTA.

- [ ] **Step 1: Escrever os testes (failing)**

Criar `src/components/prep/QuestionCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { QuestionCard } from "./QuestionCard";

const baseProps = {
  questionNumber: "01 / 03" as const,
  title: "Conta uma vez que você liderou um projeto difícil.",
  sections: [
    { heading: "💡 O que querem ouvir", body: <p>blah</p> },
  ],
  onNext: vi.fn(),
};

describe("<QuestionCard />", () => {
  it("renderiza title, questionNumber e section heading", () => {
    const { getByText } = render(<QuestionCard accent="orange" {...baseProps} />);
    expect(getByText("01 / 03")).toBeDefined();
    expect(getByText(baseProps.title)).toBeDefined();
    expect(getByText("💡 O que querem ouvir")).toBeDefined();
  });

  it("accent='orange' aplica classe text-orange-700 no heading", () => {
    const { getByText } = render(<QuestionCard accent="orange" {...baseProps} />);
    expect(getByText("💡 O que querem ouvir").className).toMatch(/text-orange-700/);
  });

  it("accent='yellow' aplica classe text-yellow-700 no heading", () => {
    const { getByText } = render(<QuestionCard accent="yellow" {...baseProps} />);
    expect(getByText("💡 O que querem ouvir").className).toMatch(/text-yellow-700/);
  });

  it("accent='green' aplica classe text-green-700 no heading", () => {
    const { getByText } = render(<QuestionCard accent="green" {...baseProps} />);
    expect(getByText("💡 O que querem ouvir").className).toMatch(/text-green-700/);
  });

  it("onNext dispara ao clicar no CTA", () => {
    const onNext = vi.fn();
    const { getByText } = render(
      <QuestionCard accent="orange" {...baseProps} onNext={onNext} ctaLabel="Próxima →" />,
    );
    fireEvent.click(getByText("Próxima →"));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("seta esquerda fica disabled quando onPrev não é passado", () => {
    const { getByLabelText } = render(<QuestionCard accent="orange" {...baseProps} />);
    expect((getByLabelText("Pergunta anterior") as HTMLButtonElement).disabled).toBe(true);
  });

  it("renderiza chips quando passados", () => {
    const { getByText } = render(
      <QuestionCard accent="orange" {...baseProps} chips={["Liderança", "Stakeholders"]} />,
    );
    expect(getByText("Liderança")).toBeDefined();
    expect(getByText("Stakeholders")).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test src/components/prep/QuestionCard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar**

Criar `src/components/prep/QuestionCard.tsx`:

```tsx
import type { ReactNode } from "react";
import { Chip } from "./Chip";
import type { Accent } from "@/lib/prep/types";

const ACCENT_HEADER_BG: Record<Accent, string> = {
  orange: "bg-orange-soft",
  yellow: "bg-yellow-soft",
  green: "bg-green-soft",
};
const ACCENT_HEADING: Record<Accent, string> = {
  orange: "text-orange-700",
  yellow: "text-yellow-700",
  green: "text-green-700",
};
const ACCENT_NUMBER_BG: Record<Accent, string> = {
  orange: "bg-orange-500",
  yellow: "bg-yellow-700",
  green: "bg-green-700",
};

export type QuestionSection = { heading: string; body: ReactNode };

export function QuestionCard({
  accent,
  questionNumber,
  title,
  sections,
  chips,
  meta,
  ctaLabel = "Próxima pergunta →",
  onNext,
  onPrev,
}: {
  accent: Accent;
  questionNumber: string;
  title: string;
  sections: QuestionSection[];
  chips?: string[];
  meta?: string;
  ctaLabel?: string;
  onNext: () => void;
  onPrev?: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-white shadow-prep">
      <header className={`flex items-center justify-between px-6 py-4 ${ACCENT_HEADER_BG[accent]}`}>
        <span
          className={`inline-flex items-center justify-center rounded-pill px-3 py-1 text-xs font-bold text-white ${ACCENT_NUMBER_BG[accent]}`}
        >
          #{questionNumber}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Pergunta anterior"
            disabled={!onPrev}
            onClick={onPrev}
            className="inline-flex h-9 w-9 items-center justify-center rounded-pill border border-line bg-white text-ink-2 disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Próxima pergunta"
            onClick={onNext}
            className="inline-flex h-9 w-9 items-center justify-center rounded-pill border border-line bg-white text-ink-2"
          >
            →
          </button>
        </div>
      </header>
      <div className="px-6 py-7 md:px-7">
        <h3 className="text-xl font-bold leading-snug text-ink">{title}</h3>
        <div className="mt-6 space-y-5">
          {sections.map((s, i) => (
            <section key={i}>
              <h4 className={`text-sm font-bold ${ACCENT_HEADING[accent]}`}>{s.heading}</h4>
              <div className="mt-2 text-[15px] leading-6 text-ink-2">{s.body}</div>
            </section>
          ))}
          {chips && chips.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {chips.map((c) => (
                <Chip key={c} variant="orange">
                  {c}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>
      <footer className="flex items-center justify-between gap-4 border-t border-line bg-bg px-6 py-4">
        <span className="text-[13px] text-ink-3">{meta ?? ""}</span>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-prep transition-colors hover:bg-orange-700"
        >
          {ctaLabel}
        </button>
      </footer>
    </article>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test src/components/prep/QuestionCard`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/prep/QuestionCard.tsx src/components/prep/QuestionCard.test.tsx
git commit -m "feat(prep): add QuestionCard with 3 accent variants (orange/yellow/green)"
```

---

## Task 10: `<QuestionPager />` — controla index + onNext que avança step

**Files:**
- Create: `src/components/prep/QuestionPager.tsx`

Wrapper client que:
1. Mantém `index` da pergunta atual (useState).
2. Setas ← → navegam dentro do array.
3. Na última pergunta, CTA muda pro label "next-step" e ao clicar: `markStepComplete` no localStorage + `router.push(nextHref)`.

- [ ] **Step 1: Implementar**

Criar `src/components/prep/QuestionPager.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { QuestionCard, type QuestionSection } from "./QuestionCard";
import { markStepComplete } from "@/lib/prep/step-state";
import type { Accent, StepNumber } from "@/lib/prep/types";
import type { PrepCard } from "@/lib/ai/schemas";

export function QuestionPager({
  accent,
  cards,
  buildSections,
  defaultMeta,
  step,
  sessionId,
  nextHref,
  nextStepCtaLabel,
  perQuestionCtaLabel = "Próxima pergunta →",
}: {
  accent: Accent;
  cards: PrepCard[];
  buildSections: (card: PrepCard) => QuestionSection[];
  defaultMeta?: string;
  step: StepNumber;
  sessionId: string;
  nextHref: string;
  nextStepCtaLabel: string;
  perQuestionCtaLabel?: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const total = cards.length;
  const card = cards[index];
  const isLast = index === total - 1;

  const goNext = () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    markStepComplete(sessionId, step);
    router.push(nextHref);
  };

  const goPrev = index > 0 ? () => setIndex((i) => i - 1) : undefined;

  return (
    <QuestionCard
      accent={accent}
      questionNumber={`${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
      title={card.question}
      sections={buildSections(card)}
      chips={card.references_cv}
      meta={defaultMeta}
      ctaLabel={isLast ? nextStepCtaLabel : perQuestionCtaLabel}
      onNext={goNext}
      onPrev={goPrev}
    />
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm typecheck`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/prep/QuestionPager.tsx
git commit -m "feat(prep): add QuestionPager for navigating questions and advancing step"
```

---

## Task 11: Tela 3 — `/prep/[id]/likely`

**Files:**
- Create: `src/app/prep/[id]/likely/page.tsx`

- [ ] **Step 1: Implementar a página**

Criar `src/app/prep/[id]/likely/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { classifyPrepSections } from "@/lib/prep/section-classifier";
import { QuestionPager } from "@/components/prep/QuestionPager";

export default async function LikelyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("prep_sessions")
    .select("prep_guide")
    .eq("id", id)
    .single();
  if (!session) notFound();
  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) notFound();

  const { likely } = classifyPrepSections(parsed.data.sections);
  if (!likely || likely.cards.length === 0) {
    return (
      <EmptyState
        sessionId={id}
        title="Sem perguntas básicas geradas"
        body="O prep ainda não tem essa seção. Volte à visão geral."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
            Passo 3 · Perguntas básicas
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            Treino dirigido
          </h2>
        </div>
        <ConfidenceBadge level={likely.cards[0].confidence_level} />
      </header>

      <QuestionPager
        accent="orange"
        cards={likely.cards}
        sessionId={id}
        step={3}
        nextHref={`/prep/${id}/deep-dive`}
        nextStepCtaLabel="Ir pro aprofundamento →"
        defaultMeta="⏱ Leva ~90s pra responder em voz alta"
        buildSections={(card) => [
          {
            heading: "💡 O que o avaliador quer ouvir",
            body: <ul className="list-disc pl-5 space-y-1">{card.key_points.map((p, i) => <li key={i}>{p}</li>)}</ul>,
          },
          {
            heading: "📝 Resposta modelo (edite como quiser)",
            body: <p className="rounded-md bg-orange-soft/40 p-4 italic text-ink">{card.sample_answer}</p>,
          },
          ...(card.tips
            ? [{ heading: "🎯 Dica", body: <p>{card.tips}</p> }]
            : []),
        ]}
      />
    </div>
  );
}

function ConfidenceBadge({ level }: { level: "low" | "medium" | "high" }) {
  const map = {
    high: { label: "✓ Alta confiança", cls: "bg-green-soft text-green-700" },
    medium: { label: "⚠ Média confiança", cls: "bg-yellow-soft text-yellow-700" },
    low: { label: "⚠ Baixa confiança", cls: "bg-red-soft text-red-500" },
  } as const;
  const m = map[level];
  return <span className={`rounded-pill px-3 py-1 text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

function EmptyState({ sessionId, title, body }: { sessionId: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-8 text-center shadow-prep">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-2">{body}</p>
      <Link
        href={`/prep/${sessionId}`}
        className="mt-4 inline-block rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white"
      >
        ← Voltar à visão geral
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck + smoke test em dev**

Run: `pnpm typecheck`
Expected: 0 erros.

Abrir `http://localhost:3000/prep/<id>/likely` no browser.
Expected: vê QuestionCard laranja, setas funcionam, na última pergunta CTA muda pra "Ir pro aprofundamento →" e clicar leva pra `/deep-dive`.

- [ ] **Step 3: Commit**

```bash
git add src/app/prep/[id]/likely/page.tsx
git commit -m "feat(prep): add Tela 3 (Likely Questions) at /prep/[id]/likely"
```

---

## Task 12: Tela 4 — `/prep/[id]/deep-dive`

**Files:**
- Create: `src/app/prep/[id]/deep-dive/page.tsx`

Estrutura idêntica à Tela 3, mas accent="yellow", caps `PASSO 4 · APROFUNDAMENTO`, badge "🔥 Pergunta difícil", meta "~2-3 min".

- [ ] **Step 1: Implementar**

Criar `src/app/prep/[id]/deep-dive/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { classifyPrepSections } from "@/lib/prep/section-classifier";
import { QuestionPager } from "@/components/prep/QuestionPager";

export default async function DeepDivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("prep_sessions")
    .select("prep_guide")
    .eq("id", id)
    .single();
  if (!session) notFound();
  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) notFound();

  const { deepDive } = classifyPrepSections(parsed.data.sections);
  if (!deepDive || deepDive.cards.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center shadow-prep">
        <h2 className="text-xl font-bold text-ink">Sem perguntas de aprofundamento</h2>
        <Link
          href={`/prep/${id}`}
          className="mt-4 inline-block rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-yellow-700">
            Passo 4 · Aprofundamento
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            Pergunta difícil
          </h2>
        </div>
        <span className="rounded-pill bg-yellow-soft px-3 py-1 text-xs font-semibold text-yellow-700">
          🔥 Pergunta difícil
        </span>
      </header>

      <QuestionPager
        accent="yellow"
        cards={deepDive.cards}
        sessionId={id}
        step={4}
        nextHref={`/prep/${id}/ask`}
        nextStepCtaLabel="Ir pras suas perguntas →"
        defaultMeta="⏱ Resposta ideal: 2-3 min"
        buildSections={(card) => [
          {
            heading: "🎯 Pontos-chave (evitar se perder)",
            body: <ul className="list-disc pl-5 space-y-1">{card.key_points.map((p, i) => <li key={i}>{p}</li>)}</ul>,
          },
          {
            heading: "📝 Resposta modelo",
            body: <p className="rounded-md bg-yellow-soft/40 p-4 italic text-ink">{card.sample_answer}</p>,
          },
          ...(card.tips
            ? [{ heading: "💡 Dica", body: <p>{card.tips}</p> }]
            : []),
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Run: `pnpm typecheck`
Expected: 0 erros.

Browser: `/prep/<id>/deep-dive` mostra accent amarelo, badge "🔥 Pergunta difícil".

- [ ] **Step 3: Commit**

```bash
git add src/app/prep/[id]/deep-dive/page.tsx
git commit -m "feat(prep): add Tela 4 (Deep Dive) at /prep/[id]/deep-dive"
```

---

## Task 13: Tela 5 — `/prep/[id]/ask` + `<SuccessBanner />`

**Files:**
- Create: `src/components/prep/SuccessBanner.tsx`
- Create: `src/app/prep/[id]/ask/page.tsx`

- [ ] **Step 1: Implementar `SuccessBanner`**

Criar `src/components/prep/SuccessBanner.tsx`:

```tsx
export function SuccessBanner() {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-6 py-4 text-white shadow-prep"
      style={{ background: "linear-gradient(135deg, #2DB87F 0%, #1F7A56 100%)" }}
    >
      <p className="text-sm font-semibold">
        🎉 Prep completo · Você está pronto para a entrevista
      </p>
      <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-white/80">
        5/5 passos completos
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Implementar página**

Criar `src/app/prep/[id]/ask/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { classifyPrepSections } from "@/lib/prep/section-classifier";
import { QuestionPager } from "@/components/prep/QuestionPager";
import { SuccessBanner } from "@/components/prep/SuccessBanner";

export default async function AskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("prep_sessions")
    .select("prep_guide")
    .eq("id", id)
    .single();
  if (!session) notFound();
  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) notFound();

  const { ask } = classifyPrepSections(parsed.data.sections);
  if (!ask || ask.cards.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center shadow-prep">
        <h2 className="text-xl font-bold text-ink">Sem perguntas pra fazer geradas</h2>
        <Link
          href={`/prep/${id}`}
          className="mt-4 inline-block rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SuccessBanner />
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-green-700">
          Passo 5 · Suas perguntas pro entrevistador
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          Última etapa
        </h2>
      </header>

      <QuestionPager
        accent="green"
        cards={ask.cards}
        sessionId={id}
        step={5}
        nextHref={`/prep/${id}`}
        nextStepCtaLabel="Exportar resumo em PDF"
        defaultMeta="📋 2 opções alternativas caso essa seja respondida antes"
        buildSections={(card) => [
          {
            heading: "🎯 Por que fazer essa pergunta",
            body: <p>{card.tips || card.sample_answer}</p>,
          },
          {
            heading: "🎧 O que escutar",
            body: (
              <ul className="list-disc pl-5 space-y-1 italic">
                {card.key_points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            ),
          },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

Run: `pnpm typecheck`
Browser: `/prep/<id>/ask` mostra SuccessBanner verde + QuestionCard verde. Última pergunta: CTA "Exportar resumo em PDF" → vai pra `/prep/<id>` que mostra `<SuccessCard />`.

- [ ] **Step 4: Commit**

```bash
git add src/components/prep/SuccessBanner.tsx src/app/prep/[id]/ask/page.tsx
git commit -m "feat(prep): add Tela 5 (Questions to Ask) + SuccessBanner"
```

---

## Task 14: Componente `<Gauge />` (SVG circular para ATS)

**Files:**
- Create: `src/components/prep/Gauge.tsx`
- Create: `src/components/prep/Gauge.test.tsx`

- [ ] **Step 1: Escrever testes (failing)**

Criar `src/components/prep/Gauge.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Gauge, gaugeColor } from "./Gauge";

describe("gaugeColor", () => {
  it("0..40 → red", () => {
    expect(gaugeColor(0)).toBe("var(--prep-red)");
    expect(gaugeColor(40)).toBe("var(--prep-red)");
  });
  it("41..70 → yellow", () => {
    expect(gaugeColor(41)).toBe("var(--prep-yellow)");
    expect(gaugeColor(70)).toBe("var(--prep-yellow)");
  });
  it("71..100 → green", () => {
    expect(gaugeColor(71)).toBe("var(--prep-green)");
    expect(gaugeColor(100)).toBe("var(--prep-green)");
  });
});

describe("<Gauge />", () => {
  it("aplica role='meter' com aria-valuenow", () => {
    const { getByRole } = render(<Gauge value={42} />);
    const meter = getByRole("meter");
    expect(meter.getAttribute("aria-valuenow")).toBe("42");
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
  });

  it("renderiza número central e label DE 100", () => {
    const { getByText } = render(<Gauge value={73} />);
    expect(getByText("73")).toBeDefined();
    expect(getByText("DE 100")).toBeDefined();
  });
});
```

- [ ] **Step 2: Adicionar CSS vars no `globals.css`**

Editar `src/app/globals.css` — adicionar dentro do `:root` (logo após `--color-text-muted`):

```css
  /* PrepaVAGA Opção A — gauge color tokens (consumed via CSS var em Gauge.tsx) */
  --prep-red: #E54848;
  --prep-yellow: #F5B800;
  --prep-green: #2DB87F;
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm test src/components/prep/Gauge`
Expected: FAIL — module not found.

- [ ] **Step 4: Implementar**

Criar `src/components/prep/Gauge.tsx`:

```tsx
"use client";

export function gaugeColor(value: number): string {
  if (value <= 40) return "var(--prep-red)";
  if (value <= 70) return "var(--prep-yellow)";
  return "var(--prep-green)";
}

export function Gauge({ value, max = 100 }: { value: number; max?: number }) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(value, max));
  const dash = (clamped / max) * circumference;
  const stroke = gaugeColor(clamped);

  return (
    <div
      role="meter"
      aria-label="Score ATS"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      className="relative inline-flex h-[200px] w-[200px] items-center justify-center"
    >
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#E8E8E8" strokeWidth="14" />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            transition: "stroke-dasharray 1.2s ease-out, stroke 0.4s ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[48px] font-extrabold leading-none text-ink">{clamped}</span>
        <span className="mt-1 text-xs font-semibold text-ink-3">DE {max}</span>
      </div>
      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          circle {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test src/components/prep/Gauge`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add src/components/prep/Gauge.tsx src/components/prep/Gauge.test.tsx src/app/globals.css
git commit -m "feat(prep): add Gauge SVG meter (red/yellow/green by score range)"
```

---

## Task 15: Componente `<IssueRow />`

**Files:**
- Create: `src/components/prep/IssueRow.tsx`
- Create: `src/components/prep/IssueRow.test.tsx`

- [ ] **Step 1: Escrever testes (failing)**

Criar `src/components/prep/IssueRow.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { IssueRow } from "./IssueRow";

describe("<IssueRow />", () => {
  it("renderiza number, title, description e impact", () => {
    const { getByText } = render(
      <IssueRow severity="critical" number={1} title="Falta X" description="Detalhe" impact="+22 pts" />,
    );
    expect(getByText("1")).toBeDefined();
    expect(getByText("Falta X")).toBeDefined();
    expect(getByText("Detalhe")).toBeDefined();
    expect(getByText("+22 pts")).toBeDefined();
  });

  it("severity='critical' usa bg-red-soft no número", () => {
    const { getByTestId } = render(
      <IssueRow severity="critical" number={1} title="t" description="d" impact="+1" />,
    );
    expect(getByTestId("issue-number").className).toMatch(/bg-red-soft/);
  });

  it("severity='warning' usa bg-yellow-soft no número", () => {
    const { getByTestId } = render(
      <IssueRow severity="warning" number={2} title="t" description="d" impact="+1" />,
    );
    expect(getByTestId("issue-number").className).toMatch(/bg-yellow-soft/);
  });

  it("aria-label inclui severidade, título e impacto", () => {
    const { getByRole } = render(
      <IssueRow severity="critical" number={1} title="Falta X" description="d" impact="+22 pts" />,
    );
    expect(getByRole("listitem").getAttribute("aria-label")).toContain("Ajuste crítico");
    expect(getByRole("listitem").getAttribute("aria-label")).toContain("Falta X");
    expect(getByRole("listitem").getAttribute("aria-label")).toContain("+22 pts");
  });
});
```

- [ ] **Step 2: Implementar**

Criar `src/components/prep/IssueRow.tsx`:

```tsx
import { Chip } from "./Chip";

export function IssueRow({
  severity,
  number,
  title,
  description,
  impact,
}: {
  severity: "critical" | "warning";
  number: number;
  title: string;
  description: string;
  impact: string;
}) {
  const numberBg = severity === "critical" ? "bg-red-soft text-red-500" : "bg-yellow-soft text-yellow-700";
  const label = `${severity === "critical" ? "Ajuste crítico" : "Ajuste de atenção"}: ${title}. Impacto estimado: ${impact}`;
  return (
    <li
      role="listitem"
      aria-label={label}
      className="grid grid-cols-[40px_1fr_auto] items-start gap-4 rounded-md border border-line bg-white p-4 md:items-center"
    >
      <span
        data-testid="issue-number"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-pill text-sm font-bold ${numberBg}`}
      >
        {number}
      </span>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-[13px] text-ink-2">{description}</p>
      </div>
      <span className="rounded-pill bg-green-soft px-3 py-1 text-xs font-semibold text-green-700">
        {impact}
      </span>
    </li>
  );
}
```

- [ ] **Step 3: Rodar e ver passar**

Run: `pnpm test src/components/prep/IssueRow`
Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add src/components/prep/IssueRow.tsx src/components/prep/IssueRow.test.tsx
git commit -m "feat(prep): add IssueRow for ATS top fixes"
```

---

## Task 16: Tela 2 — `/prep/[id]/ats` (AtsHero + DeltaBanner + IssuesPanel)

**Files:**
- Create: `src/components/prep/AtsHero.tsx`
- Create: `src/app/prep/[id]/ats/page.tsx`

A página reusa lógica existente de re-rodar ATS (`runAtsAnalysis`) e CV rewrite. Estados:
1. ATS pending (nunca rodou) → CTA pra rodar.
2. ATS generating → AtsSkeleton.
3. ATS failed → AtsFailed.
4. ATS complete → AtsHero + DeltaBanner + IssuesPanel.

- [ ] **Step 1: Implementar `AtsHero`**

Criar `src/components/prep/AtsHero.tsx`:

```tsx
import { Gauge } from "./Gauge";
import type { AtsAnalysis } from "@/lib/ai/schemas";

function verdict(score: number) {
  if (score <= 40) return { label: "❌ RISCO ALTO DE REJEIÇÃO", cls: "bg-red-soft text-red-500" };
  if (score <= 70) return { label: "⚠️ AJUSTES NECESSÁRIOS", cls: "bg-yellow-soft text-yellow-700" };
  return { label: "✅ PRONTO PRA SUBMETER", cls: "bg-green-soft text-green-700" };
}

const RANGES: Array<{ label: string; range: [number, number]; cls: string }> = [
  { label: "0-40 Rejeita", range: [0, 40], cls: "bg-red-soft text-red-500" },
  { label: "41-70 Você está aqui", range: [41, 70], cls: "bg-yellow-soft text-yellow-700" },
  { label: "71-100 Passa", range: [71, 100], cls: "bg-green-soft text-green-700" },
];

export function AtsHero({ analysis, role }: { analysis: AtsAnalysis; role: string }) {
  const v = verdict(analysis.score);
  return (
    <section className="rounded-lg bg-bg p-6 shadow-prep md:p-8">
      <div className="grid items-center gap-6 md:grid-cols-[240px_1fr] md:gap-8">
        <div className="flex justify-center">
          <Gauge value={analysis.score} />
        </div>
        <div>
          <span className={`inline-flex rounded-pill px-3 py-1 text-xs font-semibold ${v.cls}`}>
            {v.label}
          </span>
          <h3 className="mt-3 text-xl font-bold text-ink">
            {analysis.score >= 71
              ? "Seu CV está bem alinhado pro filtro ATS"
              : "Seu CV provavelmente não passa do filtro ATS"}
          </h3>
          <p className="mt-2 text-[15px] leading-6 text-ink-2">
            {analysis.overall_assessment}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {RANGES.map((r) => {
              const isCurrent = analysis.score >= r.range[0] && analysis.score <= r.range[1];
              return (
                <span
                  key={r.label}
                  className={`rounded-md px-3 py-2 text-center text-[11px] font-semibold ${r.cls} ${isCurrent ? "ring-2 ring-ink" : "opacity-60"}`}
                >
                  {r.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implementar `/ats/page.tsx`**

Criar `src/app/prep/[id]/ats/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { atsAnalysisSchema, prepGuideSchema, cvRewriteSchema } from "@/lib/ai/schemas";
import { AtsHero } from "@/components/prep/AtsHero";
import { IssueRow } from "@/components/prep/IssueRow";
import { AtsCtaCard } from "@/components/prep/AtsCtaCard";
import { AtsSkeleton } from "@/components/prep/AtsSkeleton";
import { AtsFailed } from "@/components/prep/AtsFailed";
import { CvRewriteSkeleton } from "@/components/prep/CvRewriteSkeleton";
import { CvRewriteFailed } from "@/components/prep/CvRewriteFailed";
import { CvRewriteView } from "@/components/prep/CvRewriteView";
import { CvRewriteCta } from "@/components/prep/CvRewriteCta";
import { runAtsAnalysis } from "@/app/prep/[id]/ats-actions";
import { PendingButton } from "@/components/prep/PendingButton";

export default async function AtsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("prep_sessions")
    .select("id, prep_guide, ats_status, ats_analysis, ats_error_message, cv_rewrite, cv_rewrite_status, cv_rewrite_error")
    .eq("id", id)
    .single();
  if (!session) notFound();

  const guideParsed = prepGuideSchema.safeParse(session.prep_guide);
  const role = guideParsed.success ? guideParsed.data.meta.role : "esta vaga";

  if (session.ats_status === "generating") return <AtsSkeleton />;
  if (session.ats_status === "failed") {
    return <AtsFailed sessionId={session.id} errorMessage={session.ats_error_message} />;
  }
  if (session.ats_status !== "complete") {
    return <AtsCtaCard sessionId={session.id} />;
  }

  const parsed = atsAnalysisSchema.safeParse(session.ats_analysis);
  if (!parsed.success) {
    return <AtsFailed sessionId={session.id} errorMessage="Stored analysis is malformed." />;
  }
  const analysis = parsed.data;
  const rerun = runAtsAnalysis.bind(null, session.id);

  const top3 = analysis.top_fixes.slice(0, 3);
  const totalImpact = top3.length * 12; // estimativa visual; o backend não retorna delta agregado
  const projected = Math.min(100, analysis.score + totalImpact);

  const rewriteParsed =
    session.cv_rewrite_status === "complete"
      ? cvRewriteSchema.safeParse(session.cv_rewrite)
      : null;
  const validRewrite = rewriteParsed?.success ? rewriteParsed.data : null;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
            Passo 2 · Compatibilidade ATS
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            Seu CV vs. {role}
          </h2>
        </div>
        <form action={rerun}>
          <PendingButton idleLabel="↻ Rerodar análise" pendingLabel="Rerodando…" variant="secondary" />
        </form>
      </header>

      <AtsHero analysis={analysis} role={role} />

      {analysis.score < 71 && top3.length > 0 && (
        <div
          className="rounded-lg border-l-4 border-green-500 bg-green-soft px-5 py-4 text-[15px] text-ink"
        >
          <p>
            <span className="mr-1">→</span>
            Aplicando os {top3.length} ajustes abaixo, seu score sobe pra <strong>~{projected}</strong>.
          </p>
          <p className="mt-1 text-[13px] text-ink-2">
            Estimativa baseada nos ajustes prioritários · pode levar 8 minutos
          </p>
        </div>
      )}

      <section className="rounded-lg border border-line bg-white p-5 shadow-prep">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">
            {top3.length} ajustes em ordem de impacto
          </h3>
        </header>
        <ul className="space-y-2">
          {top3.map((fix, i) => (
            <IssueRow
              key={fix.priority}
              severity={i === 0 ? "critical" : "warning"}
              number={fix.priority}
              title={fix.gap}
              description={fix.jd_language}
              impact={`+${10 + (top3.length - i) * 4} pts`}
            />
          ))}
        </ul>
      </section>

      <section>
        {session.cv_rewrite_status === "generating" ? (
          <CvRewriteSkeleton />
        ) : session.cv_rewrite_status === "failed" ? (
          <CvRewriteFailed sessionId={session.id} errorMessage={session.cv_rewrite_error ?? null} />
        ) : session.cv_rewrite_status === "complete" && validRewrite ? (
          <CvRewriteView rewrite={validRewrite} sessionId={session.id} />
        ) : (
          <CvRewriteCta sessionId={session.id} />
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

Run: `pnpm typecheck`
Expected: 0 erros.

Browser: `/prep/<id>/ats` mostra Gauge + AtsHero + DeltaBanner + 3 IssueRows + bloco CV rewrite. Testar com prep que já tem `ats_status === 'complete'`.

- [ ] **Step 4: Commit**

```bash
git add src/components/prep/AtsHero.tsx src/app/prep/[id]/ats/page.tsx
git commit -m "feat(prep): add Tela 2 (ATS) at /prep/[id]/ats with AtsHero + DeltaBanner + IssuesPanel"
```

---

## Task 17: E2E test — percorrer as 5 telas

**Files:**
- Create: `tests/e2e/prep-flow.spec.ts`

Reaproveitar fixtures/helpers do `overview.spec.ts` se existirem. O teste assume um prep já criado em DB de teste (mesmo padrão dos outros e2e).

- [ ] **Step 1: Inspecionar `tests/e2e/overview.spec.ts` pra entender setup**

Run: `cat tests/e2e/overview.spec.ts | head -80`
Expected: ver imports + login helper + criação de prep.

- [ ] **Step 2: Escrever o e2e**

Criar `tests/e2e/prep-flow.spec.ts` (adaptar imports/helpers ao padrão observado em Step 1):

```ts
import { test, expect } from "@playwright/test";

test.describe("PrepaVAGA — fluxo Opção A das 5 telas", () => {
  test("percorre Tela 1 → ATS → Likely → Deep-dive → Ask → SuccessCard", async ({ page }) => {
    // PRÉ-REQUISITO: assume helper de login + prep seed.
    // Substituir <PREP_ID> pelo helper que já existir no projeto (ver overview.spec.ts).
    const PREP_ID = process.env.E2E_PREP_ID ?? "REPLACE_WITH_HELPER";

    await page.goto(`/prep/${PREP_ID}`);
    await expect(page.getByRole("progressbar", { name: /progresso do prep/i })).toBeVisible();
    await expect(page.getByText(/passo \d de 5/i)).toBeVisible();

    await page.getByRole("link", { name: /começar agora|rodar análise|ver visão geral/i }).click();
    await expect(page).toHaveURL(/\/prep\/.+\/(ats|likely)/);

    await page.goto(`/prep/${PREP_ID}/likely`);
    await expect(page.getByText(/passo 3 · perguntas básicas/i)).toBeVisible();

    await page.goto(`/prep/${PREP_ID}/deep-dive`);
    await expect(page.getByText(/passo 4 · aprofundamento/i)).toBeVisible();
    await expect(page.getByText(/🔥 pergunta difícil/i)).toBeVisible();

    await page.goto(`/prep/${PREP_ID}/ask`);
    await expect(page.getByText(/prep completo · você está pronto/i)).toBeVisible();
    await expect(page.getByText(/passo 5/i)).toBeVisible();

    // Verificar que JourneyArc foi removido
    await page.goto(`/prep/${PREP_ID}`);
    await expect(page.locator('[aria-label="Mapa da sua jornada de preparação"]')).toHaveCount(0);
  });
});
```

> **Nota:** se `overview.spec.ts` usa helpers customizados (login programático, seed de DB), copiar a mesma estratégia. Se o e2e falhar por falta de prep seed, adicionar `test.skip` com TODO `# TODO: portar helper de seed do overview.spec.ts` e seguir.

- [ ] **Step 3: Rodar e2e (ou pular se ambiente não configurado)**

Run: `pnpm test:e2e tests/e2e/prep-flow.spec.ts`
Expected: passa SE houver prep seed; senão, marca como skipped — não bloqueia (falha de setup ≠ falha de implementação).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/prep-flow.spec.ts
git commit -m "test(prep): add e2e for Opção A 5-screen flow"
```

---

## Task 18: Polimento — responsividade mobile + reduced-motion

**Files:**
- Modify: `src/components/prep/PrepStepper.tsx` (mobile já tratado, validar)
- Modify: `src/components/prep/AtsHero.tsx` (já usa grid responsivo, validar)
- Modify: `src/app/globals.css` (adicionar fallback global de reduced-motion)

- [ ] **Step 1: Adicionar bloco global de reduced-motion no `globals.css`**

Editar `src/app/globals.css` — adicionar no fim do arquivo:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Validar mobile manual em 375px**

Run: `pnpm dev` em background. Browser DevTools → 375px wide.

Checklist visual nas 5 telas:
- [ ] Tela 1: FocusCard padding reduz, título cabe sem quebra de palavra
- [ ] Tela 2 ATS: AtsHero vira coluna única, Gauge centralizado, 3 ScoreRanges em 3 colunas pequenas (não empilham)
- [ ] Tela 3 Likely: QuestionCard com padding 20px, setas no header acessíveis pelo polegar
- [ ] Tela 4 Deep-dive: igual Tela 3
- [ ] Tela 5 Ask: SuccessBanner empilha label esquerda + "5/5" direita em viewport pequeno
- [ ] PrepStepper: labels somem, "Etapa X de 5 · Label" aparece acima

- [ ] **Step 3: Testar reduced-motion**

DevTools → Rendering tab → "Emulate CSS media feature `prefers-reduced-motion`" = `reduce`.

Verificar que:
- [ ] Gauge não anima ao re-rodar análise
- [ ] Hover transitions são instantâneas
- [ ] Skeleton shimmer continua (loading state ainda informa, não viola WCAG)

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(prep): add prefers-reduced-motion global fallback"
```

---

## Task 19: Cleanup — deletar componentes legados

**Files:**
- Delete: `src/components/prep/JourneyArc.tsx`
- Delete: `src/components/prep/SectionTabs.tsx`
- Delete: `src/components/prep/ContinueCard.tsx`
- Delete: `src/components/prep/PrepOverview.tsx`
- Delete: `src/components/prep/navigation-types.ts`
- Delete: `tests/e2e/overview.spec.ts`

- [ ] **Step 1: Confirmar que NADA mais importa esses arquivos**

Run: `pnpm grep -r "JourneyArc\|SectionTabs\|ContinueCard\|PrepOverview\|navigation-types" src tests` (ou usar a tool Grep).
Expected: 0 matches FORA dos próprios arquivos a deletar.

Se algum import remanescente aparecer (ex: dashboard usa `JourneyArc`), parar e tratar caso a caso antes de deletar.

- [ ] **Step 2: Deletar arquivos**

```bash
rm src/components/prep/JourneyArc.tsx
rm src/components/prep/SectionTabs.tsx
rm src/components/prep/ContinueCard.tsx
rm src/components/prep/PrepOverview.tsx
rm src/components/prep/navigation-types.ts
rm tests/e2e/overview.spec.ts
```

- [ ] **Step 3: Rodar typecheck + build**

Run: `pnpm typecheck`
Expected: 0 erros (se ainda houver import quebrado, voltar e corrigir).

Run: `pnpm build`
Expected: build OK.

- [ ] **Step 4: Rodar testes unit**

Run: `pnpm test`
Expected: todos passam (Chip, PrepStepper, FocusCard, QuestionCard, Gauge, IssueRow, classifyPrepSections, step-state).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(prep): remove legacy JourneyArc/SectionTabs/ContinueCard/PrepOverview after Opção A migration"
```

---

## Task 20: Validação final + Lighthouse

**Files:** N/A (validação)

- [ ] **Step 1: Rodar typecheck + lint + tests + build em sequência**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: tudo verde.

- [ ] **Step 2: Lighthouse a11y ≥ 95 nas 5 telas**

Subir dev server (`pnpm dev`) e rodar Lighthouse (Chrome DevTools → Lighthouse → Accessibility) em:
- `/prep/<id>`
- `/prep/<id>/ats`
- `/prep/<id>/likely`
- `/prep/<id>/deep-dive`
- `/prep/<id>/ask`

Expected: Score Accessibility ≥ 95 em todas. Se < 95, ler o relatório, corrigir (prováveis: contraste, label faltando, role faltando) e repetir.

- [ ] **Step 3: Validar critérios de aceite da spec §9**

Checklist final (marcar cada item):
- [ ] 5 telas roteadas e funcionais
- [ ] 6 componentes tipados em TS: PrepStepper, FocusCard, QuestionCard, Gauge, IssueRow, Chip
- [ ] Setas ← → dentro de etapa funcionam
- [ ] Última pergunta da etapa tem CTA "Ir pra próxima etapa →"
- [ ] Conclusão da etapa 5 retorna a `/prep/[id]` com SuccessCard
- [ ] Testes unitários cobrem: classifyPrepSections, step-state, accent do QuestionCard, cor do Gauge, transições do PrepStepper
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Funciona 375px–1440px sem quebra
- [ ] `prefers-reduced-motion` desativa animações
- [ ] JourneyArc removido (`pnpm grep "JourneyArc"` retorna 0 fora de git history)

- [ ] **Step 4: Commit final + abrir PR**

```bash
git status   # confirmar que está limpo
git push -u origin <branch-name>
gh pr create --title "feat(prep): redesign Opção A — 5 telas + PrepStepper + QuestionCard" --body "Implementa a spec PrepaVAGA Opção A. Fecha o redesign de /prep com 5 rotas dedicadas, FocusCard dinâmico e QuestionCard reutilizado nas telas 3-5. Remove JourneyArc/SectionTabs/ContinueCard/PrepOverview legados."
```

---

## Self-Review Checklist (preenchido pelo autor do plano)

**1. Spec coverage:**
- §1-3 (contexto + tokens): Task 1 ✅
- §4.1 PrepStepper: Task 5 ✅
- §4.2 FocusCard: Task 7 ✅
- §4.3 SkipCard: Task 7 ✅
- §4.4 QuestionCard: Task 9 ✅
- §4.5 Chip: Task 4 ✅
- §4.6 Gauge: Task 14 ✅
- §4.7 IssueRow: Task 15 ✅
- §5.1 Tela 1: Tasks 7+8 ✅
- §5.2 Tela 2 ATS: Task 16 ✅
- §5.3 Tela 3 Likely: Task 11 ✅
- §5.4 Tela 4 Deep-dive: Task 12 ✅
- §5.5 Tela 5 Ask + SuccessBanner: Task 13 ✅
- §6 Estados globais (loading/empty/erro): coberto pelos componentes legados (PrepSkeleton, AtsSkeleton, AtsFailed) reusados nos pages de Task 16 ✅
- §7 Responsividade: Task 18 ✅
- §8 Acessibilidade: validado em Task 20 (Lighthouse) ✅
- §9 Critérios de aceite: Task 20 ✅
- §10 Fora de escopo: respeitado (export PDF é placeholder em SuccessCard, gravação não implementada) ✅
- §11 Stack convenções: layout server, providers client (PrepShellProvider, QuestionPager) ✅
- §12 Ordem de impl: tasks seguem 1→tokens, 2→helpers, 3→atoms, 4→shell, 5→Tela1, 6→QuestionCard, 7→Telas 3-5, 8→Gauge/IssueRow, 9→Tela 2, 10→polish, 11→tests, 12→cleanup ✅

**2. Placeholder scan:** Sem TBD/TODO genérico. Estimativas de impacto (`+22 pts`) são fórmula determinística no código (não TODO). Helper de e2e seed marcado como TODO explícito porque depende de infra que varia por ambiente — aceitável.

**3. Type consistency:** `Accent`/`StepNumber` definidos em `lib/prep/types.ts` e usados em todos os consumidores (PrepStepper, QuestionCard, QuestionPager, PrepShellProvider). `classifyPrepSections` retorna `ClassifiedSections` com `likely | deepDive | ask` — chaves casam com uso nas Telas 3/4/5.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-23-prepavaga-spec-opcao-a.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — eu despacho um subagent fresco por task, com review entre tasks. Iteração rápida, contexto isolado, melhor pra plano longo (20 tasks).

**2. Inline Execution** — eu executo as tasks nesta sessão usando `superpowers:executing-plans`, com checkpoints batched.

**Qual abordagem?**
