"use server";

import { headers } from "next/headers";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { hashIp } from "@/lib/anon-ats/repo";
import {
  extractJdFromUrl,
  urlDeVagaValida,
  type Motivo,
} from "@/lib/jd/extract-from-url";

export type FetchJdAnonResult =
  | { ok: true; text: string; host: string }
  | { ok: false; motivo: Motivo; error: string };

const SEM_LIMITE =
  "Muitas buscas de link agora. Copie o texto da vaga e cole no campo, ou tente de novo daqui a pouco.";

/**
 * Busca a vaga por LINK para o visitante anônimo (hero e /analise-ats-gratis).
 *
 * Até 2026-10-09 isto exigia login, porque proxiar URL arbitrária pelo Jina e
 * gastar a limpeza do Gemini era um vetor de abuso aberto. Voltou pra pedido do
 * produto, com as guardas que faltavam:
 *  1. a URL é validada antes de gastar qualquer coisa (só http(s), sem IP nem
 *     localhost);
 *  2. limite por IP, falhando FECHADO (sem Redis, recusa);
 *  3. disjuntor GLOBAL por dia, também fechado — independe do banco;
 *  4. o texto devolvido precisa PARECER uma vaga (`exigirSinaisDeVaga`): barra
 *     o uso como proxy de página qualquer e a vaga que veio só com benefícios.
 *
 * O texto NÃO vai pra análise: volta pro campo, onde a pessoa revisa. O Jina é
 * irregular (Catho e Vagas.com ok, Gupy parcial, LinkedIn não), então toda
 * mensagem de erro termina oferecendo colar o texto.
 *
 * x-forwarded-for é forjável (mesma dívida registrada em `actions.ts`); o
 * disjuntor global é o que limita o custo agregado de qualquer jeito.
 */
export async function fetchJdFromUrlAnon(rawUrl: string): Promise<FetchJdAnonResult> {
  const v = urlDeVagaValida(String(rawUrl ?? ""));
  if (!v.ok) {
    return {
      ok: false,
      motivo: "url_invalida",
      error:
        "Esse link não parece válido. Cole o endereço completo da vaga, começando com https://",
    };
  }

  // Server action chamada de um botão no meio do formulário: se QUALQUER coisa
  // aqui lançar (env, headers, Redis, Jina), o erro não tratado derruba a página
  // inteira no limite de erro e a pessoa perde o que já tinha digitado. Por isso
  // tudo vira um resultado tratado, que sempre oferece colar o texto.
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";

    const porIp = await rateLimit(`anonFetchJd:${hashIp(ip) ?? ip}`, LIMITS.anonFetchJd);
    if (!porIp.success) return { ok: false, motivo: "limite", error: SEM_LIMITE };

    const global = await rateLimit("anonFetchJd:global", LIMITS.anonFetchJdGlobal);
    if (!global.success) return { ok: false, motivo: "limite", error: SEM_LIMITE };

    const r = await extractJdFromUrl(v.url, { exigirSinaisDeVaga: true });
    if (!r.ok) return r;

    return { ok: true, text: r.text, host: new URL(v.url).hostname.replace(/^www\./, "") };
  } catch (err) {
    console.error("[fetchJdFromUrlAnon] erro inesperado:", err);
    return {
      ok: false,
      motivo: "erro",
      error:
        "Não consegui buscar essa vaga agora. Copie o texto da vaga e cole no campo.",
    };
  }
}
