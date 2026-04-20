"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        We hit an unexpected error. Try again, or head back home.
      </p>
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-zinc-600">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/">
          <Button variant="secondary">Home</Button>
        </Link>
      </div>
    </main>
  );
}
