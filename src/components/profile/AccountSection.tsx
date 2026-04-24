"use client";

import { useProfileShell } from "./ProfileShellProvider";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { Button } from "@/components/ui/Button";
import { changePassword, deleteAccount } from "@/app/(app)/profile/actions";

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

export function AccountSection() {
  const data = useProfileShell();
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Plano</h2>
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-text-primary">
            Você está no plano <strong>{TIER_LABEL[data.tier] ?? data.tier}</strong>.
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            {data.prepsUsedThisMonth}{" "}
            {data.prepsUsedThisMonth === 1 ? "prep usado" : "preps usados"} este mês.
          </p>
          <div className="mt-3">
            <Button variant="ghost" disabled>
              Gerenciar assinatura
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Segurança</h2>
        <div className="rounded-md border border-border p-4">
          <ChangePasswordDialog action={changePassword} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-red-700">Zona de perigo</h2>
        <div className="rounded-md border border-red-300 bg-red-50 p-4 dark:bg-red-950/30">
          <p className="mb-2 text-sm text-text-primary">
            Excluir sua conta apaga permanentemente todos os seus preps, CVs, e
            dados de perfil. Não há como desfazer.
          </p>
          <DeleteAccountDialog action={deleteAccount} />
        </div>
      </section>
    </div>
  );
}
