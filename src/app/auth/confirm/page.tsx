import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmEmailForm } from "@/components/auth/ConfirmEmailForm";
import { parseOtpType } from "@/lib/auth/otp-type";

export const metadata: Metadata = {
  title: "Confirmar email",
  robots: { index: false, follow: false },
};

/**
 * Landing page for email links (Supabase template points here with
 * token_hash + type). Renders a click-to-confirm button instead of verifying
 * on GET: scanner prefetch (Outlook SafeLinks, Gmail) hits this page harmlessly
 * and the one-time token is only consumed when the human clicks.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash ?? "";
  const type = parseOtpType(params.type);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        {tokenHash && type ? (
          <>
            <h1 className="text-2xl font-semibold">Falta um clique</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Clique no botão abaixo pra confirmar seu email e entrar na sua
              conta.
            </p>
            <div className="mt-8">
              <ConfirmEmailForm tokenHash={tokenHash} type={type} />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Link inválido</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Este link está incompleto ou expirou. Abra o email mais recente
              que enviamos, ou{" "}
              <Link href="/login" className="text-brand hover:underline">
                faça login
              </Link>{" "}
              se sua conta já está confirmada.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
