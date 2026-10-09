/**
 * Status da candidatura de uma preparação, marcado pela própria pessoa.
 * Os valores são o CHECK da coluna `prep_sessions.application_status`
 * (migration 0025): mexeu aqui, mexa lá.
 */
export const APPLICATION_STATUSES = [
  "preparando",
  "candidatei",
  "entrevista",
  "oferta",
  "encerrada",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const DEFAULT_APPLICATION_STATUS: ApplicationStatus = "preparando";

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  preparando: "Preparando",
  candidatei: "Já me candidatei",
  entrevista: "Entrevista marcada",
  oferta: "Recebi proposta",
  encerrada: "Encerrada",
};

export function isApplicationStatus(v: unknown): v is ApplicationStatus {
  return typeof v === "string" && (APPLICATION_STATUSES as readonly string[]).includes(v);
}

/** Valor vindo do banco que não casa com a lista cai no padrão, em vez de quebrar a UI. */
export function toApplicationStatus(v: unknown): ApplicationStatus {
  return isApplicationStatus(v) ? v : DEFAULT_APPLICATION_STATUS;
}
