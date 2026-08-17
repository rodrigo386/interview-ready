import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LockedFix } from "./LockedFix";

describe("LockedFix", () => {
  it("anuncia no máximo 2 ajustes novos, mesmo com muitos escondidos (AtsFixesSection só mostra os 3 primeiros)", () => {
    render(<LockedFix remaining={6} />);
    // Título, corpo e CTA repetem o número — checa os três, exact match evita
    // colisão entre eles (textos diferentes ao redor do número).
    expect(screen.getByText("🔒 Mais 2 ajustes esperando")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ver mais 2 ajustes, sem pagar/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/mais 6/i)).not.toBeInTheDocument();
  });

  it("com remaining=2 (2 novos cabem nos 3 primeiros) também anuncia 2", () => {
    render(<LockedFix remaining={2} />);
    expect(screen.getByText("🔒 Mais 2 ajustes esperando")).toBeInTheDocument();
  });

  it("usa singular quando só 1 ajuste novo é revelado pelo cadastro", () => {
    render(<LockedFix remaining={1} />);
    expect(screen.getByText("🔒 Mais 1 ajuste esperando")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ver mais 1 ajuste, sem pagar/i }),
    ).toBeInTheDocument();
  });

  it("não renderiza nada quando não há ajuste escondido", () => {
    const { container } = render(<LockedFix remaining={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
