"use client";

import { useActionState, useState } from "react";
import { runAnonAtsAnalysis } from "@/app/analise-ats-gratis/actions";
import { PendingButton } from "@/components/prep/PendingButton";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/anon-ats/core";
import { track } from "@/lib/analytics/client";

export function AnonAtsForm() {
  const [state, action] = useActionState(runAnonAtsAnalysis, null);
  // Validação de tamanho no cliente. Sem ela, um arquivo acima do
  // `bodySizeLimit` faz a server action estourar antes de rodar — sem
  // `state.error`, sem redirect, sem nada na tela.
  const [fileError, setFileError] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileError(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setFileError(
        `Este arquivo tem ${mb} MB e o limite é ${MAX_UPLOAD_LABEL}. Envie um arquivo menor ou cole o texto do currículo abaixo.`,
      );
      return;
    }
    setFileError(null);
  }

  const erro = fileError ?? state?.error ?? null;

  return (
    <form
      action={(fd) => {
        const arquivo = fd.get("cvFile");
        track("anon_ats_started", {
          cv_source:
            arquivo instanceof File && arquivo.size > 0 ? "file" : "paste",
        });
        action(fd);
      }}
      className="space-y-6"
    >
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
          onChange={onFileChange}
          className="mt-2 block w-full text-sm text-ink-2"
        />
        <p className="mt-2 text-xs text-ink-3">
          PDF, DOCX ou TXT, até {MAX_UPLOAD_LABEL}. Não guardamos o arquivo — só
          o texto extraído, que fica guardado por 7 dias e depois deixa de ser
          acessível.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-orange-700">
            Prefiro colar o texto
          </summary>
          <label htmlFor="cvText" className="mt-3 block text-sm font-bold text-ink">
            Cole o texto do seu currículo
          </label>
          <textarea
            id="cvText"
            name="cvText"
            rows={8}
            placeholder="Cole aqui o conteúdo do seu currículo."
            className="mt-2 w-full rounded-lg border border-line p-3 text-[15px] text-ink"
          />
        </details>
      </div>

      {erro ? (
        <p role="alert" className="rounded-lg bg-red-soft px-4 py-3 text-sm text-red-500">
          {erro}
        </p>
      ) : null}

      <PendingButton
        idleLabel="Analisar meu currículo grátis →"
        pendingLabel="Analisando…"
        variant="primary"
        disabled={Boolean(fileError)}
      />
      <p className="text-xs text-ink-3">
        Sem cadastro e sem cartão. Você vê seu score na hora.
      </p>
    </form>
  );
}
