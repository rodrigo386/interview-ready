import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceStrip } from "./SourceStrip";

describe("<SourceStrip />", () => {
  it("lista de onde copiar a vaga, em texto (não em arte de marca)", () => {
    const { container } = render(<SourceStrip />);
    for (const nome of ["LinkedIn", "Gupy", "Catho", "Vagas.com", "InfoJobs", "Indeed"]) {
      expect(screen.getByText(nome)).toBeInTheDocument();
    }
    // logo de terceiros sugere parceria que não existe
    expect(container.querySelector("img, svg")).toBeNull();
  });

  it("manda COPIAR E COLAR o texto: a ferramenta anônima não aceita link", () => {
    // fetchJdFromUrl exige login, e o Jina Reader foi irregular nos testes
    // (Gupy 4 de 6, LinkedIn redirecionou pra lista). Prometer link aqui seria
    // falso no hero.
    const { container } = render(<SourceStrip />);
    expect(container.textContent).toMatch(/copie o texto e cole/i);
    expect(container.textContent).not.toMatch(/\blink\b/i);
  });

  it("avisa que não há parceria com as marcas", () => {
    render(<SourceStrip />);
    expect(screen.getByText(/sem parceria ou vínculo/i)).toBeInTheDocument();
  });
});
