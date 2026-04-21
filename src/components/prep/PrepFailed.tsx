import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { deleteFailedPrep, retryPrep } from "@/app/prep/new/actions";
import { PendingButton } from "./PendingButton";

export function PrepFailed({
  id,
  errorMessage,
}: {
  id: string;
  errorMessage: string | null;
}) {
  const retryAction = retryPrep.bind(null, id);
  const deleteAction = deleteFailedPrep.bind(null, id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-lg border border-red-900 bg-red-950/30 p-6">
        <h1 className="text-xl font-semibold text-red-200">
          We couldn&apos;t generate your prep.
        </h1>
        <p className="mt-2 text-sm text-red-300">
          Something went wrong while calling the AI. Retry uses the same CV and
          job description — no need to re-paste.
        </p>
        {errorMessage && (
          <pre className="mt-4 overflow-x-auto rounded bg-black/40 p-3 font-mono text-xs text-red-300">
            {errorMessage}
          </pre>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <form action={retryAction}>
          <PendingButton
            idleLabel="Retry"
            pendingLabel="Retrying… about 30 seconds"
            variant="primary"
          />
        </form>
        <form action={deleteAction}>
          <PendingButton
            idleLabel="Delete and start over"
            pendingLabel="Deleting…"
            variant="secondary"
          />
        </form>
        <Link href="/dashboard">
          <Button variant="ghost">Back to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
