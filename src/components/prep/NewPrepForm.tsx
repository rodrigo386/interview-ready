"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPrep, type CreatePrepState } from "@/app/prep/new/actions";

export function NewPrepForm() {
  const [state, formAction, pending] = useActionState<CreatePrepState, FormData>(
    createPrep,
    {},
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="companyName" className="block text-sm text-zinc-300">
            Company
          </label>
          <Input
            id="companyName"
            name="companyName"
            placeholder="Acme Corp"
            required
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="jobTitle" className="block text-sm text-zinc-300">
            Role
          </label>
          <Input
            id="jobTitle"
            name="jobTitle"
            placeholder="Senior Director, AI Procurement"
            required
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <label htmlFor="cvText" className="block text-sm text-zinc-300">
          Your CV (paste text)
        </label>
        <textarea
          id="cvText"
          name="cvText"
          rows={12}
          required
          minLength={200}
          placeholder="Paste your CV text here. More detail = better prep (aim for 500+ words)."
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <div>
        <label htmlFor="jobDescription" className="block text-sm text-zinc-300">
          Job Description (paste text)
        </label>
        <textarea
          id="jobDescription"
          name="jobDescription"
          rows={12}
          required
          minLength={200}
          placeholder="Paste the full job description here."
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Generating your prep… about 30 seconds" : "Generate prep guide"}
      </Button>

      {pending && (
        <p className="text-center text-xs text-zinc-500">
          You can stay on this page. We&apos;ll redirect you when it&apos;s ready.
        </p>
      )}
    </form>
  );
}
