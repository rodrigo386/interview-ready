import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-6xl font-bold text-zinc-700">404</h1>
      <p className="mt-4 text-lg text-zinc-300">Página não encontrada</p>
      <Link href="/" className="mt-8">
        <Button>Voltar ao início</Button>
      </Link>
    </main>
  );
}
