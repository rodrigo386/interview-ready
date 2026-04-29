import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Redefinir senha · PrepaVAGA",
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold">Redefinir senha</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Informe sua nova senha. O link expira em 1 hora.
        </p>
        <div className="mt-8 space-y-6">
          <ResetPasswordForm />
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
