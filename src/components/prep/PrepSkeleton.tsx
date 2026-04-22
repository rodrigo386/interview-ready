import { SECTION_KINDS } from "@/lib/ai/prompts/section-generator";

export function PrepSkeleton() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 animate-pulse rounded-full bg-brand" />
          <p className="text-sm text-zinc-300">Generating your prep guide…</p>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Researching the company, then writing your prep. About 60 seconds. You can close this tab and come back.
        </p>
      </div>

      <div className="mt-10 -mx-2 flex gap-2 overflow-x-auto px-2 pb-2">
        {Array.from({ length: SECTION_KINDS.length + 1 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-32 shrink-0 animate-pulse rounded-full border border-zinc-800 bg-zinc-900/40"
          />
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {SECTION_KINDS.map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/40"
          />
        ))}
      </div>
    </main>
  );
}
