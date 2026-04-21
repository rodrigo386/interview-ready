import { runAtsAnalysis } from "@/app/prep/[id]/ats-actions";
import { PendingButton } from "./PendingButton";

export function AtsCtaCard({ sessionId }: { sessionId: string }) {
  const action = runAtsAnalysis.bind(null, sessionId);
  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-gradient-to-r from-violet-950/40 to-zinc-900/40 p-6">
      <h2 className="text-lg font-semibold">📊 Check your ATS match</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Modern ATS and AI screeners scan CVs for exact-phrase keywords from the
        job description. Get a 0-100 score, the top 5 gaps, and suggested
        rewrites in ~15 seconds.
      </p>
      <form action={action} className="mt-4">
        <PendingButton idleLabel="Run ATS Match" pendingLabel="Analyzing… about 15 seconds" variant="primary" />
      </form>
    </section>
  );
}
