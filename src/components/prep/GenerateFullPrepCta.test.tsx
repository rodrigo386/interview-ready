import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GenerateFullPrepCta } from "./GenerateFullPrepCta";

vi.mock("@/app/prep/[id]/full-prep-actions", () => ({
  generateFullPrep: vi.fn(async () => ({})),
}));
vi.mock("@/lib/analytics/client", () => ({ track: vi.fn() }));
vi.mock("@/components/billing/useCheckoutFlow", () => ({
  useCheckoutFlow: () => ({
    start: vi.fn(),
    pending: false,
    error: null,
    dialog: null,
  }),
}));

describe("GenerateFullPrepCta", () => {
  it("pede a empresa quando a vaga não disse qual é", () => {
    // O primeiro cliente pagante colou uma vaga só com requisitos. Sem
    // empresa, o Stage A pesquisa "a empresa" e devolve ensaio genérico —
    // ele pagou por cinco entregáveis e recebeu quatro.
    render(<GenerateFullPrepCta sessionId="s1" needsCompany />);
    const campo = screen.getByLabelText(/qual é a empresa/i);
    expect(campo).toBeRequired();
  });

  it("não pede nada quando a empresa já é conhecida", () => {
    render(<GenerateFullPrepCta sessionId="s1" />);
    expect(screen.queryByLabelText(/qual é a empresa/i)).not.toBeInTheDocument();
  });

  it("explica POR QUE está perguntando, ligando ao que foi comprado", () => {
    // Campo extra sem justificativa no instante do pagamento é fricção pura.
    render(<GenerateFullPrepCta sessionId="s1" needsCompany />);
    expect(
      screen.getByText(/parte do que você está comprando/i),
    ).toBeInTheDocument();
  });

  it("o campo vive DENTRO do form que dispara a geração", () => {
    // Se ficasse fora, o valor não seria enviado e o servidor recusaria com
    // company_required num loop sem saída.
    const { container } = render(
      <GenerateFullPrepCta sessionId="s1" needsCompany />,
    );
    const form = container.querySelector("form");
    expect(form?.querySelector('input[name="companyName"]')).toBeTruthy();
  });
});
