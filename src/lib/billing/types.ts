// src/lib/billing/types.ts
// Only the fields we read. Asaas returns more — we don't care.

export type AsaasCustomer = {
  id: string;
  name: string;
  email: string;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  value: number;
  cycle: string;
  status: string;
  nextDueDate?: string;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string;
  value: number;
  status: string;
  billingType: string;
  externalReference?: string | null;
  paymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  paymentLink?: string;
  nextDueDate?: string;
};

export type AsaasWebhookEvent = {
  event: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
  transfer?: AsaasTransfer;
};

export type CreateCustomerInput = {
  name: string;
  email: string;
  externalReference: string;
  cpfCnpj: string;
  // Endereço (necessário pra emissão de NFSe pelo Asaas).
  // Asaas normaliza CEP (aceita com ou sem hífen) e resolve city/state
  // a partir dele — mas mandamos explicitamente pra robustez.
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
};

export type CreateSubscriptionInput = {
  customer: string;
  billingType: "UNDEFINED" | "PIX" | "CREDIT_CARD" | "BOLETO";
  value: number;
  cycle: "MONTHLY" | "YEARLY";
  nextDueDate: string;
  description: string;
  externalReference: string;
  callback?: { successUrl: string; autoRedirect?: boolean };
};

export type CreatePaymentInput = {
  customer: string;
  billingType: "UNDEFINED" | "PIX" | "CREDIT_CARD" | "BOLETO";
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
  callback?: { successUrl: string; autoRedirect?: boolean };
};

export type AsaasPixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export type CreateTransferInput = {
  value: number;
  operationType: "PIX";
  pixAddressKey: string;
  pixAddressKeyType: AsaasPixKeyType;
  description?: string;
};

export type AsaasTransfer = {
  id: string;
  value: number;
  netValue?: number;
  status:
    | "PENDING"
    | "BANK_PROCESSING"
    | "DONE"
    | "CANCELLED"
    | "FAILED"
    | string;
  description?: string;
  failReason?: string;
  scheduleDate?: string;
  effectiveDate?: string;
  transferFee?: number;
};
