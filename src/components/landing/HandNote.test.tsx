import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HandNote } from "./HandNote";

describe("<HandNote />", () => {
  it("é decorativa: escondida de leitor de tela e sem capturar clique", () => {
    const { container } = render(<HandNote>veja em 24 segundos</HandNote>);
    const raiz = container.firstElementChild!;
    expect(raiz.getAttribute("aria-hidden")).toBe("true");
    expect(raiz.className).toContain("pointer-events-none");
    expect(raiz.textContent).toBe("veja em 24 segundos");
  });

  it("usa a fonte manuscrita declarada no layout", () => {
    const { container } = render(<HandNote>oi</HandNote>);
    expect((container.querySelector("p") as HTMLElement).style.fontFamily).toContain("--font-hand");
  });
});
