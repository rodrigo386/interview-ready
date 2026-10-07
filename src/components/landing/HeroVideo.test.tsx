import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { HeroVideo } from "./HeroVideo";
import { track } from "@/lib/analytics/client";

vi.mock("@/lib/analytics/client", () => ({ track: vi.fn() }));

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(track).mockClear();
});

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

describe("<HeroVideo /> analytics", () => {
  beforeEach(() => preparar());

  const eventos = () => vi.mocked(track).mock.calls.map(([nome, props]) => [nome, props]);

  function comDuracao(v: HTMLVideoElement, duracao: number) {
    Object.defineProperty(v, "duration", { configurable: true, value: duracao });
  }
  function irPara(v: HTMLVideoElement, segundo: number) {
    Object.defineProperty(v, "currentTime", { configurable: true, writable: true, value: segundo });
    act(() => { fireEvent.timeUpdate(v); });
  }

  it("play automático sai como trigger auto, uma vez só", () => {
    const { container } = render(<HeroVideo />);
    const v = container.querySelector("video")!;
    act(() => { fireEvent.play(v); });
    act(() => { fireEvent.pause(v); });
    act(() => { fireEvent.play(v); });
    expect(eventos().filter(([n]) => n === "hero_video_play")).toEqual([
      ["hero_video_play", { trigger: "auto" }],
    ]);
  });

  it("play por clique no botão sai como trigger user", () => {
    const { container } = render(<HeroVideo />);
    const v = container.querySelector("video")!;
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir vídeo" }));
    act(() => { fireEvent.play(v); });
    expect(eventos()).toContainEqual(["hero_video_play", { trigger: "user" }]);
  });

  it("marcos de 25, 50, 75 e 100% saem uma vez cada, mesmo com loop", () => {
    const { container } = render(<HeroVideo />);
    const v = container.querySelector("video")!;
    comDuracao(v, 20);
    irPara(v, 2);   // 10%: nada
    expect(eventos().filter(([n]) => n === "hero_video_progress")).toHaveLength(0);
    irPara(v, 5);   // 25%
    irPara(v, 10);  // 50%
    irPara(v, 15.5); // 77%: cruza o 75
    irPara(v, 19.5); // 97,5%: fim da volta
    irPara(v, 1);   // loop recomeçou
    irPara(v, 5.5); // passou de novo pelo 25%: não repete
    const marcos = eventos().filter(([n]) => n === "hero_video_progress").map(([, p]) => (p as { pct: number }).pct);
    expect(marcos).toEqual([25, 50, 75, 100]);
  });

  it("pausa pelo botão sai com o segundo; a pausa automática ao sair da tela não conta", () => {
    const { container } = render(<HeroVideo />);
    const v = container.querySelector("video")!;
    act(() => { fireEvent.play(v); });
    Object.defineProperty(v, "paused", { configurable: true, value: false });
    Object.defineProperty(v, "currentTime", { configurable: true, writable: true, value: 7.4 });
    fireEvent.click(screen.getByRole("button", { name: "Pausar vídeo" }));
    expect(eventos()).toContainEqual(["hero_video_pause", { at_s: 7 }]);

    vi.mocked(track).mockClear();
    act(() => observeCb!([{ isIntersecting: false }])); // pausa automática
    expect(eventos().filter(([n]) => n === "hero_video_pause")).toHaveLength(0);
  });

  it("sem duração conhecida (vídeo ainda não carregou) não emite marco", () => {
    const { container } = render(<HeroVideo />);
    const v = container.querySelector("video")!;
    comDuracao(v, NaN);
    irPara(v, 5);
    expect(eventos().filter(([n]) => n === "hero_video_progress")).toHaveLength(0);
  });
});
