import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LockedFix } from "./LockedFix";

describe("LockedFix", () => {
  it("mostra quantos ajustes faltam sem revelar o conteúdo", () => {
    render(<LockedFix remaining={4} />);
    expect(screen.getByText(/mais 4 ajustes/i)).toBeInTheDocument();
  });

  it("usa singular quando falta um só", () => {
    render(<LockedFix remaining={1} />);
    expect(screen.getByText(/mais 1 ajuste\b/i)).toBeInTheDocument();
  });

  it("não renderiza nada quando não há ajuste escondido", () => {
    const { container } = render(<LockedFix remaining={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
