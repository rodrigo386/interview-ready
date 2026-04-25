export const PRO_AMOUNT_CENTS = 3000;       // R$30.00
export const PER_USE_AMOUNT_CENTS = 1000;   // R$10.00

export function centsToBrl(cents: number): number {
  return Math.round(cents) / 100;
}

export function brlLabel(cents: number): string {
  const brl = centsToBrl(cents);
  return brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
