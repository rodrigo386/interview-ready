import Link from "next/link";
import { GenerateFullPrepCta } from "./GenerateFullPrepCta";

/**
 * Painel exibido nas etapas 3-5 (perguntas básicas / aprofundamento / você
 * pergunta) quando `prep_guide` ainda é nulo — caso de prep reivindicada da
 * ferramenta ATS anônima, que nasce só com a etapa 2 pronta. Diferente de
 * `PrepFailed`: aqui não é um erro, é um estado "ainda não gerado" que a
 * pessoa resolve gerando a preparação completa.
 *
 * O botão de gerar fica AQUI mesmo. A versão anterior mandava "gere a
 * preparação completa a partir da etapa 2" quando a etapa 2 não tinha botão
 * nenhum pra isso — instrução pra um botão inexistente.
 */
export function StepNotGenerated({ sessionId }: { sessionId: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-white p-8 text-center shadow-prep">
        <h2 className="text-xl font-bold text-ink">Essa etapa ainda não foi gerada</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
          Essa prep começou pela análise de compatibilidade ATS e ainda não tem a
          preparação completa (perguntas básicas, aprofundamento e perguntas pro
          entrevistador). Gere a preparação completa abaixo pra desbloquear essa
          parte — o mesmo currículo e a mesma vaga são reaproveitados.
        </p>
        <Link
          href={`/prep/${sessionId}/ats`}
          className="mt-4 inline-block text-sm font-semibold text-orange-700 underline-offset-4 hover:underline"
        >
          ← Voltar pra etapa 2 · sua análise ATS
        </Link>
      </div>
      <GenerateFullPrepCta sessionId={sessionId} />
    </div>
  );
}
