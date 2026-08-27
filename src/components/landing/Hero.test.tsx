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

  it("a manchete não promete apenas o que a concorrência já dá de graça", () => {
    // Pelo menos 5 concorrentes brasileiros diretos (AjustaCV, OtimizaCV, CV
    // Audit, CvPorVaga, CV Lab) vendem "seu currículo passa no ATS?" — e dois
    // entregam mais de graça ou cobram menos. Manchete de commodity não dá a
    // quem compara nenhum motivo pra escolher a PrepaVaga.
    const { getByRole } = render(<Hero />);

    expect(getByRole("heading", { level: 1 }).textContent).toMatch(/entrevista/i);
  });

  it("a dobra cita o que vem DEPOIS do currículo — o produto defensável", () => {
    // Pesquisa da empresa, perguntas prováveis e faixa salarial são o que
    // nenhum analisador de CV concorrente entrega. Estavam a uma seção de
    // distância da dobra, invisíveis pra quem decide em 5 segundos.
    const { container } = render(<Hero />);
    const texto = container.textContent ?? "";

    expect(texto).toMatch(/empresa/i);
    expect(texto).toMatch(/pergunta/i);
    expect(texto).toMatch(/salarial/i);
  });

  it("reposicionar não tira o grátis da dobra — ele é o motor de aquisição", () => {
    // A ferramenta converte 20 de 21 visitantes. O que muda é a promessa em
    // volta dela, não o que está na primeira tela.
    const { container } = render(<Hero />);
    const texto = container.textContent ?? "";

    expect(texto).toMatch(/grátis/i);
    expect(texto).toMatch(/sem cadastro/i);
  });
});
