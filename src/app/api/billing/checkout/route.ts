import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaas } from "@/lib/billing/asaas";
import { buildExternalReference } from "@/lib/billing/ids";
import { PRO_AMOUNT_CENTS, PER_USE_AMOUNT_CENTS } from "@/lib/billing/prices";
import { env } from "@/lib/env";
import { resolveOrigin } from "@/lib/http/host";

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
      "id, full_name, email, asaas_customer_id, asaas_subscription_id, subscription_status, cpf_cnpj, postal_code, address_street, address_number, address_complement, address_district, address_city, address_state",
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
        postal_code: string | null;
        address_street: string | null;
        address_number: string | null;
        address_complement: string | null;
        address_district: string | null;
        address_city: string | null;
        address_state: string | null;
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

  // Endereço é exigido pra Asaas emitir NFSe. Users criados antes da
  // migration 0015 (sem address) caem aqui — frontend redireciona pra
  // /profile/account preencher. Mesmo padrão do cpf_required.
  const hasFullAddress =
    !!p.postal_code &&
    !!p.address_street &&
    !!p.address_number &&
    !!p.address_district &&
    !!p.address_city &&
    !!p.address_state;
  if (!hasFullAddress) {
    return NextResponse.json({ error: "address_required" }, { status: 422 });
  }

  const addressInput = {
    postalCode: p.postal_code!,
    address: p.address_street!,
    addressNumber: p.address_number!,
    complement: p.address_complement ?? undefined,
    province: p.address_district!,
  };

  // Ensure customer exists AND has cpfCnpj + endereço on Asaas side.
  // Customers created before this migration won't have address; PATCH
  // them no-op-safe a cada checkout.
  let customerId = p.asaas_customer_id;
  if (!customerId) {
    const cust = await asaas.createCustomer({
      name: p.full_name ?? p.email,
      email: p.email,
      externalReference: p.id,
      cpfCnpj,
      ...addressInput,
    });
    customerId = cust.id;
    await admin
      .from("profiles")
      .update({ asaas_customer_id: customerId })
      .eq("id", p.id);
  } else {
    // Best-effort: ensure the existing customer has cpfCnpj + endereço on file.
    try {
      await asaas.updateCustomer(customerId, { cpfCnpj, ...addressInput });
    } catch (err) {
      console.warn("[billing/checkout] updateCustomer failed:", err);
    }
  }

  const proSuccessUrl = `${resolveOrigin(req)}/welcome/pro`;
  const oneOffSuccessUrl = `${resolveOrigin(req)}/dashboard?billing=ok`;

  if (parsed.kind === "pro_subscription") {
    const sub = await asaas.createSubscription({
      customer: customerId,
      billingType: "UNDEFINED",
      value: PRO_AMOUNT_CENTS / 100,
      cycle: "MONTHLY",
      nextDueDate: tomorrowIso(),
      description: "PrepaVaga Pro · assinatura mensal",
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
    description: "PrepaVaga · 1 prep avulso",
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
