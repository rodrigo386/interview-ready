"use client";

import { useState } from "react";

export function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://prepavaga.com.br/?ref=${code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-prep">
      <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
        Seu link de afiliado
      </p>
      <div className="mt-3 flex items-center gap-3">
        <code className="flex-1 break-all rounded-md bg-bg px-3 py-2 font-mono text-sm text-ink-2">
          {url}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-pill bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700"
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
