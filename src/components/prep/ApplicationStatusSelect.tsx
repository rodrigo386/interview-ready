"use client";

import { useState, useTransition } from "react";
import { setApplicationStatus } from "@/app/(app)/dashboard/status-actions";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  isApplicationStatus,
  type ApplicationStatus,
} from "@/lib/prep/application-status";

/** Cor do ponto por status: só o que já fecha a candidatura (proposta) ganha destaque. */
const PONTO: Record<ApplicationStatus, string> = {
  preparando: "bg-neutral-400",
  candidatei: "bg-yellow-500",
  entrevista: "bg-orange-500",
  oferta: "bg-green-500",
  encerrada: "bg-neutral-300",
};

/**
 * Seletor do status da candidatura, no card do painel. `<select>` nativo:
 * acessível, bom no celular, sem biblioteca. Otimista: troca na hora e volta
 * ao valor anterior (avisando) se a gravação falhar.
 */
export function ApplicationStatusSelect({
  sessionId,
  companyName,
  initial,
}: {
  sessionId: string;
  companyName: string;
  initial: ApplicationStatus;
}) {
  const [valor, setValor] = useState<ApplicationStatus>(initial);
  const [falhou, setFalhou] = useState(false);
  const [pendente, iniciar] = useTransition();

  function aoMudar(novo: string) {
    if (!isApplicationStatus(novo) || novo === valor) return;
    const anterior = valor;
    setValor(novo);
    setFalhou(false);
    iniciar(async () => {
      const r = await setApplicationStatus(sessionId, novo);
      if (!r.ok) {
        setValor(anterior);
        setFalhou(true);
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="flex min-w-0 items-center gap-2 text-xs text-text-tertiary">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${PONTO[valor]}`} />
        <span className="sr-only">Status da candidatura em {companyName}</span>
        <select
          value={valor}
          disabled={pendente}
          onChange={(e) => aoMudar(e.target.value)}
          className="min-w-0 max-w-full cursor-pointer rounded-md border border-border bg-bg py-1 pl-2 pr-6 text-xs font-medium text-text-secondary transition hover:border-ink-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60"
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {falhou ? (
        <p role="alert" className="text-xs text-red-700">
          Não foi possível salvar. Tente de novo.
        </p>
      ) : null}
    </div>
  );
}
