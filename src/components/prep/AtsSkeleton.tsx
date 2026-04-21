export function AtsSkeleton() {
  return (
    <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 animate-pulse rounded-full bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
      <p className="mt-6 text-sm text-zinc-400">Analyzing keywords… about 15 seconds. This page will refresh automatically.</p>
      <meta httpEquiv="refresh" content="3" />
    </section>
  );
}
