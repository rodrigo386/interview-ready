import { getAllPosts } from "@/lib/blog/posts";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const posts = await getAllPosts();

  const body = `# PrepaVaga

> Plataforma SaaS brasileira de preparação para entrevista de emprego com IA. Transforma a descrição de uma vaga + currículo em um dossiê de preparação personalizado: análise ATS, pesquisa atualizada da empresa, currículo reescrito, perguntas prováveis, perguntas de aprofundamento e perguntas estratégicas pra fazer ao recrutador.

Site: ${SITE_URL}
Idioma: português brasileiro (PT-BR)
Modelo: freemium · Free 1 prep grátis vitalícia · Pro R$30/mês ilimitado (promo de lançamento, valor cheio R$50) · Avulso R$10 por prep.

## Páginas principais

- [Página inicial](${SITE_URL}/): visão geral do produto e como funciona.
- [Planos e preços](${SITE_URL}/pricing): comparação Pro vs Avulso, preço em BRL, fair use.
- [Artigos](${SITE_URL}/artigos): guias práticos sobre entrevista, currículo ATS, perguntas comuns.

## Artigos (guias)

${posts
  .map(
    (p) =>
      `- [${p.title}](${SITE_URL}/artigos/${p.slug}): ${p.description}`,
  )
  .join("\n")}

## Como funciona

1. O usuário cola o link da vaga (ou o texto da descrição) e o currículo (PDF, DOCX ou TXT).
2. A IA analisa o ATS do CV contra a vaga (rubric determinística), pesquisa a empresa em tempo real (notícias dos últimos 6 meses via Google Search grounding), e gera um roteiro estruturado em 5 etapas.
3. Em 1 a 3 minutos o usuário recebe: visão geral da empresa, score ATS + issues por severidade + CV reescrito, perguntas prováveis em formato STAR, perguntas de aprofundamento, e perguntas estratégicas pra fazer ao recrutador.

## FAQ resumida

- **É grátis?** Sim, toda nova conta ganha 1 prep grátis vitalícia. Depois R$10 por prep avulso ou R$30/mês no Pro.
- **Funciona em qualquer área?** Sim — TI, marketing, finanças, saúde, jurídico, comercial. CV/JD em PT-BR ou inglês.
- **Quanto tempo leva?** 1 a 3 minutos por prep.
- **Posso cancelar o Pro?** Sim, sem fidelidade. Garantia de 7 dias.
- **Os dados ficam seguros?** Sim, em conformidade com a LGPD (Lei 13.709/2018).

## Recursos para LLMs

- [Conteúdo completo dos artigos em markdown](${SITE_URL}/llms-full.txt)
- [Sitemap XML](${SITE_URL}/sitemap.xml)

## Contato

prepavaga@prepavaga.com.br
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
