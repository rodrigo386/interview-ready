"use client";

import { useActionState } from "react";
import { runAnonAtsAnalysis } from "@/app/analise-ats-gratis/actions";
import { PendingButton } from "@/components/prep/PendingButton";

export function AnonAtsForm() {
  const [state, action] = useActionState(runAnonAtsAnalysis, null);

  return (
    <form action={action} className="space-y-6">
      <div>
        <label htmlFor="jobDescription" className="text-sm font-bold text-ink">
          1. Cole a descrição da vaga
        </label>
        <textarea
          id="jobDescription"
          name="jobDescription"
          rows={8}
          required
          placeholder="Cole aqui o texto completo da vaga que você quer disputar."
          className="mt-2 w-full rounded-lg border border-line p-3 text-[15px] text-ink"
        />
      </div>

      <div>
        <label htmlFor="cvFile" className="text-sm font-bold text-ink">
          2. Envie seu currículo
        </label>
        <input
          id="cvFile"
          name="cvFile"
          type="file"
          accept=".pdf,.docx,.txt"
          className="mt-2 block w-full text-sm text-ink-2"
        />
        <p className="mt-2 text-xs text-ink-3">
          PDF, DOCX ou TXT. O arquivo é lido e descartado — não guardamos ele.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-orange-700">
            Prefiro colar o texto
          </summary>
          <textarea
            name="cvText"
            rows={8}
            placeholder="Cole aqui o conteúdo do seu currículo."
            className="mt-2 w-full rounded-lg border border-line p-3 text-[15px] text-ink"
          />
        </details>
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-lg bg-red-soft px-4 py-3 text-sm text-red-500">
          {state.error}
        </p>
      ) : null}

      <PendingButton
        idleLabel="Analisar meu currículo grátis →"
        pendingLabel="Analisando…"
        variant="primary"
      />
      <p className="text-xs text-ink-3">
        Sem cadastro e sem cartão. Você vê seu score na hora.
      </p>
    </form>
  );
}
