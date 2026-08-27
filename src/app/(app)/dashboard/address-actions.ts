"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaas } from "@/lib/billing/asaas";

export type SaveAddressState = { ok?: true; error?: string };

/**
 * Grava o endereço fiscal DEPOIS do pagamento.
 *
 * Antes de 2026-08-27 esses seis campos eram um diálogo bloqueante dentro do
 * checkout — a pessoa já tinha decidido pagar R$10 e encontrava um formulário
 * de CEP/rua/número/bairro/cidade/estado antes de conseguir. O endereço serve
 * pra NFSe, que é emitida depois do pagamento; cobrá-lo antes era inverter a
 * ordem e pagar em conversão por uma exigência que a API do Asaas não faz.
 *
 * As colunas de endereço não têm GRANT de UPDATE pra `authenticated`
 * (migration 0024 restringiu escrita por coluna), então a gravação vai pelo
 * admin client — com `.eq("id", user.id)` explícito como barreira de posse,
 * igual ao resto dos caminhos server-managed.
 */
export async function saveBillingAddress(
  _prev: SaveAddressState,
  formData: FormData,
): Promise<SaveAddressState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre de novo." };

  const campo = (k: string) => String(formData.get(k) ?? "").trim();
  const cep = campo("postalCode").replace(/[^0-9]/g, "");
  const street = campo("addressStreet");
  const number = campo("addressNumber");
  const district = campo("addressDistrict");
  const city = campo("addressCity");
  const uf = campo("addressState").toUpperCase();
  const complement = campo("addressComplement") || null;

  if (cep.length !== 8) return { error: "CEP inválido. Use 8 dígitos." };
  if (!street || !number || !district || !city) {
    return { error: "Preencha rua, número, bairro e cidade." };
  }
  if (uf.length !== 2) return { error: "UF inválida. Use 2 letras (ex.: SP)." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      postal_code: cep,
      address_street: street,
      address_number: number,
      address_complement: complement,
      address_district: district,
      address_city: city,
      address_state: uf,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[address] update falhou:", error.message, error.code);
    return { error: "Não conseguimos salvar agora. Tente de novo." };
  }

  // Espelha no cliente do Asaas, que é quem emite a nota. Best-effort: o
  // endereço já está salvo no nosso banco e o próximo checkout re-envia de
  // qualquer jeito (`addressInput` em /api/billing/checkout), então falhar
  // aqui não pode desfazer o que a pessoa acabou de preencher.
  const { data: perfil } = await admin
    .from("profiles")
    .select("asaas_customer_id")
    .eq("id", user.id)
    .single();
  const customerId = (perfil as { asaas_customer_id?: string } | null)
    ?.asaas_customer_id;
  if (customerId) {
    try {
      await asaas.updateCustomer(customerId, {
        postalCode: cep,
        address: street,
        addressNumber: number,
        complement: complement ?? undefined,
        province: district,
      });
    } catch (err) {
      console.warn("[address] updateCustomer no Asaas falhou:", err);
    }
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
