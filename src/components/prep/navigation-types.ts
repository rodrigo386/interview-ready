export type JourneyNodeStatus =
  | "ready"
  | "generating"
  | "failed"
  | "pending";

export type JourneyNode = {
  id: string;
  icon: string;
  label: string;
  status: JourneyNodeStatus;
  href: string;
};

export const NODE_STATUS_LABEL: Record<JourneyNodeStatus, string> = {
  ready: "Pronto",
  generating: "Gerando",
  failed: "Falhou",
  pending: "Pendente",
};
