import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { JdKeywords } from "@/lib/ai/ats-keywords";

/**
 * Hash da vaga para achar a régua de uma análise anterior.
 *
 * Espaços colapsados antes do hash: colar a mesma vaga com uma quebra de linha
 * a mais não é outra vaga, e tratar como outra geraria régua nova — o exato
 * problema que isto existe pra evitar.
 */
export function hashJd(jdText: string): string {
  return createHash("sha256").update(jdText.replace(/\s+/g, " ").trim()).digest("hex");
}

type Linha = { kw: JdKeywords | null };

/**
 * Procura a régua já usada numa análise da mesma vaga — logada ou anônima,
 * de qualquer pessoa. Compartilhar entre pessoas é seguro: a régua contém só
 * frases copiadas do texto público da vaga, nada do currículo de ninguém.
 */
export async function findCachedJdKeywords(jdText: string): Promise<JdKeywords | null> {
  const hash = hashJd(jdText);
  const admin = createAdminClient();

  const logada = await admin
    .from("prep_sessions")
    .select("kw:ats_analysis->jd_keywords")
    .eq("ats_analysis->>jd_hash", hash)
    .not("ats_analysis->jd_keywords", "is", null)
    .limit(1);
  const a = (logada.data as Linha[] | null)?.[0]?.kw;
  if (a) return a;

  const anonima = await admin
    .from("anon_ats_analyses")
    .select("kw:analysis->jd_keywords")
    .eq("analysis->>jd_hash", hash)
    .not("analysis->jd_keywords", "is", null)
    .limit(1);
  return (anonima.data as Linha[] | null)?.[0]?.kw ?? null;
}
