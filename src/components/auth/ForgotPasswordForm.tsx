"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  requestPasswordReset,
  type ForgotPasswordState,
} from "@/app/(auth)/forgot-password/actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.ok) {
    return (
      <div className="rounded-md border border-green-900 bg-green-950/40 px-4 py-3 text-sm text-green-300">
        Se este e-mail está cadastrado, você receberá um link para redefinir sua
        senha em alguns instantes. Verifique também a caixa de spam.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-zinc-300">
          E-mail
        </label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando…" : "Enviar link"}
      </Button>
    </form>
  );
}
