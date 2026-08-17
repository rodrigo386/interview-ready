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

  it("explica o caminho real pra refazer a MESMA vaga: excluir e criar de novo", () => {
    const { getByText } = render(<PartialPrepBanner failedSections={["likely"]} />);
    expect(
      getByText(/Pra refazer ESTA vaga, exclua este prep primeiro/),
    ).toBeDefined();
  });

  it("continua avisando que o que foi gerado continua do usuário", () => {
    const { getByText } = render(<PartialPrepBanner failedSections={["likely"]} />);
    expect(getByText(/O que foi gerado aqui continua seu/)).toBeDefined();
  });
});
