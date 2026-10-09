import Link from "next/link";
import { AnonAtsForm } from "@/components/anon-ats/AnonAtsForm";
import { PREP_SKUS } from "@/lib/billing/prices";
import { precoCurto } from "@/lib/billing/dossie";
import { AutoVideo } from "./AutoVideo";
import { HandNote } from "./HandNote";
import { SourceStrip } from "./SourceStrip";
import { TrustRow } from "./TrustRow";

/**
 * Hero em duas partes (2026-10-07):
 *
 *  1. Vídeo promocional quase em tela cheia, com uma barra embaixo (título,
 *     promessa em uma frase e o botão que leva à ferramenta).
 *  2. A seção da ferramenta (`#analisar`): o formulário real ao lado de um
 *     vídeo de instruções — como preencher, o que é grátis e o que é a
 *     preparação completa. O texto explicativo que ficava aqui saiu: o vídeo
 *     explica, e a transcrição vai como descrição para leitor de tela.
 *
 * Isso REVERTE uma decisão anterior, de propósito e a pedido: até aqui o hero
 * era "a ferramenta na dobra" (o formulário na primeira tela, com a promessa
 * em texto ao lado), porque a ferramenta converte 20 de 21 visitantes (amostra
 * pequena) e o hero que escondia o produto grátis atrás de um /signup perdia
 * gente. Com o vídeo em tela cheia o formulário desce pra baixo da dobra no
 * desktop. Duas coisas amortecem isso, e nenhuma delas elimina o risco:
 *  - o CTA sobre o vídeo leva direto ao formulário (`#analisar`);
 *  - no celular o vídeo é 16:9 (não tela cheia), então o formulário aparece
 *    logo abaixo, e a ordem do DOM põe o formulário ANTES do vídeo de
 *    instruções — o primeiro campo já saiu da dobra uma vez por headline longa.
 * Os eventos `video_*` + `anon_ats_started` (placement "hero") existem pra
 * dizer, com dado, se essa troca custou conversão. Se custou, a reversão é
 * mexer neste arquivo.
 *
 * O h1 é "Prepare-se para a entrevista dessa vaga": a manchete antiga ("Seu CV
 * passa no filtro dessa vaga?") é a promessa de pelo menos cinco concorrentes
 * brasileiros — ver `git log` deste arquivo para o raciocínio completo.
 *
 * Os preços nas descrições vêm de `PREP_SKUS`: cópia de venda com número
 * chumbado é a que fica desatualizada primeiro. Os VÍDEOS têm os preços
 * gravados (ver tools/hero-video e tools/howto-video): mudou o preço, regere.
 */

const PACOTES = PREP_SKUS.map((s) => `${s.qty} por ${precoCurto(s.cents)}`).join(", ");

const DESCRICAO_PROMO =
  "Vídeo de 20 segundos, sem áudio, que mostra o produto em uso: você cola a vaga " +
  "e o currículo, vê o score ATS, os ajustes que mais pesam, o currículo no " +
  "celular e as perguntas com roteiro. A análise ATS é grátis e a preparação " +
  `completa custa ${precoCurto()}.`;

const DESCRICAO_COMO_FUNCIONA =
  "Vídeo de 24 segundos, sem áudio, com as instruções. Análise grátis, sem " +
  "cadastro e sem cartão: 1) cole o link ou a descrição completa da vaga; 2) envie o " +
  "currículo em PDF, DOCX ou TXT, até 5 MB, ou cole o texto; 3) clique em " +
  "analisar. Você vê o score ATS na hora e o ajuste que mais barra o seu " +
  "currículo; criar uma conta grátis revela mais 2 ajustes. Preparação " +
  `completa, ${PACOTES}, sem assinatura e com crédito que não expira: traz o ` +
  "currículo reescrito para a vaga, a pesquisa atual da empresa, a faixa " +
  "salarial estimada e cerca de 15 perguntas com roteiro de resposta.";

export function Hero() {
  return (
    <>
      <section aria-label="Apresentação" className="bg-white dark:bg-zinc-950">
        {/* Desktop: a janela menos a navbar (3.5rem) e menos a barra de
            promessa (7rem). Celular: 16:9 de largura total, sem cortar nada —
            object-cover num vídeo 16:9 em tela vertical mostraria só o miolo. */}
        <div className="aspect-video w-full lg:aspect-auto lg:h-[calc(100svh-10.5rem)] lg:min-h-[360px]">
          <AutoVideo
            variant="full"
            name="hero"
            src="/video/hero-v1.mp4"
            poster="/video/hero-poster-v1.jpg"
            description={DESCRICAO_PROMO}
          />
        </div>

        {/* A promessa em texto, visível, mesmo para quem não dá play (reduced
            motion, economia de dados, iOS). Sem ela a primeira tela seria só um
            vídeo, e o poster diz "Seu CV passa no filtro?" mas não diz o que a
            PrepaVaga faz. Pegada de um hero concorrente: uma frase, uma ação. */}
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:px-6 lg:h-28 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:py-0">
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-text-primary sm:text-2xl lg:text-[1.75rem]">
              Prepare-se para a entrevista dessa vaga
            </h1>
            <p className="mt-1 text-sm leading-[1.55] text-text-secondary md:text-base lg:text-[0.9375rem]">
              Cole a vaga e seu currículo: em 1 minuto, grátis e sem cadastro,
              você vê o que está barrando o seu CV. A preparação completa —
              empresa pesquisada, perguntas prováveis e faixa salarial — custa{" "}
              {precoCurto()}.
            </p>
          </div>
          <a
            href="#analisar"
            data-analytics-cta="hero_video_cta"
            data-analytics-location="landing"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-pill bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(234,88,12,0.55)] transition hover:bg-brand-700"
          >
            Analisar meu currículo grátis
            <span aria-hidden>↓</span>
          </a>
        </div>
      </section>

      <SourceStrip />

      <section
        id="analisar"
        aria-labelledby="analisar-titulo"
        className="relative overflow-hidden border-b border-neutral-200 bg-bg scroll-mt-16 dark:border-zinc-800"
      >
        <BackdropPattern />

        <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-20">
          <h2 id="analisar-titulo" className="sr-only">
            Análise de currículo grátis
          </h2>

          {/* No DOM o formulário vem primeiro (celular: formulário, depois o
              vídeo). No desktop o vídeo de instruções fica à esquerda. */}
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <div className="rounded-2xl border border-neutral-200 bg-bg p-5 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.22)] sm:p-6 lg:order-2 dark:border-zinc-800">
              <AnonAtsForm variant="hero" />
            </div>

            <div className="relative lg:order-1">
              <HandNote className="absolute -top-14 left-4 z-10 hidden sm:block">
                veja em 24 segundos
              </HandNote>
              <AutoVideo
                variant="framed"
                name="howto"
                src="/video/howto-v1.mp4"
                poster="/video/howto-poster-v1.jpg"
                description={DESCRICAO_COMO_FUNCIONA}
              />
            </div>
          </div>

          <TrustRow />

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
    </>
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
