import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AtsFixesSection } from "./AtsFixesSection";
import type { AtsFix } from "@/lib/ai/schemas";

const fix = (priority: number, gap: string): AtsFix => ({
  priority,
  gap,
  original_cv_language: "ferramentas digitais",
  jd_language: `trecho da vaga sobre ${gap}`,
  suggested_rewrite: `Implantei ${gap} na operação de RH da CIA em 2024.`,
});

describe("AtsFixesSection", () => {
  it("lists the fixes in priority order under a count heading", () => {
    render(<AtsFixesSection fixes={[fix(1, "agentic AI"), fix(2, "sucessão")]} />);

    expect(screen.getByText("2 ajustes em ordem de impacto")).toBeInTheDocument();
    expect(screen.getByText("agentic AI")).toBeInTheDocument();
    expect(screen.getByText("sucessão")).toBeInTheDocument();
  });

  it("shows at most the top 3 fixes", () => {
    render(
      <AtsFixesSection
        fixes={[fix(1, "um"), fix(2, "dois"), fix(3, "três"), fix(4, "quatro")]}
      />,
    );

    expect(screen.getByText("3 ajustes em ordem de impacto")).toBeInTheDocument();
    expect(screen.queryByText("quatro")).not.toBeInTheDocument();
  });

  it("celebrates a full match instead of announcing zero fixes", () => {
    render(<AtsFixesSection fixes={[]} />);

    expect(screen.queryByText(/0 ajustes/)).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum ajuste necessário")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
