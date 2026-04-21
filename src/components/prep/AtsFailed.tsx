import { runAtsAnalysis } from "@/app/prep/[id]/ats-actions";
import { PendingButton } from "./PendingButton";
import { ErrorDetails } from "./ErrorDetails";

export function AtsFailed({ sessionId, errorMessage }: { sessionId: string; errorMessage: string | null }) {
  const action = runAtsAnalysis.bind(null, sessionId);
  return (
    <section className="mb-8 rounded-lg border border-red-900 bg-red-950/30 p-6">
      <h2 className="text-lg font-semibold text-red-200">ATS analysis failed</h2>
      <p className="mt-2 text-sm text-red-300">Try again in a moment.</p>
      {errorMessage && <ErrorDetails raw={errorMessage} />}
      <form action={action} className="mt-4">
        <PendingButton idleLabel="Retry ATS Match" pendingLabel="Retrying…" variant="primary" />
      </form>
    </section>
  );
}
