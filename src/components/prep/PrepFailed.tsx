import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { deleteFailedPrep, retryPrep } from "@/app/prep/new/actions";
import { PendingButton } from "./PendingButton";
import { ErrorDetails } from "./ErrorDetails";

export function PrepFailed({
  id,
  errorMessage,
}: {
  id: string;
  errorMessage: string | null;
}) {
  const retryAction = retryPrep.bind(null, id);
  const deleteAction = deleteFailedPrep.bind(null, id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-lg border border-red-900 bg-red-950/30 p-6">
        <h1 className="text-xl font-semibold text-red-200">
          Não conseguimos gerar sua preparação.
        </h1>
        <p className="mt-2 text-sm text-red-300">
          Algo deu errado ao chamar a IA. O botão Tentar novamente reaproveita o
          mesmo CV e a mesma descrição da vaga. Não precisa colar de novo.
        </p>
        {errorMessage && <ErrorDetails raw={errorMessage} />}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <form action={retryAction}>
          <PendingButton
            idleLabel="Tentar novamente"
            pendingLabel="Tentando… cerca de 30 segundos"
            variant="primary"
          />
        </form>
        <form action={deleteAction}>
          <PendingButton
            idleLabel="Excluir e começar de novo"
            pendingLabel="Excluindo…"
            variant="secondary"
          />
        </form>
        <Link href="/dashboard">
          <Button variant="ghost">Voltar ao dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
