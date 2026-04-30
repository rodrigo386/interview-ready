import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Recuperar senha",
  description: "Redefina a senha da sua conta PrepaVAGA por e-mail.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold">Recuperar senha</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </p>
        <div className="mt-8 space-y-6">
          <ForgotPasswordForm />
          <p className="text-center text-sm text-zinc-400">
            <Link href="/login" className="text-brand hover:underline">
              Voltar para o login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
