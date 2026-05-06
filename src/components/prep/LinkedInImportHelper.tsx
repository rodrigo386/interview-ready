"use client";

import { useState } from "react";

const PANEL_ID = "linkedin-import-helper-panel";
const HEADER_ID = "linkedin-import-helper-header";

export function LinkedInImportHelper() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-line bg-bg">
      <button
        type="button"
        id={HEADER_ID}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={PANEL_ID}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-2 hover:bg-orange-soft/40"
      >
        <span aria-hidden className="text-orange-700">💼</span>
        <span className="font-medium">Importar do LinkedIn</span>
        <span aria-hidden className="ml-auto text-ink-3">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div
          id={PANEL_ID}
          role="region"
          aria-labelledby={HEADER_ID}
          className="border-t border-line bg-orange-soft/30 px-4 py-3 text-sm text-ink-2"
        >
          <ol className="space-y-3">
            <li>
              <p>
                <span className="font-semibold text-ink">1.</span> Abra seu
                perfil no LinkedIn.
              </p>
              <a
                href="https://www.linkedin.com/in/me/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir meu LinkedIn em nova aba"
                className="mt-1 inline-flex items-center gap-1 rounded-pill bg-white px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-500/40 hover:bg-orange-soft"
              >
                <span aria-hidden>→</span> Abrir meu LinkedIn
              </a>
            </li>
            <li>
              <p>
                <span className="font-semibold text-ink">2.</span> No canto
                superior do perfil, clique em &quot;Recursos&quot; →
                &quot;Salvar como PDF&quot;. O download começa
                automaticamente.
              </p>
            </li>
            <li>
              <p>
                <span className="font-semibold text-ink">3.</span> Volte aqui
                e faça upload do PDF baixado no campo abaixo.{" "}
                <span aria-hidden>↓</span>
              </p>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
