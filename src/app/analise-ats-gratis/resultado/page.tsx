import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Gauge } from "@/components/prep/Gauge";
import { IssueRow } from "@/components/prep/IssueRow";
import { LockedFix } from "@/components/anon-ats/LockedFix";
import { DossiePitch } from "@/components/anon-ats/DossiePitch";
import { AnonAtsCompletedTracker } from "@/components/anon-ats/AnonAtsCompletedTracker";
import {
  ANON_COOKIE,
  getAnonAnalysisByToken,
  type AnonAnalysisRow,
} from "@/lib/anon-ats/repo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Seu score ATS",
  robots: { index: false, follow: false },
};

export default async function ResultadoPage() {
  const token = (await cookies()).get(ANON_COOKIE)?.value;
  if (!token) redirect("/analise-ats-gratis");

  const row = await getAnonAnalysisByToken(token);
  if (!row) redirect("/analise-ats-gratis");

  // Análise já reivindicada: o conteúdo vive dentro da conta agora. O cookie
  // sobrevive até 7 dias (e um cadastro num navegador diferente sequer passa
  // por aqui pra apagá-lo), então sem este desvio quem já criou conta voltaria
  // a ver o teaser com cadeado pedindo... que criasse conta.
  if (row.claimed_by) {
    redirect(await destinoDaAnaliseReivindicada(row));
  }

  const { analysis } = row;
  const [primeiro, ...escondidos] = analysis.top_fixes;
  const encontrados = [
    ...analysis.keyword_analysis.critical,
    ...analysis.keyword_analysis.high,
  ].filter((k) => k.found).length;

  return (
    <>
      <AnonAtsCompletedTracker
        analysisId={row.id}
        score={analysis.score}
        fixesCount={analysis.top_fixes.length}
        modelUsed={row.model_used ?? undefined}
      />
      <LandingNavbar />
      <main className="bg-bg">
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-14">
          <section className="rounded-lg bg-white p-6 shadow-prep">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <Gauge value={analysis.score} />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-ink">
                  Seu score ATS é {analysis.score}
                </h1>
                <p className="mt-2 text-[15px] leading-6 text-ink-2">
                  {analysis.overall_assessment}
                </p>
                <p className="mt-2 text-sm text-ink-3">
                  {encontrados} termos importantes da vaga já aparecem no seu currículo.
                </p>
              </div>
            </div>
          </section>

          {primeiro ? (
            <section className="rounded-lg border border-line bg-white p-5 shadow-prep">
              <h2 className="mb-3 text-sm font-bold text-ink">
                O ajuste que mais te barra
              </h2>
              <ul className="space-y-2">
                <IssueRow
                  severity="critical"
                  number={primeiro.priority}
                  title={primeiro.gap}
                  description={primeiro.jd_language}
                  impact="Crítico"
                />
              </ul>
              <p className="mt-3 rounded-md bg-green-soft px-4 py-3 text-sm text-ink">
                <strong>Como escrever:</strong> {primeiro.suggested_rewrite}
              </p>
            </section>
          ) : (
            <section className="rounded-lg border-l-4 border-green-500 bg-green-soft px-5 py-4">
              <h2 className="text-sm font-bold text-green-700">
                Nenhum ajuste necessário
              </h2>
              <p className="mt-1 text-[15px] leading-6 text-ink">
                Seu currículo já cobre os termos-chave dessa vaga. Crie sua conta
                pra preparar as respostas da entrevista.
              </p>
            </section>
          )}

          <LockedFix remaining={escondidos.length} />

          {/* O pitch do produto pago vem depois do gancho gratuito: quem só
              queria o score já foi servido, e quem quer resolver a entrevista
              inteira descobre aqui o preço e o que ele compra. */}
          <DossiePitch />
        </div>
      </main>
      <LandingFooter />
    </>
  );
}

/**
 * Para onde mandar quem chega com um token já reivindicado.
 *
 * A linha anônima não guarda o id da prep criada (não há coluna para isso, e
 * inventar uma exigiria migration nova). O casamento é feito pelo
 * `job_description`, que `anonAnalysisToPrepSession` copia literalmente — o
 * mesmo tipo de comparação em memória que o `createPrep` usa pra detectar
 * duplicata. Filtrar por igualdade no PostgREST não serve: a JD pode ter 20 mil
 * caracteres e iria inteira na query string.
 *
 * Sem sessão (ou com outro usuário logado), `/dashboard` é o destino certo:
 * ele mesmo redireciona pro login quando não há sessão.
 */
async function destinoDaAnaliseReivindicada(row: AnonAnalysisRow): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== row.claimed_by) return "/dashboard";

    const { data: preps } = await supabase
      .from("prep_sessions")
      .select("id, job_description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const match = (preps as { id: string; job_description: string | null }[] | null)?.find(
      (p) => p.job_description === row.job_description,
    );
    return match ? `/prep/${match.id}` : "/dashboard";
  } catch (err) {
    console.warn("[resultado] falha ao localizar a prep reivindicada:", err);
    return "/dashboard";
  }
}
