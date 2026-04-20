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
        <p className="font-medium">Check your email.</p>
        <p className="mt-1 text-zinc-400">
          We sent you a confirmation link. Click it, then come back and sign in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="block text-sm text-zinc-300">
          Full name
        </label>
        <Input id="fullName" name="fullName" required className="mt-1" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm text-zinc-300">
          Email
        </label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-zinc-300">
          Password
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
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
