"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

const STORAGE_PREFIX = "prepavaga:anon-ats-completed-fired:";

/**
 * Dispara `anon_ats_completed` uma vez por análise por sessão do navegador.
 * Montado pela página de resultado: quando ela renderiza, a análise já existe
 * no banco e a pessoa está de fato vendo a nota — que é o evento que interessa
 * medir, não "a IA respondeu".
 *
 * Mesmo padrão do `PrepCompletedTracker`, inclusive no fallback: se o
 * sessionStorage não estiver disponível (aba anônima), dispara mesmo assim —
 * um evento repetido custa menos que um evento perdido.
 */
export function AnonAtsCompletedTracker({
  analysisId,
  score,
  fixesCount,
  modelUsed,
}: {
  analysisId: string;
  score: number;
  fixesCount: number;
  modelUsed?: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `${STORAGE_PREFIX}${analysisId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // segue e dispara
    }
    track("anon_ats_completed", {
      score,
      fixes_count: fixesCount,
      model_used: modelUsed,
    });
  }, [analysisId, score, fixesCount, modelUsed]);

  return null;
}
