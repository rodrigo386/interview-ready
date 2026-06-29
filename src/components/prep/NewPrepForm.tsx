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
import { track } from "@/lib/analytics/client";

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
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
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

  const cvReady = Boolean(cvId) || Boolean(cvText);
  const jdReady = Boolean(jdText);
  const companyReady = company.trim().length > 0;
  const jobTitleReady = jobTitle.trim().length > 0;
  const canSubmit = companyReady && jobTitleReady && cvReady && jdReady;
  // Tell the user EXACTLY what's still blocking submission instead of a generic
  // "preencha tudo" — the disabled button with no guidance was a likely cause of
  // users uploading a CV and then abandoning without generating.
  const missing = [
    !companyReady && "empresa",
    !jobTitleReady && "cargo",
    !cvReady && "seu CV",
    !jdReady && "descrição da vaga",
  ].filter(Boolean) as string[];

  return (
    <>
      {pending && <GeneratingOverlay />}

      <form
        action={(fd) => {
          // jdText is the source of truth for jd_source — `url` means user
          // resolved via Jina Reader, `paste` means manual paste. We default
          // to `unknown` if the picker never reported (shouldn't happen
          // because canSubmit gates it).
          track("prep_started", {
            has_existing_cv: Boolean(cvId),
            jd_source: jdText ? "paste" : "unknown",
          });
          formAction(fd);
        }}
        className="space-y-5"
      >
        <fieldset disabled={pending} className="space-y-5">
          <Card
            number={1}
            title="Sobre a vaga"
            subtitle="Onde você está se candidatando."
            done={companyReady && jobTitleReady}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="companyName"
                  className="block text-xs font-medium uppercase tracking-wide text-text-muted"
                >
                  Empresa
                </label>
                <Input
                  id="companyName"
                  name="companyName"
                  placeholder="Ex: Hexion"
                  required
                  className="mt-1.5"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="jobTitle"
                  className="block text-xs font-medium uppercase tracking-wide text-text-muted"
                >
                  Cargo
                </label>
                <Input
                  id="jobTitle"
                  name="jobTitle"
                  placeholder="Ex: Diretor Sênior, AI & Procurement"
                  required
                  className="mt-1.5"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
            </div>
          </Card>

          <Card
            number={2}
            title="Seu CV"
            subtitle="Use um CV salvo, faça upload ou cole o texto."
            done={cvReady}
          >
            <CvPicker existingCvs={existingCvs} onResolved={onCvResolved} />
            {cvId && <input type="hidden" name="cvId" value={cvId} />}
            {cvText && <input type="hidden" name="cvText" value={cvText} />}
          </Card>

          <Card
            number={3}
            title="Descrição da vaga"
            subtitle="Cole o texto ou envie um link público."
            done={jdReady}
          >
            <JobDescriptionPicker onResolved={onJdResolved} />
            {jdText && (
              <input type="hidden" name="jobDescription" value={jdText} />
            )}
          </Card>
        </fieldset>

        {state.duplicate && !pending && (
          <div
            role="alert"
            className="rounded-xl border border-yellow-500/40 bg-yellow-soft p-4 text-sm"
          >
            <p className="font-semibold text-yellow-700">
              Você já tem um prep para essa vaga
            </p>
            <p className="mt-1 text-ink-2">
              Encontramos um prep idêntico pra{" "}
              <strong>{state.duplicate.companyName}</strong>
              {" · "}
              {state.duplicate.jobTitle}. Reaproveite o existente em vez de gerar
              de novo.
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
            className="rounded-xl border border-yellow-500/40 bg-yellow-soft p-4 text-sm"
          >
            <p className="font-semibold text-yellow-700">
              Uso atípico detectado neste ciclo
            </p>
            <p className="mt-1 text-ink-2">
              Sua conta Pro atingiu o teto mensal de preps. Esse limite é alto pra
              cobrir uso real — se você está rodando legitimamente, fala comigo
              que libero na hora.
            </p>
            <a
              href="mailto:prepavaga@prepavaga.com.br?subject=PrepaVaga%20%E2%80%94%20liberar%20cap%20mensal"
              className="mt-3 inline-block rounded-pill bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700"
            >
              Falar com prepavaga@prepavaga.com.br →
            </a>
          </div>
        )}

        {state.error &&
          !pending &&
          state.error !== "quota_exceeded" &&
          state.error !== "pro_soft_cap" && (
            <p
              className="rounded-xl border border-red-500/40 bg-red-soft px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {state.error}
            </p>
          )}

        <UpgradeModal
          open={state.error === "quota_exceeded" && !pending}
          onClose={() => {
            window.location.reload();
          }}
          onCheckout={(kind) => checkout.start(kind)}
        />
        {checkout.error && (
          <p
            role="alert"
            className="rounded-xl border border-red-500 bg-red-soft px-3 py-2 text-sm text-red-700"
          >
            {checkout.error}
          </p>
        )}
        {checkout.dialog}

        <div className="rounded-2xl border border-line bg-bg p-5 shadow-prep">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-text-primary">
                {canSubmit
                  ? "Tudo pronto. Vamos gerar seu dossiê."
                  : `Falta preencher: ${missing.join(", ")}.`}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                Cerca de 60 segundos. Você pode ficar nesta página.
              </p>
            </div>
            <Button
              type="submit"
              disabled={pending || !canSubmit}
              size="lg"
              className="w-full md:w-auto md:min-w-[220px]"
            >
              {pending ? (
                <>
                  <Spinner />
                  <span className="ml-2">Gerando…</span>
                </>
              ) : (
                "Gerar meu dossiê →"
              )}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

function Card({
  number,
  title,
  subtitle,
  done,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-bg p-5 shadow-prep md:p-6">
      <header className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className={
            done
              ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-semibold text-white"
              : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-soft text-xs font-semibold text-orange-700"
          }
        >
          {done ? "✓" : number}
        </span>
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
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
          <p className="text-base font-medium text-text-primary">
            Gerando seu dossiê
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Pesquisando a empresa, depois escrevendo seu prep. Cerca de 60
            segundos.
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner({ large = false }: { large?: boolean }) {
  const size = large ? "h-8 w-8" : "h-4 w-4";
  return (
    <svg
      className={`${size} animate-spin text-brand-600`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
