import { runCvRewrite } from "@/app/prep/[id]/rewrite-actions";
import { PendingButton } from "./PendingButton";

export function CvRewriteCta({ sessionId }: { sessionId: string }) {
  const action = runCvRewrite.bind(null, sessionId);
  return (
    <div className="mt-8 rounded-md border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold text-zinc-100">
        🎯 Currículo otimizado para ATS
      </h3>
      <p className="mt-2 text-sm text-zinc-400">
        Reescreva seu CV usando o vocabulário exato desta vaga. Dados factuais
        (empresas, métricas, datas) permanecem iguais. Leva cerca de 30
        segundos.
      </p>
      <form action={action} className="mt-4">
        <PendingButton
          idleLabel="Gerar CV otimizado para ATS"
          pendingLabel="Gerando…"
          variant="primary"
        />
      </form>
    </div>
  );
}
