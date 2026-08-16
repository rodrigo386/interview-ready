import Link from "next/link";

/**
 * Painel exibido nas etapas 3-5 (perguntas básicas / aprofundamento / você
 * pergunta) quando `prep_guide` ainda é nulo — caso de prep reivindicada da
 * ferramenta ATS anônima, que nasce só com a etapa 2 pronta. Diferente de
 * `PrepFailed`: aqui não é um erro, é um estado "ainda não gerado" que o
 * usuário resolve seguindo pra etapa 2.
 */
export function StepNotGenerated({ sessionId }: { sessionId: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-8 text-center shadow-prep">
      <h2 className="text-xl font-bold text-ink">Essa etapa ainda não foi gerada</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
        Essa prep começou pela análise de compatibilidade ATS e ainda não tem a
        preparação completa (perguntas básicas, aprofundamento e perguntas pro
        entrevistador). Gere a preparação completa a partir da etapa 2 pra
        desbloquear essa parte.
      </p>
      <Link
        href={`/prep/${sessionId}/ats`}
        className="mt-4 inline-block rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white"
      >
        ← Ir para a etapa 2 · ATS
      </Link>
    </div>
  );
}
