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
