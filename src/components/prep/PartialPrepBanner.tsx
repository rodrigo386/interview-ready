/**
 * Banner shown on Tela 1 when prep_guide.meta.partial === true.
 * Surfaces that one or more sections failed during generation but the
 * prep is still usable. Listing the missing sections helps the user know
 * what's available before clicking through.
 *
 * A última linha diz o que de fato acontece: entrega parcial devolve o
 * crédito (`runStageB` em `src/lib/ai/pipeline.ts` chama `refundPrepCredit`
 * ao gravar o parcial). O texto anterior prometia "você pode regerar o prep
 * inteiro", que nunca foi verdade — o parcial é gravado como `complete`,
 * `classifyRetryRecovery` trata `complete` como não retentável e o
 * `retryPrep` redireciona antes de fazer qualquer coisa. Não havia, e não há,
 * caminho de regeração pela UI.
 */

const SECTION_LABELS: Record<string, string> = {
  likely: "Perguntas prováveis",
  "deep-dive": "Perguntas de aprofundamento",
  tricky: "Perguntas difíceis",
  "questions-to-ask": "Perguntas para o recrutador",
  mindset: "Mindset & dicas finais",
};

export function PartialPrepBanner({
  failedSections,
}: {
  failedSections: string[];
}) {
  if (failedSections.length === 0) return null;
  const labels = failedSections.map((k) => SECTION_LABELS[k] ?? k);

  return (
    <aside
      role="status"
      className="mb-6 rounded-xl border-2 border-yellow-500 bg-yellow-soft/40 p-4 shadow-prep"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl">⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-yellow-700">
            Geração parcial — {failedSections.length} seç
            {failedSections.length === 1 ? "ão" : "ões"} indispon
            {failedSections.length === 1 ? "ível" : "íveis"}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            O serviço de IA estava sob carga e algumas seções não foram geradas:{" "}
            <strong className="text-ink">{labels.join(", ")}</strong>. O resto do
            seu dossiê está completo e utilizável.
          </p>
          <p className="mt-2 text-sm text-ink-2">
            Como a preparação não veio inteira,{" "}
            <strong className="text-ink">devolvemos o crédito usado</strong> — ele
            já voltou pro seu saldo e vale por uma preparação nova, pra esta vaga
            ou pra outra. O que foi gerado aqui continua seu.
          </p>
        </div>
      </div>
    </aside>
  );
}
