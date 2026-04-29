"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signup, type SignupState } from "@/app/(auth)/signup/actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signup,
    {},
  );

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
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="block text-sm text-zinc-300">
          Nome completo
        </label>
        <Input id="fullName" name="fullName" required className="mt-1" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm text-zinc-300">
          E-mail
        </label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      <div>
        <label htmlFor="cpfCnpj" className="block text-sm text-zinc-300">
          CPF ou CNPJ
        </label>
        <Input
          id="cpfCnpj"
          name="cpfCnpj"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Apenas números"
          required
          className="mt-1"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Necessário para emitir cobranças (Asaas).
        </p>
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
        {pending ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
