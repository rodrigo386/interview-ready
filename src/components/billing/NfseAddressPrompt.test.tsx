import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NfseAddressPrompt } from "./NfseAddressPrompt";

vi.mock("@/app/(app)/dashboard/address-actions", () => ({
  saveBillingAddress: vi.fn(async () => ({})),
}));

describe("NfseAddressPrompt", () => {
  it("é dispensável — quem acabou de pagar não pode ficar travado", () => {
    // Este é o ponto do componente. O diálogo que ele substitui era
    // obrigatório e vinha ANTES do pagamento; a obrigação fiscal não
    // justifica bloquear alguém que já pagou.
    render(<NfseAddressPrompt />);
    fireEvent.click(screen.getByRole("button", { name: /agora não/i }));
    expect(screen.queryByText(/nota fiscal/i)).not.toBeInTheDocument();
  });

  it("deixa claro que os créditos já estão liberados", () => {
    // Sem isso o aviso parece uma pendência que trava o produto comprado.
    render(<NfseAddressPrompt />);
    expect(screen.getByText(/créditos estão liberados/i)).toBeInTheDocument();
  });

  it("não mostra formulário nenhum antes de a pessoa escolher preencher", () => {
    render(<NfseAddressPrompt />);
    expect(screen.queryByLabelText(/CEP/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /informar endereço/i }));
    expect(screen.getByLabelText(/CEP/i)).toBeInTheDocument();
  });

  it("só o complemento é opcional", () => {
    render(<NfseAddressPrompt />);
    fireEvent.click(screen.getByRole("button", { name: /informar endereço/i }));
    expect(screen.getByLabelText(/complemento/i)).not.toBeRequired();
    for (const rotulo of [/CEP/i, /rua/i, /número/i, /bairro/i, /cidade/i, /UF/i]) {
      expect(screen.getByLabelText(rotulo)).toBeRequired();
    }
  });
});
