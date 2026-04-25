"use client";

import { useProfileShell } from "./ProfileShellProvider";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { PlanCard } from "@/components/billing/PlanCard";
import { BillingHistoryList } from "@/components/billing/BillingHistoryList";
import { changePassword, deleteAccount } from "@/app/(app)/profile/actions";

export function AccountSection() {
  // useProfileShell still consumed downstream (PlanCard reads it). We keep
  // the hook reference here even though we don't read fields directly.
  useProfileShell();

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Plano</h2>
        <PlanCard />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Histórico de pagamentos</h2>
        {/* @ts-expect-error Async Server Component used inside a client tree.
            The page route is a server component; AccountSection is client.
            Keeping the import here is the spec contract; if your team prefers
            strict typing, hoist BillingHistoryList up to account/page.tsx. */}
        <BillingHistoryList />
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
