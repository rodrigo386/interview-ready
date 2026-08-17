import { findSku } from "./prices";

export type ExternalReference =
  | { kind: "pro_subscription"; userId: string }
  | { kind: "prep_purchase"; userId: string; qty: number; nano: string };

export function buildExternalReference(input: ExternalReference): string {
  if (input.kind === "pro_subscription") return `pro:${input.userId}`;
  return `prep:${input.userId}:${input.qty}:${input.nano}`;
}

export function parseExternalReference(raw: string | null | undefined): ExternalReference | null {
  if (!raw) return null;
  const parts = raw.split(":");

  if (parts[0] === "pro" && parts.length === 2 && parts[1]) {
    return { kind: "pro_subscription", userId: parts[1] };
  }

  // Formato antigo `prep:<uid>:<nano>`: pagamento criado antes do deploy que
  // chega no webhook depois dele. Vale 1 crédito.
  if (parts[0] === "prep" && parts.length === 3 && parts[1] && parts[2]) {
    return { kind: "prep_purchase", userId: parts[1], qty: 1, nano: parts[2] };
  }

  if (parts[0] === "prep" && parts.length === 4 && parts[1] && parts[2] && parts[3]) {
    const qty = Number(parts[2]);
    if (!Number.isInteger(qty) || !findSku(qty)) return null;
    return { kind: "prep_purchase", userId: parts[1], qty, nano: parts[3] };
  }

  return null;
}
