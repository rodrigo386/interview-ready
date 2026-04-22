import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CrossingArc } from "./CrossingArc";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div className="grid items-center gap-12 md:grid-cols-5">
        <div className="md:col-span-3">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-text-primary sm:text-5xl md:text-6xl">
            Entre pronto.
            <br />
            <span className="text-brand-600">Saia contratado.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-text-secondary md:text-lg">
            Seu coach de carreira com IA. Em 20 minutos, você recebe o dossiê
            completo da sua próxima vaga: empresa pesquisada, CV revisado
            para ATS, 15 perguntas com roteiros usando sua história, e as
            perguntas que você deve fazer. Por R$ 49.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/signup">
              <Button variant="primary" size="lg">
                Preparar minha vaga — R$ 49
              </Button>
            </Link>
            <a href="#o-que-voce-recebe" className="inline-block">
              <Button variant="ghost" size="lg">
                Ver exemplo de dossiê
              </Button>
            </a>
          </div>
        </div>
        <div className="flex justify-center md:col-span-2 md:justify-end">
          <CrossingArc className="mx-auto" />
        </div>
      </div>
    </section>
  );
}
