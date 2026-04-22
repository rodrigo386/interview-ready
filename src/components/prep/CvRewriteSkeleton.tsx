export function CvRewriteSkeleton() {
  return (
    <div className="mt-8 rounded-md border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold text-zinc-100">
        🎯 ATS-Optimized CV
      </h3>
      <p className="mt-2 text-sm text-zinc-400">
        Rewriting your CV… about 30 seconds. This page will refresh automatically.
      </p>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-800" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
      </div>
      <meta httpEquiv="refresh" content="3" />
    </div>
  );
}
