import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AvatarMenu } from "./AvatarMenu";

const baseProps = {
  email: "foo@bar.com",
  avatarUrl: "https://example.com/a.jpg",
  logoutAction: async () => {},
};

describe("<AvatarMenu />", () => {
  it("começa fechado (menu não no DOM)", () => {
    const { queryByRole } = render(<AvatarMenu {...baseProps} />);
    expect(queryByRole("menu")).toBeNull();
  });

  it("abre menu ao clicar no botão", () => {
    const { getByRole, getByText } = render(<AvatarMenu {...baseProps} />);
    fireEvent.click(getByRole("button", { name: /menu do usuário/i }));
    expect(getByText("Meu perfil")).toBeInTheDocument();
    expect(getByText("Sair")).toBeInTheDocument();
  });

  it("mostra email no menu aberto", () => {
    const { getByRole, getByText } = render(<AvatarMenu {...baseProps} />);
    fireEvent.click(getByRole("button", { name: /menu do usuário/i }));
    expect(getByText("foo@bar.com")).toBeInTheDocument();
  });

  it("fecha ao pressionar Escape", () => {
    const { getByRole, queryByText } = render(<AvatarMenu {...baseProps} />);
    fireEvent.click(getByRole("button", { name: /menu do usuário/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByText("Meu perfil")).toBeNull();
  });
});
