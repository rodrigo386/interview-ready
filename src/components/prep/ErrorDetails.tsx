const RAW_DELIMITER = "\n\nRAW RESPONSE:\n";

export function ErrorDetails({ raw }: { raw: string }) {
  const idx = raw.indexOf(RAW_DELIMITER);
  const summary = idx === -1 ? raw : raw.slice(0, idx);
  const detail = idx === -1 ? null : raw.slice(idx + RAW_DELIMITER.length);

  return (
    <div className="mt-4 space-y-2">
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-black/40 p-3 font-mono text-xs text-red-300">
        {summary}
      </pre>
      {detail && (
        <details className="rounded bg-black/40 p-3 text-xs text-red-300">
          <summary className="cursor-pointer font-mono">
            Raw Claude response (debug)
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono">
            {detail}
          </pre>
        </details>
      )}
    </div>
  );
}
