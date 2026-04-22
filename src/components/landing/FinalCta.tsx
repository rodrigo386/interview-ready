import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="rounded-xl bg-brand-50 px-8 py-16 text-center dark:bg-brand-900/20">
        <h2 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Sua próxima entrevista não precisa ser por sorte.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-text-secondary">
          Comece grátis. Pague R$ 49 só se quiser o dossiê completo.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/signup">
            <Button variant="primary" size="lg">
              Criar conta gratuita
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
