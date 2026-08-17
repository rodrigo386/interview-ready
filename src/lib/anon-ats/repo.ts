import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { AtsAnalysis } from "@/lib/ai/schemas";
import { expiresAtFrom, isExpired } from "./core";

export const ANON_COOKIE = "pv_anon_ats";
const TABLE = "anon_ats_analyses";

export function isOverDailyCap(count: number, cap: number): boolean {
  return count >= cap;
}

/**
 * SHA-256 com salt secreto (env `IP_HASH_SALT`): permite auditar abuso sem
 * guardar o IP em si. Sem o salt em variável de ambiente, o hash de um IPv4
 * seria reversível por força bruta (só ~4,3 bilhões de valores possíveis)
 * mesmo usando SHA-256 — o salt fixo no código não protege nada, porque
 * quem lê o repositório lê o salt também.
 *
 * Devolve `null` quando `IP_HASH_SALT` não está configurado: é melhor não
 * gravar `ip_hash` nenhum do que gravar um hash fraco que finge ser
 * anonimização.
 */
export function hashIp(ip: string): string | null {
  if (!env.IP_HASH_SALT) return null;
  return createHash("sha256").update(`${env.IP_HASH_SALT}:${ip}`).digest("hex").slice(0, 32);
}

export function newToken(): string {
  return randomUUID();
}

export async function countAnalysesLast24h(): Promise<number> {
  const sb = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await sb
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  // Erro de leitura conta como teto atingido: falhar fechado também aqui.
  if (error) return Number.MAX_SAFE_INTEGER;
  return count ?? 0;
}

export async function insertAnonAnalysis(row: {
  token: string;
  cvText: string;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  analysis: AtsAnalysis;
  // Cerebras foi removido em 2026-08-16 (ver CLAUDE.md §10) — só o Gemini
  // gera análise agora. O parâmetro fica como valor único em vez de
  // hardcoded aqui dentro porque a coluna `model_used` é histórica (linhas
  // antigas têm "cerebras") e o chamador é quem decide o que gravar.
  modelUsed: "gemini";
  ipHash: string | null;
}): Promise<boolean> {
  const sb = createAdminClient();
  const { error } = await sb.from(TABLE).insert({
    token: row.token,
    cv_text: row.cvText,
    job_description: row.jobDescription,
    job_title: row.jobTitle,
    company_name: row.companyName,
    analysis: row.analysis,
    status: "complete",
    model_used: row.modelUsed,
    ip_hash: row.ipHash,
    expires_at: expiresAtFrom(new Date()),
  });
  if (error) {
    console.warn(`[anon-ats] insert falhou: ${error.code} ${error.message}`);
    return false;
  }
  return true;
}

export type AnonAnalysisRow = {
  id: string;
  cv_text: string;
  job_description: string;
  job_title: string | null;
  company_name: string | null;
  analysis: AtsAnalysis;
  model_used: string | null;
  claimed_by: string | null;
  expires_at: string;
};

/** Retorna null quando a linha não existe OU já expirou. */
export async function getAnonAnalysisByToken(
  token: string,
): Promise<AnonAnalysisRow | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(
      "id, cv_text, job_description, job_title, company_name, analysis, model_used, claimed_by, expires_at",
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as AnonAnalysisRow;
  if (isExpired(row.expires_at)) return null;
  return row;
}

/**
 * Devolve `true` só quando o update de fato afetou uma linha. Antes o erro
 * (e o caso "0 linhas afetadas") era ignorado silenciosamente: se o insert da
 * prep desse certo mas esse update falhasse, `claimed_by` continuava null e
 * um reenvio do mesmo token passava pelo guard de idempotência de novo,
 * criando uma segunda prep. Ler o retorno permite ao chamador logar esse
 * caso de forma diagnosticável em vez de mascará-lo.
 */
export async function markClaimed(token: string, userId: string): Promise<boolean> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from(TABLE)
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq("token", token)
    .is("claimed_by", null)
    .select("id");
  if (error) {
    console.warn(`[anon-ats] markClaimed falhou: ${error.code} ${error.message}`);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
