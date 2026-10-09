import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceStrip } from "./SourceStrip";

describe("<SourceStrip />", () => {
  it("lista as seis fontes: logo (imagem com nome) onde há arquivo, nome em texto onde não há", () => {
    render(<SourceStrip />);
    // com arquivo vetorial
    for (const nome of ["LinkedIn", "Catho", "InfoJobs", "Indeed"]) {
      expect(screen.getByRole("img", { name: nome })).toBeInTheDocument();
    }
    // sem arquivo (ainda): fallback em texto, no mesmo cinza
    for (const nome of ["Gupy", "Vagas.com"]) {
      expect(screen.getByText(nome)).toBeInTheDocument();
      expect(screen.queryByRole("img", { name: nome })).toBeNull();
    }
  });

  it("os logos apontam pra arquivos que existem em public/logos", async () => {
    const fs = await import("node:fs");
    const { container } = render(<SourceStrip />);
    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src")!);
    expect(srcs).toHaveLength(4);
    for (const src of srcs) {
      expect(fs.existsSync(`public${src}`), src).toBe(true);
    }
  });

  it("os arquivos de logo não carregam script nem manipulador de evento", async () => {
    // São arquivos de terceiros servidos pelo nosso domínio. Via <img> o
    // navegador não executa script de SVG, mas conferir custa nada.
    const fs = await import("node:fs");
    for (const f of fs.readdirSync("public/logos")) {
      const svg = fs.readFileSync(`public/logos/${f}`, "utf8");
      expect(svg, f).not.toMatch(/<script|onload=|onclick=|onerror=|javascript:|<foreignObject/i);
    }
  });

  it("fala de link E de texto: o link funciona na maioria dos sites, o texto em todos", () => {
    const { container } = render(<SourceStrip />);
    expect(container.textContent).toMatch(/cole o link/i);
    expect(container.textContent).toMatch(/copie o texto e cole/i);
  });

  it("os logos viram silhueta cinza por CSS e têm tamanho intrínseco (sem salto de layout)", () => {
    const { container } = render(<SourceStrip />);
    for (const img of Array.from(container.querySelectorAll("img"))) {
      expect(img.className).toContain("brightness-0");
      expect(img.className).toContain("dark:invert");
      expect(img.getAttribute("width")).toBeTruthy();
      expect(img.getAttribute("height")).toBeTruthy();
    }
  });

  it("avisa que não há parceria e que as marcas são dos donos", () => {
    render(<SourceStrip />);
    expect(screen.getByText(/sem parceria\s+ou vínculo/i)).toBeInTheDocument();
    expect(screen.getByText(/marcas de seus respectivos donos/i)).toBeInTheDocument();
  });
});
