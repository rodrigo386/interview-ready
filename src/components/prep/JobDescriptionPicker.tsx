"use client";

import { useEffect, useState, useTransition } from "react";
import {
  fetchJdFromUrl,
  type FetchJdState,
} from "@/app/prep/new/jd-actions";

type Mode = "paste" | "url";

export function JobDescriptionPicker({
  onResolved,
}: {
  /** Called whenever the resolved JD text changes. null = not enough yet. */
  onResolved: (text: string | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("paste");
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  const [fetched, setFetched] = useState<{ text: string; url: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startFetch] = useTransition();

  useEffect(() => {
    if (mode === "paste") {
      onResolved(pasted.length >= 200 ? pasted : null);
    } else {
      onResolved(fetched ? fetched.text : null);
    }
  }, [mode, pasted, fetched, onResolved]);

  const handleFetch = () => {
    setError(null);
    const fd = new FormData();
    fd.append("url", url);
    startFetch(async () => {
      const res: FetchJdState = await fetchJdFromUrl({}, fd);
      if (res.jd) {
        setFetched(res.jd);
        // Auto-switch to paste mode and pre-fill the textarea with the full
        // extracted text — user can review/edit before submitting.
        setPasted(res.jd.text);
        setMode("paste");
      } else if (res.error) {
        setError(res.error);
        setFetched(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm text-text-secondary">
        Descrição da vaga
      </label>

      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={
            mode === "paste"
              ? "font-semibold text-orange-700"
              : "text-ink-3 hover:text-ink-2"
          }
        >
          Colar texto
        </button>
        <span aria-hidden className="text-line">
          ·
        </span>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={
            mode === "url"
              ? "font-semibold text-orange-700"
              : "text-ink-3 hover:text-ink-2"
          }
        >
          Enviar link da vaga
        </button>
      </div>

      {mode === "paste" ? (
        <textarea
          rows={12}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Cole aqui a descrição completa da vaga (LinkedIn, Gupy, Catho, site da empresa)."
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-60"
        />
      ) : (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/view/..."
              disabled={pending}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleFetch}
              disabled={pending || url.trim().length === 0}
              className="rounded-pill bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-40"
            >
              {pending ? "Buscando…" : "Buscar texto"}
            </button>
          </div>
          <p className="text-xs text-ink-3">
            Funciona melhor com páginas públicas (sem login). LinkedIn e Gupy
            podem falhar — se isso acontecer, use &quot;Colar texto&quot;.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          {fetched && (
            <div className="rounded-md border border-line bg-bg p-3">
              <p className="mb-2 text-xs font-semibold text-green-700">
                ✓ Texto extraído de {hostnameOf(fetched.url)} (
                {fetched.text.length.toLocaleString("pt-BR")} caracteres)
              </p>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-ink-2">
                {fetched.text.slice(0, 600)}
                {fetched.text.length > 600 ? "…" : ""}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function hostnameOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}
