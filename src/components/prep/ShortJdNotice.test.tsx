import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShortJdNotice } from "./ShortJdNotice";

describe("ShortJdNotice", () => {
  it("diz quantas palavras a vaga tem e aponta pra nova análise", () => {
    render(<ShortJdNotice words={5} />);
    expect(screen.getByRole("note")).toHaveTextContent("só 5 palavras");
    expect(screen.getByRole("link", { name: "nova análise" })).toHaveAttribute(
      "href",
      "/prep/new",
    );
  });
  it("singular", () => {
    render(<ShortJdNotice words={1} />);
    expect(screen.getByRole("note")).toHaveTextContent("só 1 palavra");
  });

  it("o destino do link é configurável (visitante sem conta)", () => {
    render(<ShortJdNotice words={5} href="/analise-ats-gratis" />);
    expect(screen.getByRole("link", { name: "nova análise" })).toHaveAttribute(
      "href",
      "/analise-ats-gratis",
    );
  });
});
