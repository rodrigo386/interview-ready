"use client";

import { useState } from "react";
import { track } from "@/lib/analytics/client";

/**
 * Texto e link do compartilhamento. Só a nota sai daqui: o resultado em si
 * (`/analise-ats-gratis/resultado`) é privado — o acesso é por cookie HttpOnly
 * justamente porque dá acesso ao texto do CV — então o link NUNCA é o da
 * própria página. Aponta pra home com UTMs, onde `landing_view` os captura.
 */
export function montarCompartilhamento(score: number, origin: string) {
  const link = `${origin}/?utm_source=share&utm_medium=score&utm_campaign=ats_resultado`;
  const texto = `Testei meu currículo no filtro ATS e deu ${score}/100. Teste o seu grátis, sem cadastro:`;
  return {
    link,
    texto,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${texto} ${link}`)}`,
    copiar: `${texto} ${link}`,
  };
}

export function ShareScore({ score }: { score: number }) {
  const [copiado, setCopiado] = useState(false);

  function dados() {
    return montarCompartilhamento(score, window.location.origin);
  }

  async function copiar() {
    track("score_share", { channel: "copiar", score });
    try {
      await navigator.clipboard.writeText(dados().copiar);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência: sem fallback ruidoso. O
      // botão do WhatsApp continua ao lado.
    }
  }

  return (
    <section
      aria-label="Compartilhar meu score"
      className="rounded-lg border border-line bg-white p-5 shadow-prep"
    >
      <h2 className="text-sm font-bold text-ink">Conhece alguém que está se candidatando?</h2>
      <p className="mt-1 text-sm text-ink-2">
        Mande o teste pra essa pessoa. Só a sua nota vai junto: seu currículo e a
        vaga ficam privados.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a
          href={hrefWhatsappInicial(score)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // O href SSR usa a origem pública; no clique trocamos pela origem
            // real da requisição (útil em teste/outro domínio apontado).
            e.currentTarget.href = dados().whatsapp;
            track("score_share", { channel: "whatsapp", score });
          }}
          className="inline-flex items-center rounded-pill bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          Enviar no WhatsApp
        </a>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center rounded-pill border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-orange-500"
        >
          {copiado ? "Copiado ✓" : "Copiar mensagem"}
        </button>
      </div>
    </section>
  );
}

function hrefWhatsappInicial(score: number): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";
  return montarCompartilhamento(score, origin).whatsapp;
}
