import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaas } from "@/lib/billing/asaas";
import { buildExternalReference } from "@/lib/billing/ids";
import { PRO_AMOUNT_CENTS, PER_USE_AMOUNT_CENTS } from "@/lib/billing/prices";
import { env } from "@/lib/env";

const bodySchema = z.object({
  kind: z.enum(["pro_subscription", "prep_purchase"]),
  cpfCnpj: z.string().trim().min(11).max(20).optional(),
});

function normalizeCpf(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function isValidCpfCnpjLength(digits: string): boolean {
  return digits.length === 11 || digits.length === 14;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nano(): string {
  return Math.random().toString(36).slice(2, 10);
}

function appUrl(req: Request): string {
  // Prefer the request's actual host so the Asaas callback returns the user
  // to the same domain they started checkout from (e.g. prepavaga.com.br
  // even when NEXT_PUBLIC_APP_URL still points to the railway.app fallback).
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !auth.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reads stay on the user-scoped client (RLS-protected). Writes to billing
  // columns (cpf_cnpj, asaas_customer_id, asaas_subscription_id) go through
  // the admin client because the column-level GRANT for `authenticated`
  // intentionally excludes them — those columns are server-managed only.
  const admin = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, asaas_customer_id, asaas_subscription_id, subscription_status, cpf_cnpj",
    )
    .eq("id", auth.user.id)
    .single();
  const p = profile as
    | {
        id: string;
        full_name: string | null;
        email: string;
        asaas_customer_id: string | null;
        asaas_subscription_id: string | null;
        subscription_status: string | null;
        cpf_cnpj: string | null;
      }
    | null;
  if (!p) {
    return NextResponse.json({ error: "Profile missing" }, { status: 500 });
  }

  if (
    parsed.kind === "pro_subscription" &&
    (p.subscription_status === "active" || p.subscription_status === "overdue")
  ) {
    return NextResponse.json({ error: "Já assinante" }, { status: 409 });
  }

  // Resolve CPF/CNPJ: profile takes precedence, body provides on first run.
  let cpfCnpj: string | null = p.cpf_cnpj;
  if (!cpfCnpj && parsed.cpfCnpj) {
    const digits = normalizeCpf(parsed.cpfCnpj);
    if (!isValidCpfCnpjLength(digits)) {
      return NextResponse.json(
        { error: "CPF inválido. Use 11 dígitos (CPF) ou 14 (CNPJ)." },
        { status: 422 },
      );
    }
    cpfCnpj = digits;
    await admin.from("profiles").update({ cpf_cnpj: digits }).eq("id", p.id);
  }
  if (!cpfCnpj) {
    return NextResponse.json({ error: "cpf_required" }, { status: 422 });
  }

  // Ensure customer exists AND has cpfCnpj on Asaas side. Customers created
  // before we collected CPF won't have it; PATCH them to avoid 400 on the
  // next createSubscription/createPayment.
  let customerId = p.asaas_customer_id;
  if (!customerId) {
    const cust = await asaas.createCustomer({
      name: p.full_name ?? p.email,
      email: p.email,
      externalReference: p.id,
      cpfCnpj,
    });
    customerId = cust.id;
    await admin
      .from("profiles")
      .update({ asaas_customer_id: customerId })
      .eq("id", p.id);
  } else {
    // Best-effort: ensure the existing customer has the cpfCnpj on file.
    try {
      await asaas.updateCustomer(customerId, { cpfCnpj });
    } catch (err) {
      console.warn("[billing/checkout] updateCustomer failed:", err);
    }
  }

  const proSuccessUrl = `${appUrl(req)}/welcome/pro`;
  const oneOffSuccessUrl = `${appUrl(req)}/dashboard?billing=ok`;

  if (parsed.kind === "pro_subscription") {
    const sub = await asaas.createSubscription({
      customer: customerId,
      billingType: "UNDEFINED",
      value: PRO_AMOUNT_CENTS / 100,
      cycle: "MONTHLY",
      nextDueDate: tomorrowIso(),
      description: "PrepaVAGA Pro · assinatura mensal",
      externalReference: buildExternalReference({
        kind: "pro_subscription",
        userId: p.id,
      }),
      callback: { successUrl: proSuccessUrl, autoRedirect: true },
    });
    await admin
      .from("profiles")
      .update({ asaas_subscription_id: sub.id })
      .eq("id", p.id);

    const { data: firstPayment } = await fetchFirstPayment(sub.id);
    const checkoutUrl = firstPayment?.invoiceUrl ?? firstPayment?.bankSlipUrl;
    if (!checkoutUrl) {
      return NextResponse.json({ error: "Asaas não retornou link de cobrança" }, { status: 502 });
    }
    return NextResponse.json({ checkoutUrl });
  }

  // prep_purchase
  const pay = await asaas.createPayment({
    customer: customerId,
    billingType: "UNDEFINED",
    value: PER_USE_AMOUNT_CENTS / 100,
    dueDate: tomorrowIso(),
    description: "PrepaVAGA · 1 prep avulso",
    externalReference: buildExternalReference({
      kind: "prep_purchase",
      userId: p.id,
      nano: nano(),
    }),
    callback: { successUrl: oneOffSuccessUrl, autoRedirect: true },
  });
  const checkoutUrl = pay.invoiceUrl ?? pay.bankSlipUrl;
  if (!checkoutUrl) {
    return NextResponse.json({ error: "Asaas não retornou link de cobrança" }, { status: 502 });
  }
  return NextResponse.json({ checkoutUrl });
}

async function fetchFirstPayment(subscriptionId: string) {
  if (!env.ASAAS_API_KEY) throw new Error("ASAAS_API_KEY is not set");
  const res = await fetch(
    `${env.ASAAS_BASE_URL}/subscriptions/${subscriptionId}/payments?limit=1&offset=0`,
    {
      headers: {
        access_token: env.ASAAS_API_KEY,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) {
    return { data: null };
  }
  const json = (await res.json()) as { data: Array<{ invoiceUrl?: string; bankSlipUrl?: string }> };
  return { data: json.data?.[0] ?? null };
}
