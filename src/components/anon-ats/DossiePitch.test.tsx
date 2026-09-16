import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DossiePitch } from "./DossiePitch";

describe("<DossiePitch />", () => {
  it("diz o preço na página onde a pessoa acabou de ver o score", () => {
    // O buraco que originou o componente: a página de resultado da análise
    // grátis não mencionava preço em lugar nenhum, e a única página que
    // explicava o produto pago era a home — que parte do tráfego dessa
    // ferramenta nunca carrega.
    const { container } = render(<DossiePitch />);
    expect(container.textContent).toMatch(/R\$10/);
  });

  it("cobre todos os entregáveis da landing, sem prometer nada a mais", () => {
    // Antes a lista era DOSSIE_INCLUI verbatim. Em 16/09 virou prévia
    // personalizada, então o texto não bate mais letra a letra — mas as
    // quatro categorias que a landing vende continuam obrigatórias aqui.
    const { container } = render(<DossiePitch />);
    const t = container.textContent ?? "";
    expect(t).toMatch(/currículo reescrito/i);
    expect(t).toMatch(/pesquisa atual sobre a empresa/i);
    expect(t).toMatch(/faixa salarial/i);
    expect(t).toMatch(/perguntas prováveis/i);
  });

  it("lidera com o currículo — é a dor de quem acabou de ver a nota", () => {
    const { getByRole } = render(<DossiePitch />);
    expect(getByRole("heading").textContent).toMatch(/currículo/i);
  });

  it("personaliza com as palavras que faltam, o cargo e a empresa", () => {
    const { container } = render(
      <DossiePitch
        faltando={["benefícios", "legislação", "treinamento"]}
        cargo="Analista Jr"
        empresa="Cinemark"
      />,
    );
    const t = container.textContent ?? "";
    expect(t).toContain("benefícios, legislação e treinamento");
    expect(t).toContain("Analista Jr");
    expect(t).toContain("Cinemark");
  });

  it("não exibe placeholder de cargo ou empresa desconhecidos", () => {
    const { container } = render(
      <DossiePitch cargo="esta vaga" empresa="a empresa" />,
    );
    // O texto genérico ("pesquisa sobre a empresa") é legítimo. O defeito
    // seria o placeholder aparecer EM DESTAQUE, como se fosse o nome real —
    // foi assim que o primeiro cliente recebeu um dossiê de "a empresa".
    const destacados = [...container.querySelectorAll("strong")].map((e) =>
      e.textContent?.toLowerCase(),
    );
    expect(destacados).not.toContain("a empresa");
    expect(destacados).not.toContain("esta vaga");
  });

  it("mostra a nota projetada como teto, e só quando há ganho", () => {
    const comGanho = render(<DossiePitch score={34} projected={86} />);
    expect(comGanho.container.textContent).toMatch(/até 86/);
    comGanho.unmount();

    const semGanho = render(<DossiePitch score={90} projected={90} />);
    expect(semGanho.container.textContent).not.toMatch(/até/);
  });

  it("manda para o cadastro, não para o checkout", () => {
    // Cobrar antes de existir conta exigiria CPF e cliente no Asaas sem
    // usuário. O que muda é a pessoa saber o preço antes de se cadastrar.
    const { getByRole } = render(<DossiePitch />);
    expect(getByRole("link").getAttribute("href")).toBe("/signup");
  });
});
