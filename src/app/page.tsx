import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <div className="mb-8 flex justify-center">
          <Logo variant="horizontal" size={56} />
        </div>
        <p className="mt-6 text-xl text-text-secondary">
          Seu coach de carreira com IA. Entre pronto, saia contratado.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button variant="primary">Começar grátis</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Entrar</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
