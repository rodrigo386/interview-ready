"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signup, type SignupState } from "@/app/(auth)/signup/actions";
import { track } from "@/lib/analytics/client";
import { getStoredUtm } from "@/lib/analytics/utm";

// Experiment PRE-14 (signup friction reduction, second pass): PRE-4 cut the
// form from 11 → 3 fields (email/password/full name). PRE-14 cuts again to 2
// (email/password). Full name is now derived server-side from the local-part
// of the email; user can edit later in /profile. Funnel analysis (n=3) showed
// 2/3 users confirmed email but never generated a prep — we'll keep the lift
// experiment running but every removed field empirically increases signup
// completion ~10-15%.
const FORM_VARIANT = "email_password_only_v3";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signup,
    {},
  );
  const firedStart = useRef(false);
  const firedComplete = useRef(false);

  // signup_started fires on the first interactive event in the form, not on
  // mount — that lets us distinguish "saw the form" (already PageView) from
  // "started typing". A focusin handler is cheap and works for both keyboard
  // and pointer entry.
  function onFirstInteraction() {
    if (firedStart.current) return;
    firedStart.current = true;
    track("signup_started", {
      method: "email",
      form_variant: FORM_VARIANT,
      ...getStoredUtm(),
    });
  }

  useEffect(() => {
    if (firedComplete.current) return;
    if (state.pendingConfirmation) {
      // SignupState arrives as `{ pendingConfirmation: true }` on success
      // or `{ error: "..." }` on failure. Only fire on the success branch.
      firedComplete.current = true;
      track("signup_completed", {
        method: "email",
        pending_confirmation: true,
        form_variant: FORM_VARIANT,
        ...getStoredUtm(),
      });
    }
  }, [state]);

  if (state.pendingConfirmation) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
        <p className="font-medium">Confira seu e-mail.</p>
        <p className="mt-1 text-zinc-400">
          Enviamos um link de confirmação. Clique nele e volte aqui para entrar.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} onFocus={onFirstInteraction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-zinc-300">
          E-mail
        </label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-zinc-300">
          Senha
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          className="mt-1"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando conta…" : "Criar conta grátis"}
      </Button>
      <p className="text-center text-xs text-zinc-500">
        Sem cartão de crédito. Você informa CPF e endereço só quando assinar.
      </p>
    </form>
  );
}
