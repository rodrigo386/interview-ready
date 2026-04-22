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
      <h1 className="text-3xl font-semibold">Algo deu errado</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        Encontramos um erro inesperado. Tente novamente ou volte ao início.
      </p>
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-zinc-600">
          Referência: {error.digest}
        </p>
      )}
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
        <Link href="/">
          <Button variant="secondary">Início</Button>
        </Link>
      </div>
    </main>
  );
}
