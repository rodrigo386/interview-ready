import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { GoogleButton } from "@/components/auth/GoogleButton";

export const metadata: Metadata = {
  title: "Entrar na sua conta",
  description:
    "Acesse sua conta PrepaVaga para gerenciar suas preparações, currículos e análises de entrevistas.",
  alternates: { canonical: "/login" },
};

function OAuthErrorBanner({ error }: { error?: string }) {
  if (error !== "oauth_failed") return null;
  return (
    <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
      Falha ao entrar com Google. Tente novamente.
    </p>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold">Entrar</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Ainda não tem conta?{" "}
          <Link href="/signup" className="text-brand hover:underline">
            Criar conta
          </Link>
        </p>
        <div className="mt-8 space-y-6">
          <OAuthErrorBanner error={params.error} />
          <LoginForm />
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-zinc-800" />
            <span className="text-xs text-zinc-500">OU</span>
            <hr className="flex-1 border-zinc-800" />
          </div>
          <GoogleButton label="Entrar com Google" />
        </div>
      </div>
    </main>
  );
}
