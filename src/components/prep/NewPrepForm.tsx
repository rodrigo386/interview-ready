"use client";

import { useActionState, useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPrep, type CreatePrepState } from "@/app/prep/new/actions";
import { CvPicker, type CvSummary } from "./CvPicker";
import { JobDescriptionPicker } from "./JobDescriptionPicker";

export function NewPrepForm({ existingCvs }: { existingCvs: CvSummary[] }) {
  const [state, formAction, pending] = useActionState<CreatePrepState, FormData>(
    createPrep,
    {},
  );

  const [cvId, setCvId] = useState<string | null>(
    existingCvs[0]?.id ?? null,
  );
  const [cvText, setCvText] = useState<string | null>(null);
  const [jdText, setJdText] = useState<string | null>(null);

  const onCvResolved = useCallback(
    (v: { cvId: string | null; cvText: string | null }) => {
      setCvId(v.cvId);
      setCvText(v.cvText);
    },
    [],
  );

  const onJdResolved = useCallback((text: string | null) => {
    setJdText(text);
  }, []);

  const canSubmit = (Boolean(cvId) || Boolean(cvText)) && Boolean(jdText);

  return (
    <>
      {pending && <GeneratingOverlay />}

      <form action={formAction} className="space-y-6">
        <fieldset disabled={pending} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="companyName" className="block text-sm text-text-secondary">
                Empresa
              </label>
              <Input id="companyName" name="companyName" placeholder="Ex: Hexion" required className="mt-1" />
            </div>
            <div>
              <label htmlFor="jobTitle" className="block text-sm text-text-secondary">
                Cargo
              </label>
              <Input
                id="jobTitle"
                name="jobTitle"
                placeholder="Ex: Diretor Sênior, AI & Procurement"
                required
                className="mt-1"
              />
            </div>
          </div>

          <CvPicker existingCvs={existingCvs} onResolved={onCvResolved} />
          {cvId && <input type="hidden" name="cvId" value={cvId} />}
          {cvText && <input type="hidden" name="cvText" value={cvText} />}

          <JobDescriptionPicker onResolved={onJdResolved} />
          {jdText && (
            <input type="hidden" name="jobDescription" value={jdText} />
          )}
        </fieldset>

        {state.error && !pending && (
          <p className="text-sm text-red-500 dark:text-red-400" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending || !canSubmit} className="w-full" size="lg">
          {pending ? (
            <>
              <Spinner />
              <span className="ml-2">Pesquisando a empresa e escrevendo seu prep… cerca de 60 segundos</span>
            </>
          ) : (
            "Gerar meu dossiê"
          )}
        </Button>

        {pending && (
          <p className="text-center text-xs text-text-muted">
            Pode ficar nesta página. Nós te redirecionamos quando estiver pronto.
          </p>
        )}
      </form>
    </>
  );
}

function GeneratingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-lg border border-border bg-bg p-8 text-center shadow-lg">
        <Spinner large />
        <div>
          <p className="text-base font-medium text-text-primary">Gerando seu dossiê</p>
          <p className="mt-2 text-sm text-text-secondary">
            Pesquisando a empresa, depois escrevendo seu prep. Cerca de 60 segundos.
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner({ large = false }: { large?: boolean }) {
  const size = large ? "h-8 w-8" : "h-4 w-4";
  return (
    <svg className={`${size} animate-spin text-brand-600`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
