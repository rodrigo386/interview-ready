"use client";

import { useEffect, useState } from "react";

/**
 * Barra fixa mobile para visitante anônimo da landing.
 *
 * Duas correções em relação à versão anterior:
 *
 * 1. O texto prometia "Análise ATS grátis" e o botão dizia "Criar conta",
 *    levando pro /signup. Promessa e destino agora batem: o botão leva de
 *    volta ao formulário do hero, que é a análise grátis de verdade.
 *
 * 2. A visibilidade era decidida por um listener de scroll com limiar fixo em
 *    560px, que roda a cada frame de rolagem e chuta a altura do hero. Agora é
 *    um IntersectionObserver na seção logo abaixo do hero: a barra aparece
 *    quando o visitante passa do formulário, seja qual for a altura da tela.
 */
const SENTINEL_ID = "depois-do-score";

export function MobileStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById(SENTINEL_ID);
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Visível assim que a seção entra na tela, e continua visível depois
        // que ela sobe e sai por cima (boundingClientRect.top < 0).
        setVisible(entry.isIntersecting || entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-bg/95 px-4 pt-2.5 backdrop-blur-md md:hidden dark:border-zinc-800"
      style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs leading-snug text-text-secondary">
          <span className="block font-semibold text-text-primary">
            Análise ATS grátis
          </span>
          Sem cadastro, sem cartão.
        </p>
        <a
          href="#analisar"
          data-analytics-cta="mobile_sticky"
          data-analytics-location="landing"
          className="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition hover:bg-brand-700"
        >
          Analisar grátis →
        </a>
      </div>
    </div>
  );
}
