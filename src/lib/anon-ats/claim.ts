import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { anonAnalysisToPrepSession, type PrepSessionInsert } from "./core";
import {
  getAnonAnalysisByToken,
  markClaimed as markClaimedDefault,
  type AnonAnalysisRow,
} from "./repo";

export type ClaimDeps = {
  getRow: (token: string) => Promise<AnonAnalysisRow | null>;
  insertPrep: (insert: PrepSessionInsert) => Promise<string | null>;
  /** Devolve se de fato marcou a linha (ver comentário em repo.ts). */
  markClaimed: (token: string, userId: string) => Promise<boolean>;
};

const DEFAULT_DEPS: ClaimDeps = {
  getRow: getAnonAnalysisByToken,
  insertPrep: async (insert) => {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("prep_sessions")
      .insert(insert)
      .select("id")
      .single();
    if (error || !data) {
      console.warn(`[anon-ats] claim insert falhou: ${error?.message}`);
      return null;
    }
    return (data as { id: string }).id;
  },
  markClaimed: markClaimedDefault,
};

/**
 * Copia a análise anônima para dentro da conta. Idempotente: token já
 * reivindicado devolve null em vez de criar uma segunda prep.
 */
export async function claimAnonAnalysis(
  token: string,
  userId: string,
  deps: ClaimDeps = DEFAULT_DEPS,
): Promise<string | null> {
  const row = await deps.getRow(token);
  if (!row) return null;
  if (row.claimed_by) return null;

  const prepId = await deps.insertPrep(anonAnalysisToPrepSession(row, userId));
  if (!prepId) return null;

  // Ordem proposital: inserir antes de marcar. Se marcar falhar, a prep já
  // criada não pode sumir pro usuário — o custo de uma eventual segunda prep
  // num reenvio é bem menor que perder a análise que ele acabou de ganhar.
  // O risco fica registrado no log, de forma diagnosticável, em vez de
  // mascarado.
  const marked = await deps.markClaimed(token, userId);
  if (!marked) {
    console.warn(
      `[anon-ats] prep ${prepId} criada para o token ${token}, mas markClaimed falhou — a linha pode continuar reivindicável e gerar prep duplicada num reenvio`,
    );
  }
  return prepId;
}
