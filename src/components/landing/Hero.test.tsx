import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Hero } from "./Hero";

// A server action de verdade puxa next/headers, env e o admin client do
// Supabase. O assunto aqui é o que o hero coloca na primeira tela.
vi.mock("@/app/analise-ats-gratis/actions", () => ({
  runAnonAtsAnalysis: vi.fn(async () => null),
}));
vi.mock("@/lib/analytics/client", () => ({ track: vi.fn() }));

describe("<Hero />", () => {
  it("coloca a ferramenta grátis na dobra, não um convite a criar conta", () => {
    const { getByLabelText, getByRole } = render(<Hero />);

    expect(getByLabelText(/cole a descrição da vaga/i)).toBeTruthy();
    expect(getByLabelText(/envie seu currículo/i)).toBeTruthy();
    expect(
      getByRole("button", { name: /analisar meu currículo grátis/i }),
    ).toBeTruthy();
  });

  it("não manda ninguém pro cadastro antes de entregar o score", () => {
    // Regressão do funil invertido: o hero anterior tinha o /signup como CTA
    // primário e escondia a análise grátis como terceiro link em texto
    // pequeno. Cadastro na primeira tela é a fricção que essa mudança tirou.
    const { container } = render(<Hero />);

    expect(container.querySelector('a[href="/signup"]')).toBeNull();
  });

  it("mantém um único CTA secundário, o exemplo pronto", () => {
    const { container } = render(<Hero />);

    const links = Array.from(container.querySelectorAll("a"));
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/exemplo");
  });
});
