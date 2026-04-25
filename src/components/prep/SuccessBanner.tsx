export function SuccessBanner({ sessionId }: { sessionId?: string }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-6 py-4 text-white shadow-prep"
      style={{ background: "linear-gradient(135deg, #2DB87F 0%, #1F7A56 100%)" }}
    >
      <p className="text-sm font-semibold">
        🎉 Prep completo · Você está pronto para a entrevista
      </p>
      {sessionId && (
        <a
          href={`/prep/${sessionId}/summary.pdf`}
          download
          className="inline-block rounded-pill bg-white px-5 py-2 text-xs font-semibold text-green-700 shadow-prep transition-colors hover:bg-green-soft"
        >
          Exportar resumo em PDF
        </a>
      )}
    </div>
  );
}
