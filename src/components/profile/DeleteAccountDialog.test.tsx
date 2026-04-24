import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

describe("<DeleteAccountDialog />", () => {
  it("submit começa desabilitado", () => {
    const { getByRole } = render(<DeleteAccountDialog action={vi.fn()} />);
    fireEvent.click(getByRole("button", { name: /excluir minha conta/i }));
    const submit = getByRole("button", { name: /excluir definitivamente/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("habilita submit quando input === 'EXCLUIR'", () => {
    const { getByRole, getByLabelText } = render(<DeleteAccountDialog action={vi.fn()} />);
    fireEvent.click(getByRole("button", { name: /excluir minha conta/i }));
    fireEvent.change(getByLabelText(/digite excluir/i), { target: { value: "EXCLUIR" } });
    const submit = getByRole("button", { name: /excluir definitivamente/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it("não habilita com texto incorreto", () => {
    const { getByRole, getByLabelText } = render(<DeleteAccountDialog action={vi.fn()} />);
    fireEvent.click(getByRole("button", { name: /excluir minha conta/i }));
    fireEvent.change(getByLabelText(/digite excluir/i), { target: { value: "Excluir" } });
    const submit = getByRole("button", { name: /excluir definitivamente/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});
