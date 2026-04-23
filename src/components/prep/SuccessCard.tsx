"use client";

import Link from "next/link";

export function SuccessCard({ sessionId }: { sessionId: string }) {
  return (
    <section
      className="rounded-xl px-6 py-10 text-center text-white shadow-prep md:px-8 md:py-12"
      style={{ background: "linear-gradient(135deg, #2DB87F 0%, #1F7A56 100%)" }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-white/80">
        🎉 Prep completo
      </p>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight md:text-[28px]">
        Você está pronto para a entrevista
      </h2>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/prep/${sessionId}/likely`}
          className="rounded-pill border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green-700"
        >
          Refazer perguntas básicas
        </Link>
        <button
          type="button"
          className="rounded-pill bg-white px-5 py-2.5 text-sm font-semibold text-green-700 shadow-prep hover:bg-green-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green-700"
          onClick={() => {
            window.alert("Export PDF em breve");
          }}
        >
          Exportar resumo em PDF
        </button>
      </div>
    </section>
  );
}
