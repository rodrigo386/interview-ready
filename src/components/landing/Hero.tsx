import Link from "next/link";
import { AnonAtsForm } from "@/components/anon-ats/AnonAtsForm";
import { precoCurto } from "@/lib/billing/dossie";

/**
 * Hero "ferramenta na dobra".
 *
 * O hero anterior vendia a análise ATS grátis e mandava o visitante pro
 * /signup — o produto gratuito ficava como terceiro link, em texto pequeno,
 * atrás de um cadastro que ninguém pediu. Aqui o hero deixa de falar da
 * ferramenta e passa a ser a ferramenta: o visitante começa a usar antes de
 * decidir qualquer coisa, e o score é que abre a conversa sobre os R$10.
 *
 * Um CTA só (o submit do formulário). O "ver exemplo" fica como link
 * secundário, e o /signup sai da primeira tela inteiramente — quem quer conta
 * ainda tem o "Entrar" da navbar.
 *
 * REPOSICIONAMENTO (2026-08-26). A headline anterior — "Seu CV passa no filtro
 * dessa vaga?" — é a promessa EXATA de pelo menos cinco concorrentes
 * brasileiros diretos (AjustaCV, OtimizaCV, CV Audit, CvPorVaga, CV Lab), e
 * dois deles entregam de graça mais do que nós (reescrita completa) ou cobram
 * menos (R$7,80 contra R$10). Quem compara não tinha um motivo sequer pra
 * escolher a PrepaVaga.
 *
 * Análise ATS grátis não é vantagem: é o pedágio de entrada desse mercado. O
 * que nenhum deles faz é continuar DEPOIS do currículo — pesquisa recente da
 * empresa, perguntas prováveis com roteiro, faixa salarial, o que perguntar no
 * fim. Esse é o único produto defensável, e estava a uma seção de distância da
 * dobra, invisível pra quem decide em 5 segundos.
 *
 * A ferramenta continua no hero: ela converte 20 de 21 visitantes e é o motor
 * de aquisição. O que muda é a PROMESSA em volta dela — o score deixa de ser o
 * destino e passa a ser o primeiro passo de algo que a concorrência não tem.
 *
 * A primeira tentativa de reposicionar errou a mão: "Do filtro do ATS à
 * pergunta final da entrevista" descrevia um INTERVALO em vez de dizer o que o
 * site faz, e abria com jargão. Quem procura emprego não pensa em "filtro de
 * ATS" — pensa que o currículo "não passou". A headline tem que sobreviver a
 * uma leitura de 5 segundos de quem nunca ouviu falar da categoria, e por isso
 * agora nomeia o produto em português comum. O diferencial (empresa, perguntas,
 * salário) desceu pro subtítulo, que é onde cabe explicar sem atrapalhar.
 *
 * `precoCurto()` em vez de "R$10" escrito à mão: o preço vive em
 * `lib/billing/prices.ts` e já mudou uma vez. Cópia de venda com número
 * chumbado é a que fica desatualizada primeiro.
 */
export function Hero() {
  return (
    <section
      id="analisar"
      className="relative overflow-hidden border-b border-neutral-200 bg-bg scroll-mt-16 dark:border-zinc-800"
    >
      <BackdropPattern />

      <div className="relative mx-auto max-w-6xl px-5 pt-10 pb-14 sm:px-6 md:pt-16 md:pb-20">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-14">
          <div>
            {/* Duas linhas no desktop e no mobile. A versão anterior desta
                headline tinha 9 palavras e quebrava em 4 linhas a 52px, o que
                empurrava o primeiro campo do formulário pra fora da dobra no
                celular. Headline longa demais é erro de escala, não de cópia. */}
            <h1 className="text-[2.125rem] font-bold leading-[1.08] tracking-tight text-text-primary sm:text-5xl lg:text-[3.5rem]">
              Prepare-se para a entrevista dessa vaga
            </h1>

            <p className="mt-5 max-w-md text-base leading-[1.6] text-text-secondary md:text-lg">
              Cole a vaga e seu currículo: em 1 minuto, grátis e sem cadastro,
              você vê o que está barrando o seu CV. A preparação completa —
              empresa pesquisada, perguntas prováveis e faixa salarial — custa{" "}
              {precoCurto()}.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-bg p-5 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.22)] sm:p-6 dark:border-zinc-800">
            <AnonAtsForm variant="hero" />
          </div>
        </div>

        <p className="mt-8 text-sm">
          <Link
            href="/exemplo"
            data-analytics-cta="hero_secondary_exemplo"
            data-analytics-location="landing"
            className="font-semibold text-brand-600 underline-offset-4 hover:underline"
          >
            Ou veja um dossiê pronto antes de testar →
          </Link>
        </p>
      </div>
    </section>
  );
}

function BackdropPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-[0.12]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.45) 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }}
    />
  );
}
