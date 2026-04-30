// ViaCEP é API pública gratuita do Correios. Sem chave, sem rate limit
// publicado, latência típica ~200ms. Quando falha (CEP inexistente,
// fora do ar), o form deixa o user preencher manualmente.
//
// Doc: https://viacep.com.br/

export type ViaCepResult = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

type ViaCepRaw = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
};

export function normalizeCep(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

export function isValidCepFormat(input: string): boolean {
  return normalizeCep(input).length === 8;
}

export async function lookupCep(rawCep: string): Promise<ViaCepResult | null> {
  const cep = normalizeCep(rawCep);
  if (cep.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: "force-cache",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepRaw;
    if (data.erro) return null;
    return {
      cep: data.cep ?? cep,
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      uf: (data.uf ?? "").toUpperCase(),
    };
  } catch {
    return null;
  }
}
