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
    <>
      {pending && <GeneratingOverlay />}

      <form action={formAction} className="space-y-6">
        <fieldset disabled={pending} className="space-y-6">
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
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60"
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
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60"
            />
          </div>
        </fieldset>

        {state.error && !pending && (
          <p className="text-sm text-red-400" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? (
            <>
              <Spinner />
              <span className="ml-2">Generating your prep… about 30 seconds</span>
            </>
          ) : (
            "Generate prep guide"
          )}
        </Button>

        {pending && (
          <p className="text-center text-xs text-zinc-500">
            You can stay on this page. We&apos;ll redirect you when it&apos;s ready.
          </p>
        )}
      </form>
    </>
  );
}

function GeneratingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center shadow-xl">
        <Spinner large />
        <div>
          <p className="text-base font-medium text-zinc-100">
            Generating your prep guide
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Analyzing your CV and the job description. About 30 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner({ large = false }: { large?: boolean }) {
  const size = large ? "h-8 w-8" : "h-4 w-4";
  return (
    <svg
      className={`${size} animate-spin text-brand`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
