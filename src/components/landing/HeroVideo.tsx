"use client";

import { useEffect, useRef, useState } from "react";

const SRC = "/video/hero-v1.mp4";
const POSTER = "/video/hero-poster-v1.jpg";

/** `play()` devolve Promise nos navegadores atuais e `undefined` nos antigos. */
function tocar(v: HTMLVideoElement) {
  try {
    v.play()?.catch(() => {});
  } catch {
    // autoplay recusado: o poster continua lá e o botão dá o play
  }
}

/**
 * Vídeo de 20s do hero: o produto em uso, do formulário ao dossiê.
 *
 * O formulário real continua na dobra (ver Hero). O vídeo é o que explica o que
 * vem DEPOIS do score — a pesquisa da empresa, as perguntas e a faixa salarial —
 * sem competir com o campo que converte.
 *
 * Decisões que não são óbvias:
 *  - `preload="none"` + poster: o LCP é um JPG de 21 KB, não 4,6 MB de vídeo. O
 *    arquivo só começa a baixar quando o `play()` roda.
 *  - Só toca visível (IntersectionObserver). Vídeo rodando fora da tela gasta
 *    bateria e banda à toa.
 *  - Não toca sozinho com `prefers-reduced-motion` nem com `saveData`: nesses
 *    casos fica o poster e a pessoa decide dar play.
 *  - O botão de pausar existe por acessibilidade (WCAG 2.2.2: movimento
 *    automático com mais de 5s precisa de um jeito de parar), não por enfeite.
 *  - Sem trilha de áudio: não há o que silenciar e o autoplay nunca é bloqueado
 *    por política de som.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // React não escreve o atributo `muted` no HTML do servidor, e o autoplay
    // só é permitido com o vídeo mudo: então a propriedade é setada aqui.
    v.muted = true;

    const reduzir =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const poucoDado =
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData === true;
    if (reduzir || poucoDado) return;

    if (typeof IntersectionObserver === "undefined") {
      tocar(v);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (userPaused.current) return;
        if (entry.isIntersecting) tocar(v);
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  function alternar() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      tocar(v);
    } else {
      userPaused.current = true;
      v.pause();
    }
  }

  return (
    <figure className="m-0">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_20px_60px_-24px_rgba(0,0,0,0.22)] dark:border-zinc-800">
        <video
          ref={ref}
          className="h-full w-full"
          src={SRC}
          poster={POSTER}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          aria-describedby="hero-video-desc"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        <button
          type="button"
          onClick={alternar}
          aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}
          className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <rect x="2" y="1" width="3.6" height="12" rx="1" fill="currentColor" />
              <rect x="8.4" y="1" width="3.6" height="12" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M3 1.5 L12.5 7 L3 12.5 Z" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
      <figcaption id="hero-video-desc" className="sr-only">
        Vídeo de 20 segundos, sem áudio: você cola a vaga e o currículo, vê o score
        ATS, os ajustes que mais pesam, o currículo no celular e as perguntas com
        roteiro. A análise ATS é grátis e a preparação completa custa R$10.
      </figcaption>
    </figure>
  );
}
