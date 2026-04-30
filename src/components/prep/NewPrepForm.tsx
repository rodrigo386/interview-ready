"use client";

import Link from "next/link";
import { useActionState, useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPrep, type CreatePrepState } from "@/app/prep/new/actions";
import { CvPicker, type CvSummary } from "./CvPicker";
import { JobDescriptionPicker } from "./JobDescriptionPicker";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { useCheckoutFlow } from "@/components/billing/useCheckoutFlow";

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
  const checkout = useCheckoutFlow();

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

        {state.duplicate && !pending && (
          <div
            role="alert"
            className="rounded-md border border-yellow-500/40 bg-yellow-soft p-4 text-sm"
          >
            <p className="font-semibold text-yellow-700">
              Você já tem um prep para essa vaga
            </p>
            <p className="mt-1 text-ink-2">
              Encontramos um prep idêntico pra <strong>{state.duplicate.companyName}</strong>
              {" · "}
              {state.duplicate.jobTitle}. Reaproveite o existente em vez de gerar de novo.
            </p>
            <Link
              href={`/prep/${state.duplicate.id}`}
              className="mt-3 inline-block rounded-pill bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700"
            >
              Abrir prep existente →
            </Link>
          </div>
        )}

        {state.error === "pro_soft_cap" && !pending && (
          <div
            role="alert"
            className="rounded-md border border-yellow-500/40 bg-yellow-soft p-4 text-sm"
          >
            <p className="font-semibold text-yellow-700">
              Uso atípico detectado neste ciclo
            </p>
            <p className="mt-1 text-ink-2">
              Sua conta Pro atingiu o teto mensal de preps. Esse limite é alto pra cobrir
              uso real — se você está rodando legitimamente, fala comigo que libero na hora.
            </p>
            <a
              href="mailto:rodrigo@proaicircle.com?subject=PrepaVAGA%20%E2%80%94%20liberar%20cap%20mensal"
              className="mt-3 inline-block rounded-pill bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700"
            >
              Falar com rodrigo@proaicircle.com →
            </a>
          </div>
        )}

        {state.error && !pending && state.error !== "quota_exceeded" && state.error !== "pro_soft_cap" && (
          <p className="text-sm text-red-500 dark:text-red-400" role="alert">
            {state.error}
          </p>
        )}

        <UpgradeModal
          open={state.error === "quota_exceeded" && !pending}
          onClose={() => {
            // No-op: re-submitting the form will retry; user can also navigate away.
            // The modal closes on Esc or outside-click via its own handlers.
            window.location.reload();
          }}
          onCheckout={(kind) => checkout.start(kind)}
        />
        {checkout.error && (
          <p role="alert" className="rounded-md border border-red-500 bg-red-soft px-3 py-2 text-sm text-red-700">
            {checkout.error}
          </p>
        )}
        {checkout.dialog}

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
