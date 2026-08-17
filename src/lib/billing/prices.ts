export const PRO_AMOUNT_CENTS = 3000;       // R$30.00
export const PER_USE_AMOUNT_CENTS = 1000;   // R$10.00

/**
 * SKUs de compra de preparação. A quantidade viaja no externalReference,
 * nunca inferida do valor pago — casar por valor quebraria em qualquer
 * promoção ou ajuste de preço.
 */
export const PREP_SKUS = [
  { qty: 1, cents: 1000 },
  { qty: 3, cents: 2500 },
  { qty: 5, cents: 4000 },
] as const;

export function findSku(qty: number): { qty: number; cents: number } | null {
  return PREP_SKUS.find((s) => s.qty === qty) ?? null;
}

export function centsToBrl(cents: number): number {
  return Math.round(cents) / 100;
}

export function brlLabel(cents: number): string {
  const brl = centsToBrl(cents);
  return brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
