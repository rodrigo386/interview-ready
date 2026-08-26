import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArticleInlineCta } from "./ArticleInlineCta";

describe("ArticleInlineCta", () => {
  it("a variante default NÃO manda mais pro cadastro", () => {
    // Cadastrar deixou de conceder qualquer coisa quando o modelo virou
    // crédito avulso. Mandar leitor de artigo pra /signup é beco: ele cria
    // conta, não ganha nada e não tem o que fazer.
    render(<ArticleInlineCta />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/analise-ats-gratis");
    expect(link).not.toHaveAttribute("href", "/signup");
  });

  it("a variante ats continua na ferramenta anônima", () => {
    render(<ArticleInlineCta variant="ats" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/analise-ats-gratis",
    );
  });

  it("as duas variantes prometem ausência de cadastro — o destino não pede", () => {
    for (const v of ["default", "ats"] as const) {
      const { unmount } = render(<ArticleInlineCta variant={v} />);
      expect(screen.getByText(/sem cadastro/i)).toBeInTheDocument();
      unmount();
    }
  });

  it("default e ats seguem com textos distintos — a ponte é diferente", () => {
    // Mesmo destino, leitor diferente: `ats` fala com quem já mexe no
    // currículo; `default` precisa ligar o assunto do artigo ao teste.
    const { container: a, unmount } = render(<ArticleInlineCta />);
    const textoDefault = a.textContent;
    unmount();
    const { container: b } = render(<ArticleInlineCta variant="ats" />);
    expect(b.textContent).not.toBe(textoDefault);
  });

  it("nenhuma variante promete currículo reescrito — o anônimo não entrega isso", () => {
    for (const v of ["default", "ats"] as const) {
      const { container, unmount } = render(<ArticleInlineCta variant={v} />);
      expect(container.textContent).not.toMatch(/reescrit|reescrev/i);
      unmount();
    }
  });
});
