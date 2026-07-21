"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { confirmEmail, type ConfirmEmailState } from "@/app/auth/confirm/actions";

/**
 * The human step of email confirmation. The link in the email lands on a page
 * that renders this form; only the button click (POST) actually verifies the
 * token. Email scanners that prefetch the link (GET) never consume it.
 */
export function ConfirmEmailForm({
  tokenHash,
  type,
}: {
  tokenHash: string;
  type: string;
}) {
  const [state, formAction, pending] = useActionState<ConfirmEmailState, FormData>(
    confirmEmail,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Confirmando…" : "Confirmar meu email →"}
      </Button>
      {state.error && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-sm" role="alert">
          <p className="text-red-400">{state.error}</p>
          <p className="mt-2 text-zinc-400">
            <Link href="/login" className="text-brand hover:underline">
              Ir pro login
            </Link>{" "}
            ·{" "}
            <Link href="/forgot-password" className="text-brand hover:underline">
              Esqueci a senha
            </Link>
          </p>
        </div>
      )}
    </form>
  );
}
