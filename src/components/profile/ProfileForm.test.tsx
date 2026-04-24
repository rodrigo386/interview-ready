import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { ProfileForm } from "./ProfileForm";

const baseProps = {
  initialFullName: "João",
  initialLanguage: "pt-br" as const,
  action: vi.fn(async () => ({ ok: true as const })),
};

describe("<ProfileForm />", () => {
  it("submit button começa desabilitado (pristine)", () => {
    const { getByRole } = render(<ProfileForm {...baseProps} />);
    expect((getByRole("button", { name: /salvar/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("habilita submit quando user muda o nome", () => {
    const { getByLabelText, getByRole } = render(<ProfileForm {...baseProps} />);
    fireEvent.change(getByLabelText(/nome/i), { target: { value: "João Silva" } });
    expect((getByRole("button", { name: /salvar/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("chama action com o payload correto", async () => {
    const action = vi.fn(async () => ({ ok: true as const }));
    const { getByLabelText, getByRole } = render(<ProfileForm {...baseProps} action={action} />);
    fireEvent.change(getByLabelText(/nome/i), { target: { value: "Maria" } });
    fireEvent.change(getByLabelText(/idioma/i), { target: { value: "en" } });
    fireEvent.click(getByRole("button", { name: /salvar/i }));
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith({ full_name: "Maria", preferred_language: "en" }),
    );
  });
});
