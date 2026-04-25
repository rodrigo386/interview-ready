export type ExternalReference =
  | { kind: "pro_subscription"; userId: string }
  | { kind: "prep_purchase"; userId: string; nano: string };

export function buildExternalReference(input: ExternalReference): string {
  if (input.kind === "pro_subscription") return `pro:${input.userId}`;
  return `prep:${input.userId}:${input.nano}`;
}

export function parseExternalReference(raw: string | null | undefined): ExternalReference | null {
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts[0] === "pro" && parts.length === 2 && parts[1]) {
    return { kind: "pro_subscription", userId: parts[1] };
  }
  if (parts[0] === "prep" && parts.length === 3 && parts[1] && parts[2]) {
    return { kind: "prep_purchase", userId: parts[1], nano: parts[2] };
  }
  return null;
}
