export function SuccessBanner() {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-6 py-4 text-white shadow-prep"
      style={{ background: "linear-gradient(135deg, #2DB87F 0%, #1F7A56 100%)" }}
    >
      <p className="text-sm font-semibold">
        🎉 Prep completo · Você está pronto para a entrevista
      </p>
      <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-white/80">
        5/5 passos completos
      </p>
    </div>
  );
}
