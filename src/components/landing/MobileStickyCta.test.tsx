import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react";
import { MobileStickyCta } from "./MobileStickyCta";

type Cb = (entries: Array<Partial<IntersectionObserverEntry>>) => void;

let fireIntersection: Cb | null = null;

beforeEach(() => {
  fireIntersection = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: Cb) {
        fireIntersection = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function comSentinela() {
  const el = document.createElement("div");
  el.id = "depois-do-score";
  document.body.appendChild(el);
}

describe("<MobileStickyCta />", () => {
  it("fica escondida enquanto o formulário do hero está na tela", () => {
    comSentinela();
    const { container } = render(<MobileStickyCta />);

    // Seção de baixo ainda não chegou: nada de barra competindo com o hero.
    act(() => {
      fireIntersection?.([
        { isIntersecting: false, boundingClientRect: { top: 900 } as DOMRect },
      ]);
    });

    expect(container.querySelector("a")).toBeNull();
  });

  it("aparece depois que o visitante passa do formulário", () => {
    comSentinela();
    const { container } = render(<MobileStickyCta />);

    act(() => {
      fireIntersection?.([
        { isIntersecting: true, boundingClientRect: { top: 400 } as DOMRect },
      ]);
    });

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    // Promessa e destino têm que bater: o texto diz "análise ATS grátis", então
    // o botão volta pro formulário, não pro cadastro. Era esse o bait-and-switch
    // da versão anterior, que mandava pro /signup.
    expect(link?.getAttribute("href")).toBe("#analisar");
    expect(link?.textContent).toMatch(/analisar grátis/i);
  });

  it("continua visível depois que a seção sobe e sai por cima", () => {
    comSentinela();
    const { container } = render(<MobileStickyCta />);

    act(() => {
      fireIntersection?.([
        { isIntersecting: false, boundingClientRect: { top: -1200 } as DOMRect },
      ]);
    });

    expect(container.querySelector("a")).not.toBeNull();
  });
});
