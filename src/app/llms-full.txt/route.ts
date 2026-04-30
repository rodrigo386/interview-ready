import { getAllPosts, getPostBySlug } from "@/lib/blog/posts";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const summaries = await getAllPosts();
  const fulls = await Promise.all(
    summaries.map(async (s) => ({
      summary: s,
      full: await getPostBySlug(s.slug),
    })),
  );

  const articles = fulls
    .filter((p) => p.full !== null)
    .map(({ summary, full }) => {
      return `# ${summary.title}

> ${summary.description}

URL: ${SITE_URL}/artigos/${summary.slug}
Publicado: ${summary.publishedAt}
Tags: ${(summary.tags ?? []).join(", ")}
Tempo de leitura: ${summary.readingMinutes} min

${full!.content.trim()}
`;
    })
    .join("\n\n---\n\n");

  const body = `# PrepaVaga — conteúdo completo

> Plataforma SaaS brasileira de preparação para entrevista de emprego com IA. Análise ATS + pesquisa da empresa + perguntas + CV reescrito.

Este arquivo contém o conteúdo completo dos artigos do blog em markdown. Para o índice navegável, veja [${SITE_URL}/llms.txt](${SITE_URL}/llms.txt).

Idioma: pt-BR
Última atualização: ${new Date().toISOString().split("T")[0]}

---

${articles}

---

## Sobre a PrepaVaga

A PrepaVaga é uma plataforma operada pela PROAICIRCLE Consultoria Empresarial Ltda (CNPJ 62.805.016/0001-29), com sede em São Paulo, SP. Os planos disponíveis são:

- **Free**: 1 preparação grátis vitalícia ao criar a conta.
- **Pro**: R$30/mês com uso ilimitado (promo de lançamento, preço cheio R$50). Fair use de aproximadamente 50 preparações por mês.
- **Avulso**: R$10 por preparação. Crédito não expira.

Todos os pagamentos são processados pelo Asaas (Pix, cartão de crédito ou boleto). Sem fidelidade. Garantia de 7 dias para reembolso. Operação em conformidade com a LGPD (Lei 13.709/2018).

Contato: prepavaga@prepavaga.com.br
Site: ${SITE_URL}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
