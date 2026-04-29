"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login, type LoginState } from "@/app/(auth)/login/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-zinc-300">
          E-mail
        </label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="block text-sm text-zinc-300">
            Senha
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-zinc-400 hover:text-brand hover:underline"
          >
            Esqueceu?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
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
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
