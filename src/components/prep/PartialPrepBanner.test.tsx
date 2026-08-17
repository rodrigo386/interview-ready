import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PartialPrepBanner } from "./PartialPrepBanner";

describe("<PartialPrepBanner />", () => {
  it("não renderiza nada quando não há seções falhadas", () => {
    const { container } = render(<PartialPrepBanner failedSections={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("lista as seções faltantes com o rótulo em PT-BR", () => {
    const { getByText } = render(
      <PartialPrepBanner failedSections={["likely", "tricky"]} />,
    );
    expect(
      getByText(/Perguntas prováveis, Perguntas difíceis/),
    ).toBeDefined();
  });

  it("não promete regenerar pra 'esta vaga ou pra outra' (a promessa antiga era falsa pra mesma vaga)", () => {
    // Regressão: `createPrep` bloqueia JD duplicada (mesmo fingerprint) sem
    // nenhum override, e a UI só oferece "Abrir prep existente" — que volta
    // pro mesmo parcial, que não se regenera. O texto antigo prometia que o
    // crédito devolvido "vale por uma preparação nova, pra esta vaga ou pra
    // outra", o que nunca foi verdade pra mesma vaga.
    const { queryByText } = render(<PartialPrepBanner failedSections={["likely"]} />);
    expect(queryByText(/pra esta vaga ou pra outra/)).toBeNull();
  });

  it("diz que o crédito devolvido vale pra outra vaga", () => {
    const { getByText } = render(<PartialPrepBanner failedSections={["likely"]} />);
    expect(
      getByText(/vale por uma preparação nova pra outra vaga/),
    ).toBeDefined();
  });

  it("explica o caminho real pra refazer a mesma vaga: excluir e criar de novo", () => {
    // "esta vaga" fica dentro de um <strong> (ênfase, não caixa-alta), então a
    // frase inteira não é um único nó de texto — checamos o parágrafo inteiro
    // pelo textContent em vez de casar a regex contra um nó só.
    const { getByText } = render(<PartialPrepBanner failedSections={["likely"]} />);
    const paragraph = getByText(/devolvemos o crédito usado/).closest("p");
    expect(paragraph?.textContent).toMatch(
      /Pra refazer esta vaga, exclua este prep antes de criar um novo\./,
    );
  });

  it("diz que o crédito já está disponível no saldo (não pendente)", () => {
    const { getByText } = render(<PartialPrepBanner failedSections={["likely"]} />);
    expect(getByText(/já está no seu saldo/)).toBeDefined();
  });

  it("usa <strong>, não caixa-alta, pra dar ênfase a 'esta vaga' (padrão dos vizinhos em src/components/prep/*.tsx)", () => {
    const { getByText } = render(<PartialPrepBanner failedSections={["likely"]} />);
    const emphasis = getByText("esta vaga");
    expect(emphasis.tagName).toBe("STRONG");
  });
});
