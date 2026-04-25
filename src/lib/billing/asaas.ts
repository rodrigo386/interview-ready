import "server-only";
import { env } from "@/lib/env";
import type {
  AsaasCustomer,
  AsaasPayment,
  AsaasSubscription,
  CreateCustomerInput,
  CreatePaymentInput,
  CreateSubscriptionInput,
} from "./types";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.ASAAS_API_KEY) {
    throw new Error("ASAAS_API_KEY is not set");
  }
  const res = await fetch(`${env.ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "PrepaVAGA/1.0",
      access_token: env.ASAAS_API_KEY,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Asaas ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

export const asaas = {
  createCustomer: (input: CreateCustomerInput) =>
    call<AsaasCustomer>("/customers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createSubscription: (input: CreateSubscriptionInput) =>
    call<AsaasSubscription>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createPayment: (input: CreatePaymentInput) =>
    call<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancelSubscription: (id: string) =>
    call<{ deleted: boolean; id: string }>(`/subscriptions/${id}`, {
      method: "DELETE",
    }),
  getPayment: (id: string) => call<AsaasPayment>(`/payments/${id}`),
};
