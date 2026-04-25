import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { asaas } from "@/lib/billing/asaas";
import { buildExternalReference } from "@/lib/billing/ids";
import { PRO_AMOUNT_CENTS, PER_USE_AMOUNT_CENTS } from "@/lib/billing/prices";
import { env } from "@/lib/env";

const bodySchema = z.object({
  kind: z.enum(["pro_subscription", "prep_purchase"]),
});

function tomorrowIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nano(): string {
  return Math.random().toString(36).slice(2, 10);
}

function appUrl(): string {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, asaas_customer_id, asaas_subscription_id, subscription_status")
    .eq("id", auth.user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile missing" }, { status: 500 });
  }

  if (
    parsed.kind === "pro_subscription" &&
    (profile.subscription_status === "active" || profile.subscription_status === "overdue")
  ) {
    return NextResponse.json({ error: "Já assinante" }, { status: 409 });
  }

  // Ensure customer.
  let customerId = profile.asaas_customer_id;
  if (!customerId) {
    const cust = await asaas.createCustomer({
      name: profile.full_name ?? profile.email,
      email: profile.email,
      externalReference: profile.id,
    });
    customerId = cust.id;
    await supabase
      .from("profiles")
      .update({ asaas_customer_id: customerId })
      .eq("id", profile.id);
  }

  const successUrl = `${appUrl()}/dashboard?billing=ok`;

  if (parsed.kind === "pro_subscription") {
    const sub = await asaas.createSubscription({
      customer: customerId,
      billingType: "UNDEFINED",
      value: PRO_AMOUNT_CENTS / 100,
      cycle: "MONTHLY",
      nextDueDate: tomorrowIso(),
      description: "PrepaVAGA Pro — assinatura mensal",
      externalReference: buildExternalReference({
        kind: "pro_subscription",
        userId: profile.id,
      }),
      callback: { successUrl, autoRedirect: true },
    });
    await supabase
      .from("profiles")
      .update({ asaas_subscription_id: sub.id })
      .eq("id", profile.id);

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
    description: "PrepaVAGA — 1 prep avulso",
    externalReference: buildExternalReference({
      kind: "prep_purchase",
      userId: profile.id,
      nano: nano(),
    }),
    callback: { successUrl, autoRedirect: true },
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
