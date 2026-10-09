"use client";

import { useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/client";

const MARCOS = [25, 50, 75, 100] as const;

/** `play()` devolve Promise nos navegadores atuais e `undefined` nos antigos. */
function tocar(v: HTMLVideoElement) {
  try {
    v.play()?.catch(() => {});
  } catch {
    // autoplay recusado: o poster continua lá e o botão dá o play
  }
}

/**
 * Vídeo mudo, em loop, que toca sozinho quando aparece. Serve aos dois vídeos
 * da landing: o promocional (tela cheia) e o de instruções (ao lado do
 * formulário).
 *
 * Decisões que não são óbvias:
 *  - `preload="none"` + poster: o LCP é um JPG, não vários MB de vídeo. O
 *    arquivo só começa a baixar quando o `play()` roda.
 *  - Só toca visível (IntersectionObserver). Vídeo rodando fora da tela gasta
 *    bateria e banda à toa — e é o que impede o vídeo de instruções, que fica
 *    abaixo do promocional, de baixar antes de a pessoa chegar nele.
 *  - Não toca sozinho com `prefers-reduced-motion` nem com `saveData`: nesses
 *    casos fica o poster e a pessoa decide dar play.
 *  - O botão de pausar existe por acessibilidade (WCAG 2.2.2: movimento
 *    automático com mais de 5s precisa de um jeito de parar), não por enfeite.
 *  - Sem trilha de áudio: não há o que silenciar e o autoplay nunca é bloqueado
 *    por política de som.
 *  - `description` é a transcrição em texto do vídeo (sr-only): é o que leitor
 *    de tela lê no lugar das imagens.
 */
export function AutoVideo({
  src,
  poster,
  name,
  description,
  variant = "framed",
}: {
  src: string;
  poster: string;
  /** Qual vídeo é, para os eventos de analytics. */
  name: "hero" | "howto";
  description: string;
  /** "framed": cartão com borda 16:9. "full": preenche o contêiner (object-cover). */
  variant?: "framed" | "full";
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const descId = useId();
  const userPaused = useRef(false);
  // Analytics: cada evento sai no máximo uma vez por visita à página.
  const userStarted = useRef(false);
  const playTracked = useRef(false);
  const marcos = useRef(new Set<number>());
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
      userStarted.current = true;
      tocar(v);
    } else {
      userPaused.current = true;
      track("video_pause", { video: name, at_s: Math.round(v.currentTime) });
      v.pause();
    }
  }

  function aoTocar() {
    setPlaying(true);
    if (playTracked.current) return;
    playTracked.current = true;
    track("video_play", {
      video: name,
      trigger: userStarted.current ? "user" : "auto",
    });
  }

  // O vídeo é `loop`, então `ended` nunca dispara: o 100% é "chegou ao fim da
  // primeira volta" (97% cobre a janela entre o último timeupdate e o loop).
  function aoAvancar() {
    const v = ref.current;
    if (!v || !v.duration) return;
    const pct = (v.currentTime / v.duration) * 100;
    for (const m of MARCOS) {
      const alvo = m === 100 ? 97 : m;
      if (pct >= alvo && !marcos.current.has(m)) {
        marcos.current.add(m);
        track("video_progress", { video: name, pct: m });
      }
    }
  }

  const full = variant === "full";

  return (
    <figure className={full ? "m-0 h-full w-full" : "m-0"}>
      <div
        className={
          full
            ? "relative h-full w-full overflow-hidden bg-white"
            : "relative aspect-video overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_20px_60px_-24px_rgba(0,0,0,0.22)] dark:border-zinc-800"
        }
      >
        <video
          ref={ref}
          className={full ? "h-full w-full object-cover" : "h-full w-full"}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          aria-describedby={descId}
          onPlay={aoTocar}
          onTimeUpdate={aoAvancar}
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
      <figcaption id={descId} className="sr-only">
        {description}
      </figcaption>
    </figure>
  );
}
