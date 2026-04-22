import { runCvRewrite } from "@/app/prep/[id]/rewrite-actions";
import { PendingButton } from "./PendingButton";

export function CvRewriteCta({ sessionId }: { sessionId: string }) {
  const action = runCvRewrite.bind(null, sessionId);
  return (
    <div className="mt-8 rounded-md border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold text-zinc-100">
        🎯 ATS-Optimized CV
      </h3>
      <p className="mt-2 text-sm text-zinc-400">
        Rewrite your CV to use the exact vocabulary from this JD. Factual
        content (companies, metrics, dates) stays the same. Takes about 30
        seconds.
      </p>
      <form action={action} className="mt-4">
        <PendingButton
          idleLabel="Generate ATS-Optimized CV"
          pendingLabel="Generating…"
          variant="primary"
        />
      </form>
    </div>
  );
}
