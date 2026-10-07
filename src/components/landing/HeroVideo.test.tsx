import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { HeroVideo } from "./HeroVideo";

let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;
let observeCb: ((e: { isIntersecting: boolean }[]) => void) | null;
let observerCriado: boolean;

function preparar({ reduzir = false } = {}) {
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pause });
  observeCb = null;
  observerCriado = false;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        observerCriado = true;
        observeCb = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduzir && q.includes("prefers-reduced-motion"),
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("<HeroVideo />", () => {
  beforeEach(() => preparar());

  it("não baixa o vídeo no carregamento: poster no LCP, preload none", () => {
    const { container } = render(<HeroVideo />);
    const v = container.querySelector("video")!;
    expect(v.getAttribute("src")).toBe("/video/hero-v1.mp4");
    expect(v.getAttribute("poster")).toBe("/video/hero-poster-v1.jpg");
    expect(v.getAttribute("preload")).toBe("none");
    expect(v.loop).toBe(true);
    expect(v.hasAttribute("playsinline")).toBe(true);
  });

  it("fica mudo por propriedade (o React não escreve o atributo no SSR)", () => {
    const { container } = render(<HeroVideo />);
    expect(container.querySelector("video")!.muted).toBe(true);
  });

  it("tem descrição em texto para leitor de tela", () => {
    const { container } = render(<HeroVideo />);
    const v = container.querySelector("video")!;
    const desc = container.querySelector("#" + v.getAttribute("aria-describedby"))!;
    expect(desc.textContent).toMatch(/score ATS/);
    expect(desc.className).toContain("sr-only");
  });

  it("toca ao entrar na tela e pausa ao sair", () => {
    render(<HeroVideo />);
    act(() => observeCb!([{ isIntersecting: true }]));
    expect(play).toHaveBeenCalledTimes(1);
    act(() => observeCb!([{ isIntersecting: false }]));
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("o botão alterna entre reproduzir e pausar (WCAG 2.2.2)", () => {
    const { container } = render(<HeroVideo />);
    const v = container.querySelector("video")!;
    expect(screen.getByRole("button", { name: "Reproduzir vídeo" })).toBeInTheDocument();
    act(() => { fireEvent.play(v); });
    const pausar = screen.getByRole("button", { name: "Pausar vídeo" });
    Object.defineProperty(v, "paused", { configurable: true, value: false });
    fireEvent.click(pausar);
    expect(pause).toHaveBeenCalled();
  });

  it("pausa do usuário não é desfeita pelo observador de visibilidade", () => {
    const { container } = render(<HeroVideo />);
    const v = container.querySelector("video")!;
    act(() => { fireEvent.play(v); });
    Object.defineProperty(v, "paused", { configurable: true, value: false });
    fireEvent.click(screen.getByRole("button", { name: "Pausar vídeo" }));
    play.mockClear();
    act(() => observeCb!([{ isIntersecting: true }]));
    expect(play).not.toHaveBeenCalled();
  });
});

describe("<HeroVideo /> com prefers-reduced-motion", () => {
  it("não toca sozinho: só o poster, e o play fica na mão da pessoa", () => {
    preparar({ reduzir: true });
    render(<HeroVideo />);
    expect(observerCriado).toBe(false);
    expect(play).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reproduzir vídeo" })).toBeInTheDocument();
  });
});
