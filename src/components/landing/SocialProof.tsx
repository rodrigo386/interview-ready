import {
  getSocialProofStats,
  SOCIAL_PROOF_MIN_PREPS,
} from "@/lib/landing/social-proof";

/**
 * Lightweight stats banner on the landing. Renders nothing until prep volume
 * crosses SOCIAL_PROOF_MIN_PREPS so weak numbers don't actively hurt trust.
 * Once it renders, it lives between the Hero and WhatIs sections.
 */
export async function SocialProof() {
  const stats = await getSocialProofStats();
  if (stats.prepsCompleted < SOCIAL_PROOF_MIN_PREPS) return null;

  return (
    <section
      aria-label="Estatísticas da PrepaVAGA"
      className="border-y border-neutral-200 bg-bg dark:border-zinc-800"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-6 px-5 py-8 text-center sm:px-6 sm:flex-row sm:gap-12">
        <Stat
          value={stats.prepsCompleted.toLocaleString("pt-BR")}
          label="preparações geradas com sucesso"
        />
        <span aria-hidden className="hidden h-8 w-px bg-line sm:block" />
        <Stat
          value={stats.professionalsPrepared.toLocaleString("pt-BR")}
          label="profissionais já se prepararam aqui"
        />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-3xl font-bold text-orange-700 md:text-4xl">
        {value}
      </span>
      <span className="text-sm text-text-secondary">{label}</span>
    </div>
  );
}
