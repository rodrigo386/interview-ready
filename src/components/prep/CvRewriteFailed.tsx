import { runCvRewrite } from "@/app/prep/[id]/rewrite-actions";
import { PendingButton } from "./PendingButton";
import { ErrorDetails } from "./ErrorDetails";

export function CvRewriteFailed({
  sessionId,
  errorMessage,
}: {
  sessionId: string;
  errorMessage: string | null;
}) {
  const action = runCvRewrite.bind(null, sessionId);
  return (
    <div className="mt-8 rounded-md border border-red-900 bg-red-950/30 p-5">
      <h3 className="text-sm font-semibold text-red-200">
        🎯 ATS-Optimized CV — failed
      </h3>
      <p className="mt-2 text-sm text-red-300">
        Something went wrong generating the rewrite. Try again.
      </p>
      {errorMessage && <ErrorDetails raw={errorMessage} />}
      <form action={action} className="mt-4">
        <PendingButton
          idleLabel="Retry"
          pendingLabel="Retrying…"
          variant="primary"
        />
      </form>
    </div>
  );
}
