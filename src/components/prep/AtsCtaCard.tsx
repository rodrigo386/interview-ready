import { runAtsAnalysis } from "@/app/prep/[id]/ats-actions";
import { PendingButton } from "./PendingButton";

export function AtsCtaCard({ sessionId }: { sessionId: string }) {
  const action = runAtsAnalysis.bind(null, sessionId);
  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-gradient-to-r from-violet-950/40 to-zinc-900/40 p-6">
      <h2 className="text-lg font-semibold">📊 Cheque sua compatibilidade com ATS</h2>
      <p className="mt-2 text-sm text-zinc-400">
        ATSs modernos e triagens com IA buscam no CV as palavras exatas da
        descrição da vaga. Receba uma nota de 0 a 100, as 5 principais lacunas
        e sugestões de reescrita em ~15 segundos.
      </p>
      <form action={action} className="mt-4">
        <PendingButton idleLabel="Rodar compatibilidade ATS" pendingLabel="Analisando… cerca de 15 segundos" variant="primary" />
      </form>
    </section>
  );
}
