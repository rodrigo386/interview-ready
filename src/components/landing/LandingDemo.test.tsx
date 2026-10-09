import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { LandingDemo } from "./LandingDemo";
import { EXEMPLO_PRINCIPAL, EXEMPLOS } from "@/lib/exemplos/data";

afterEach(() => vi.unstubAllGlobals());

describe("<LandingDemo />", () => {
  it("oferece uma área por exemplo e as 4 partes do resultado", () => {
    render(<LandingDemo />);
    const areas = within(screen.getByRole("group", { name: /área do exemplo/i })).getAllByRole("button");
    expect(areas).toHaveLength(EXEMPLOS.length + 1);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Score",
      "Ajustes",
      "Empresa e salário",
      "Perguntas",
    ]);
  });

  it("começa no score, com o medidor e o cargo do primeiro exemplo", () => {
    render(<LandingDemo />);
    expect(screen.getByRole("tab", { name: "Score" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(EXEMPLO_PRINCIPAL.score));
    expect(screen.getByText(EXEMPLO_PRINCIPAL.cargo)).toBeInTheDocument();
  });

  it("cada aba mostra o conteúdo certo", () => {
    render(<LandingDemo />);
    fireEvent.click(screen.getByRole("tab", { name: "Ajustes" }));
    expect(screen.getByText("Crítico")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Empresa e salário" }));
    expect(screen.getByText(/pesquisa da empresa/i)).toBeInTheDocument();
    expect(screen.getByText(/faixa salarial estimada/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Perguntas" }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("trocar a área troca o exemplo inteiro", () => {
    render(<LandingDemo />);
    const outra = EXEMPLOS[0];
    fireEvent.click(screen.getByRole("button", { name: outra.area }));
    expect(screen.getByRole("button", { name: outra.area })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(outra.cargo)).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(outra.score));
  });

  it("navega as abas pelo teclado (setas, Home e End) com tabindex móvel", () => {
    render(<LandingDemo />);
    const score = screen.getByRole("tab", { name: "Score" });
    score.focus();
    fireEvent.keyDown(score, { key: "ArrowRight" });
    const ajustes = screen.getByRole("tab", { name: "Ajustes" });
    expect(ajustes).toHaveAttribute("aria-selected", "true");
    expect(ajustes).toHaveAttribute("tabindex", "0");
    expect(score).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(ajustes);

    fireEvent.keyDown(ajustes, { key: "End" });
    expect(screen.getByRole("tab", { name: "Perguntas" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Perguntas" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Score" })).toHaveAttribute("aria-selected", "true"); // dá a volta
    fireEvent.keyDown(screen.getByRole("tab", { name: "Score" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Perguntas" })).toHaveAttribute("aria-selected", "true");
  });

  it("o painel é um tabpanel ligado à aba ativa", () => {
    render(<LandingDemo />);
    fireEvent.click(screen.getByRole("tab", { name: "Perguntas" }));
    const painel = screen.getByRole("tabpanel");
    expect(painel.getAttribute("aria-labelledby")).toBe("demo-aba-perguntas");
  });

  it("o medidor só monta quando a seção entra na tela (a animação toca à vista)", () => {
    let disparar: (e: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: typeof disparar) {
          disparar = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    render(<LandingDemo />);
    expect(screen.queryByRole("meter")).toBeNull();
    act(() => disparar([{ isIntersecting: true }]));
    expect(screen.getByRole("meter")).toBeInTheDocument();
  });

  it("a aba de ajustes não repete o link do guia (a landing não é a /exemplo)", () => {
    render(<LandingDemo />);
    fireEvent.click(screen.getByRole("button", { name: EXEMPLOS[0].area }));
    fireEvent.click(screen.getByRole("tab", { name: "Ajustes" }));
    expect(screen.queryByRole("link", { name: /guia de currículo/i })).toBeNull();
  });

  it("avisa que é ilustrativo e leva à ferramenta, não ao cadastro", () => {
    const { container } = render(<LandingDemo />);
    expect(screen.getByText(/são ilustrativos/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /fazer a minha análise grátis/i })).toHaveAttribute("href", "#analisar");
    expect(container.querySelector('a[href="/signup"]')).toBeNull();
  });

  it("os controles são marcados para o funil (cta_click)", () => {
    const { container } = render(<LandingDemo />);
    const marcados = Array.from(container.querySelectorAll("[data-analytics-cta]")).map((e) => e.getAttribute("data-analytics-cta"));
    expect(marcados).toContain("demo_aba_ajustes");
    expect(marcados).toContain("demo_area_marketing");
    expect(marcados).toContain("landing_demo_cta");
  });
});
