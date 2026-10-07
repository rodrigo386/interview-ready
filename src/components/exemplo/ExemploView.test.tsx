import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ExemploView } from "./ExemploView";
import { EXEMPLO_PRINCIPAL, EXEMPLOS } from "@/lib/exemplos/data";

describe("ExemploView", () => {
  it("mostra a vaga, o score e as 3 perguntas do exemplo", () => {
    const e = EXEMPLOS[0];
    render(<ExemploView exemplo={e} />);
    expect(screen.getByRole("heading", { name: e.cargo })).toBeInTheDocument();
    expect(screen.getByText(String(e.score))).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("o CTA final vai pra ferramenta grátis, nunca pro /signup", () => {
    render(<ExemploView exemplo={EXEMPLOS[1]} />);
    const cta = screen.getByRole("link", { name: /analisar meu currículo grátis/i });
    expect(cta).toHaveAttribute("href", "/analise-ats-gratis");
    expect(cta).toHaveAttribute("data-analytics-cta", "exemplo_primary");
    expect(document.querySelector('a[href="/signup"]')).toBeNull();
  });

  it("a navegação lista todas as áreas e marca só a atual", () => {
    const atual = EXEMPLOS[2];
    render(<ExemploView exemplo={atual} />);
    const nav = screen.getByRole("navigation", { name: /exemplos por área/i });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(EXEMPLOS.length + 1);
    const marcados = links.filter((l) => l.getAttribute("aria-current") === "page");
    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toHaveTextContent(atual.area);
    // o principal fica em /exemplo, os demais em /exemplo/<slug>
    expect(links[0]).toHaveAttribute("href", "/exemplo");
    expect(links[1]).toHaveAttribute("href", `/exemplo/${EXEMPLOS[0].slug}`);
  });

  it("**destaque** vira <strong>, sem asteriscos sobrando", () => {
    render(<ExemploView exemplo={EXEMPLOS[0]} />);
    expect(document.body.textContent).not.toContain("**");
    expect(document.querySelectorAll("strong").length).toBeGreaterThan(2);
  });

  it("linka o artigo da área quando existe, e o principal não inventa um", () => {
    const { unmount } = render(<ExemploView exemplo={EXEMPLOS[0]} />);
    expect(
      screen.getByRole("link", { name: /guia de currículo para/i }),
    ).toHaveAttribute("href", `/artigos/${EXEMPLOS[0].artigo}`);
    unmount();
    render(<ExemploView exemplo={EXEMPLO_PRINCIPAL} />);
    expect(screen.queryByRole("link", { name: /guia de currículo para/i })).toBeNull();
  });

  it("avisa que tudo é ilustrativo", () => {
    render(<ExemploView exemplo={EXEMPLOS[0]} />);
    expect(screen.getByText(/são ilustrativos/i)).toBeInTheDocument();
  });
});
