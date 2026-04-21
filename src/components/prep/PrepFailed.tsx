import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { deleteFailedPrep } from "@/app/prep/new/actions";

export function PrepFailed({
  id,
  errorMessage,
}: {
  id: string;
  errorMessage: string | null;
}) {
  const deleteAction = deleteFailedPrep.bind(null, id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-lg border border-red-900 bg-red-950/30 p-6">
        <h1 className="text-xl font-semibold text-red-200">
          We couldn&apos;t generate your prep.
        </h1>
        <p className="mt-2 text-sm text-red-300">
          Something went wrong while calling the AI. Try again in a moment.
        </p>
        {errorMessage && (
          <pre className="mt-4 overflow-x-auto rounded bg-black/40 p-3 font-mono text-xs text-red-300">
            {errorMessage}
          </pre>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <form action={deleteAction}>
          <Button type="submit">Delete and try again</Button>
        </form>
        <Link href="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
